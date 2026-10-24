// src/services/reportExportService.js
// Exportação de relatórios em PDF, Excel, CSV e JSON a partir do snapshot versionado.

const crypto = require('node:crypto');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const managementRepo = require('../repositories/managementRepository');

/**
 * Cria slug a partir de string para nomes de arquivo seguros.
 */
function slugify(text) {
  return String(text || 'ciclo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'ciclo';
}

/**
 * Retorna o nome padrão do arquivo exportado conforme especificação:
 * equilibra-relatorio-<slug-do-ciclo>-<AAAA-MM-DD>.<ext>
 */
function getExportFileName(report, ext) {
  const dateStr = (report.closedAt ? new Date(report.closedAt) : new Date()).toISOString().slice(0, 10);
  const slug = slugify(report.cycle || report.title || report.surveyId);
  return `equilibra-relatorio-${slug}-${dateStr}.${ext}`;
}

/**
 * Calcula hash SHA-256 do conteúdo para rodapé e integridade.
 */
function computeContentHash(content) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf-8');
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

/**
 * Registra evento de auditoria no repositório de gestão.
 */
function logExportAudit(account, report, format) {
  try {
    managementRepo.transaction(account, 'report.exported', () => ({
      id: report.id,
      surveyId: report.surveyId,
      format,
      cycle: report.cycle,
      exportedAt: new Date().toISOString()
    }));
  } catch (err) {
    // Falha em registrar log de auditoria não deve quebrar o download para o usuário
    console.error('Erro ao registrar log de auditoria de exportação:', err.message);
  }
}

/**
 * Exportação em CSV (; como separador, UTF-8 com BOM).
 */
function generateCsv(report) {
  const BOM = '\uFEFF';
  const sep = ';';
  const lines = [];

  // Cabeçalho CSV
  lines.push(['Ciclo', 'Modelo', 'Fator', 'Segmento', 'Média', 'Amostra', 'Faixa', 'Status'].join(sep));

  if (!report.published) {
    const reason = (report.suppressionReason || 'Resultado protegido por sigilo estatístico').replace(/"/g, '""');
    lines.push([
      `"${report.cycle || ''}"`,
      `"${report.model || ''}"`,
      '"Todos"',
      '"Geral"',
      '""',
      '""',
      '""',
      `"Protegido: ${reason}"`
    ].join(sep));
    return BOM + lines.join('\r\n');
  }

  const factors = report.factors || [];

  // Linhas do total geral para cada fator
  for (const f of factors) {
    const avgStr = typeof f.average === 'number' ? f.average.toFixed(2).replace('.', ',') : '';
    lines.push([
      `"${report.cycle || ''}"`,
      `"${report.model || ''}"`,
      `"${f.label}"`,
      '"Total Coletivo"',
      `"${avgStr}"`,
      `"${f.n}"`,
      `"${f.levelLabel}"`,
      '"Publicado"'
    ].join(sep));

    // Se houver matriz particionada por segmento, adiciona uma linha por bucket
    if (report.segmentation?.hasMatrix && Array.isArray(report.segmentation.buckets)) {
      for (const bucket of report.segmentation.buckets) {
        const bucketFactor = (bucket.factors || []).find(item => item.key === f.key);
        if (bucketFactor) {
          const bAvgStr = typeof bucketFactor.average === 'number' ? bucketFactor.average.toFixed(2).replace('.', ',') : '';
          lines.push([
            `"${report.cycle || ''}"`,
            `"${report.model || ''}"`,
            `"${f.label}"`,
            `"${bucket.name}"`,
            `"${bAvgStr}"`,
            `"${bucket.n}"`,
            `"${bucketFactor.levelLabel}"`,
            `"${bucket.isMerged ? 'Agrupado por partição' : 'Publicado'}"`
          ].join(sep));
        }
      }
    }
  }

  return BOM + lines.join('\r\n');
}

/**
 * Exportação em Excel (.xlsx) com abas completas via exceljs.
 */
async function generateXlsx(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Equilibra Web';
  workbook.created = new Date();

  const brandFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF581C43' } // Deep Mulberry
  };
  const headerFont = {
    name: 'Arial',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' }
  };
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFE4DDEC' } },
    left: { style: 'thin', color: { argb: 'FFE4DDEC' } },
    bottom: { style: 'thin', color: { argb: 'FFE4DDEC' } },
    right: { style: 'thin', color: { argb: 'FFE4DDEC' } }
  };

  // 1. Aba Resumo
  const wsResumo = workbook.addWorksheet('Resumo');
  wsResumo.views = [{ showGridLines: true }];
  wsResumo.columns = [
    { header: 'Propriedade', key: 'prop', width: 28 },
    { header: 'Valor', key: 'val', width: 65 }
  ];
  wsResumo.getRow(1).fill = brandFill;
  wsResumo.getRow(1).font = headerFont;

  wsResumo.addRow({ prop: 'Título da Pesquisa', val: report.title });
  wsResumo.addRow({ prop: 'Ciclo', val: report.cycle });
  wsResumo.addRow({ prop: 'Modelo do Instrumento', val: report.model });
  wsResumo.addRow({ prop: 'Público Avaliado', val: report.groupName });
  wsResumo.addRow({ prop: 'Status da Publicação', val: report.published ? 'Publicado' : 'Protegido por sigilo' });
  wsResumo.addRow({ prop: 'Data de Fechamento', val: report.closedAt ? report.closedAt.slice(0, 10) : '—' });
  wsResumo.addRow({ prop: 'Total de Convidados', val: report.invitedCount || 0 });
  wsResumo.addRow({ prop: 'Respostas Coletadas', val: report.responseCount || 0 });
  wsResumo.addRow({ prop: 'Taxa Geral de Adesão', val: `${Math.round((report.participationRate || 0) * 100)}%` });

  if (report.summary?.text) {
    wsResumo.addRow({ prop: 'Resumo por Regra (sem IA)', val: report.summary.text });
  } else if (report.suppressionReason) {
    wsResumo.addRow({ prop: 'Motivo da Proteção', val: report.suppressionReason });
  }

  if (report.acceptance) {
    wsResumo.addRow({
      prop: 'Aceite do Responsável',
      val: `Aceito por ${report.acceptance.userName} em ${report.acceptance.acceptedAt} (Versão do Instrumento: ${report.acceptance.instrumentVersion})`
    });
  } else {
    wsResumo.addRow({ prop: 'Aceite do Responsável', val: 'Pendente de formalização pelo RH/SST' });
  }

  // 2. Aba Fatores
  const wsFatores = workbook.addWorksheet('Fatores');
  wsFatores.views = [{ showGridLines: true, state: 'frozen', ySplit: 1 }];
  wsFatores.columns = [
    { header: 'Fator', key: 'key', width: 20 },
    { header: 'Rótulo / Dimensão', key: 'label', width: 35 },
    { header: 'Média (1 a 5)', key: 'avg', width: 16 },
    { header: 'Amostra (N)', key: 'n', width: 14 },
    { header: 'Classificação Operacional', key: 'level', width: 26 },
    { header: 'Delta Ciclo Anterior', key: 'delta', width: 22 },
    { header: 'Tendência', key: 'trend', width: 16 }
  ];
  wsFatores.getRow(1).fill = brandFill;
  wsFatores.getRow(1).font = headerFont;

  if (report.published && Array.isArray(report.factors)) {
    for (const f of report.factors) {
      wsFatores.addRow({
        key: f.key,
        label: f.label,
        avg: typeof f.average === 'number' ? Number(f.average.toFixed(2)) : '—',
        n: f.n,
        level: f.levelLabel,
        delta: typeof f.delta === 'number' ? Number(f.delta.toFixed(2)) : '—',
        trend: f.trend ? f.trend.toUpperCase() : '—'
      });
    }
  } else {
    wsFatores.addRow({
      key: '—',
      label: 'Dados protegidos por sigilo estatístico',
      avg: '—',
      n: '—',
      level: 'Protegido',
      delta: '—',
      trend: '—'
    });
  }

  // 3. Aba Distribuição
  const wsDist = workbook.addWorksheet('Distribuição');
  wsDist.views = [{ showGridLines: true, state: 'frozen', ySplit: 1 }];
  wsDist.columns = [
    { header: 'Fator', key: 'label', width: 32 },
    { header: 'Nível 1 (Discordo)', key: 'c1', width: 18 },
    { header: 'Nível 2', key: 'c2', width: 14 },
    { header: 'Nível 3 (Neutro)', key: 'c3', width: 16 },
    { header: 'Nível 4', key: 'c4', width: 14 },
    { header: 'Nível 5 (Concordo)', key: 'c5', width: 18 },
    { header: 'Situação', key: 'status', width: 28 }
  ];
  wsDist.getRow(1).fill = brandFill;
  wsDist.getRow(1).font = headerFont;

  if (report.published && Array.isArray(report.distribution)) {
    for (const d of report.distribution) {
      if (d.suppressed || !d.counts) {
        wsDist.addRow({
          label: d.label,
          c1: '—', c2: '—', c3: '—', c4: '—', c5: '—',
          status: 'Omitido por sigilo complementar'
        });
      } else {
        wsDist.addRow({
          label: d.label,
          c1: d.counts[0],
          c2: d.counts[1],
          c3: d.counts[2],
          c4: d.counts[3],
          c5: d.counts[4],
          status: 'Publicado'
        });
      }
    }
  } else {
    wsDist.addRow({
      label: 'Distribuição não aplicável ou omitida por sigilo/instrumento scoring',
      c1: '—', c2: '—', c3: '—', c4: '—', c5: '—',
      status: report.published ? 'Instrumento HSE sem escala ordinal 1-5' : 'Protegido'
    });
  }

  // 4. Aba Segmento x Fator
  const wsMatriz = workbook.addWorksheet('Segmento x Fator');
  wsMatriz.views = [{ showGridLines: true, state: 'frozen', ySplit: 1 }];

  if (report.published && report.segmentation?.hasMatrix && Array.isArray(report.segmentation.buckets)) {
    const buckets = report.segmentation.buckets;
    const cols = [{ header: 'Fator / Dimensão', key: 'factor', width: 32 }];
    for (let i = 0; i < buckets.length; i++) {
      cols.push({ header: buckets[i].name, key: `b_${i}`, width: 24 });
    }
    cols.push({ header: 'Total Geral', key: 'total', width: 18 });
    wsMatriz.columns = cols;
    wsMatriz.getRow(1).fill = brandFill;
    wsMatriz.getRow(1).font = headerFont;

    for (const f of (report.factors || [])) {
      const row = { factor: f.label, total: Number(f.average.toFixed(2)) };
      buckets.forEach((b, idx) => {
        const bf = (b.factors || []).find(item => item.key === f.key);
        row[`b_${idx}`] = bf ? Number(bf.average.toFixed(2)) : '—';
      });
      wsMatriz.addRow(row);
    }

    if (report.segmentation.notes) {
      wsMatriz.addRow({});
      wsMatriz.addRow({ factor: `Nota metodológica: ${report.segmentation.notes}` });
    }
  } else {
    wsMatriz.columns = [
      { header: 'Recorte por Segmento', key: 'col1', width: 50 },
      { header: 'Status', key: 'col2', width: 30 }
    ];
    wsMatriz.getRow(1).fill = brandFill;
    wsMatriz.getRow(1).font = headerFont;
    wsMatriz.addRow({
      col1: report.segmentation?.notes || 'Matriz não disponível (todas as áreas consolidadas no total coletivo).',
      col2: 'Exibição exclusiva no total'
    });
  }

  // 5. Aba Participação
  const wsPart = workbook.addWorksheet('Participação');
  wsPart.views = [{ showGridLines: true, state: 'frozen', ySplit: 1 }];
  wsPart.columns = [
    { header: 'Segmento / Agrupamento', key: 'name', width: 32 },
    { header: 'Convidados', key: 'invited', width: 16 },
    { header: 'Respostas', key: 'resp', width: 16 },
    { header: 'Taxa de Adesão', key: 'rate', width: 18 },
    { header: 'Faixa Operacional', key: 'band', width: 20 },
    { header: 'Observação', key: 'obs', width: 30 }
  ];
  wsPart.getRow(1).fill = brandFill;
  wsPart.getRow(1).font = headerFont;

  if (report.participation?.segments && report.participation.segments.length) {
    for (const s of report.participation.segments) {
      wsPart.addRow({
        name: s.name,
        invited: s.invited,
        resp: s.responded,
        rate: typeof s.rate === 'number' ? `${Math.round(s.rate * 100)}%` : '—',
        band: s.band || '—',
        obs: s.isMerged ? 'Consolidado por partição de sigilo' : 'Recorte direto'
      });
    }
  }

  if (report.participation?.total) {
    const t = report.participation.total;
    wsPart.addRow({
      name: 'TOTAL GERAL',
      invited: t.invited,
      resp: t.responded,
      rate: `${Math.round(t.rate * 100)}%`,
      band: t.band || '—',
      obs: 'Consolidado da pesquisa'
    });
  }
  wsPart.addRow({});
  wsPart.addRow({ name: report.participation?.disclaimer || 'Cinco respostas protegem a divulgação; não demonstram representatividade estatística.' });

  // 6. Aba Comparação
  const wsComp = workbook.addWorksheet('Comparação');
  wsComp.views = [{ showGridLines: true, state: 'frozen', ySplit: 1 }];
  wsComp.columns = [
    { header: 'Fator', key: 'label', width: 32 },
    { header: 'Ciclo Atual', key: 'curr', width: 18 },
    { header: 'Ciclo Anterior', key: 'prev', width: 18 },
    { header: 'Delta', key: 'delta', width: 16 },
    { header: 'Sentido', key: 'trend', width: 18 }
  ];
  wsComp.getRow(1).fill = brandFill;
  wsComp.getRow(1).font = headerFont;

  if (report.published && report.comparison?.comparable && Array.isArray(report.comparison.factors)) {
    for (const c of report.comparison.factors) {
      wsComp.addRow({
        label: c.label,
        curr: typeof c.average === 'number' ? Number(c.average.toFixed(2)) : '—',
        prev: typeof c.previous === 'number' ? Number(c.previous.toFixed(2)) : '—',
        delta: typeof c.delta === 'number' ? Number(c.delta.toFixed(2)) : '—',
        trend: c.trend ? c.trend.toUpperCase() : '—'
      });
    }
  } else {
    wsComp.addRow({
      label: report.comparison?.reason || 'Ciclo inaugural ou sem histórico compatível para comparação.',
      curr: '—', prev: '—', delta: '—', trend: '—'
    });
  }

  // 7. Aba Metodologia
  const wsMet = workbook.addWorksheet('Metodologia');
  wsMet.views = [{ showGridLines: true }];
  wsMet.columns = [
    { header: 'Tópico', key: 'topico', width: 28 },
    { header: 'Detalhes Metodológicos e Limites', key: 'detalhe', width: 75 }
  ];
  wsMet.getRow(1).fill = brandFill;
  wsMet.getRow(1).font = headerFont;

  wsMet.addRow({ prop: 'Instrumento', detalhe: report.methodologyDetails?.instrumentName || report.model });
  wsMet.addRow({ prop: 'Versão', detalhe: String(report.methodologyDetails?.version || '1') });
  wsMet.addRow({ prop: 'Limitações Declaradas', detalhe: report.methodologyDetails?.limitation || 'Questionário exploratório para orientação de SST.' });
  wsMet.addRow({ prop: 'Aviso Legal e NR-1', detalhe: report.methodologyDetails?.disclaimer || 'Não constitui diagnóstico clínico, laudo técnico ou comprovação isolada de conformidade com a NR-1.' });
  wsMet.addRow({ prop: 'Faixas de Semáforo', detalhe: report.methodologyDetails?.referenceBandsDisclaimer || 'Referência operacional da plataforma, não ponto de corte validado para o Brasil.' });

  // Aplica bordas e formatação
  workbook.eachSheet(ws => {
    ws.eachRow(row => {
      row.eachCell(cell => {
        if (!cell.border) cell.border = thinBorder;
      });
    });
  });

  return workbook.xlsx.writeBuffer();
}

/**
 * Remove acentuação e caracteres incompatíveis com fontes básicas padrão do PDFKit.
 */
function toAsciiSafe(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n\r\t]/g, '');
}

/**
 * Exportação em PDF no servidor via PDFKit.
 * Sem navegador headless, leve, desenha tabelas e barras vetoriais.
 */
function generatePdf(report, user = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Relatorio do Ciclo - ${toAsciiSafe(report.title)}`,
          Author: 'Equilibra Web',
          Subject: 'Relatorio Coletivo de Condicoes de Trabalho'
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      const primaryColor = '#581c43'; // Deep Mulberry
      const darkText = '#1c142b';
      const mutedText = '#524765';
      const lightBg = '#f8f7fb';
      const borderCol = '#e4ddec';

      const userName = toAsciiSafe(user.name || 'Usuario RH/SST');
      const genTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const hash = computeContentHash(JSON.stringify(report));

      // Cabeçalho da Primeira Página
      doc.rect(40, 40, 515, 60).fill(primaryColor);
      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('e . equilibra', 55, 52);
      doc.fontSize(10).font('Helvetica').text('Escuta Confidencial das Condicoes de Trabalho - SST / NR-1', 55, 74);

      doc.moveDown(3);

      // Metadados do Ciclo
      doc.fillColor(darkText).fontSize(16).font('Helvetica-Bold').text(toAsciiSafe(report.title), 40, 115);
      doc.fontSize(10).font('Helvetica').fillColor(mutedText)
        .text(`Ciclo: ${toAsciiSafe(report.cycle)}   |   Modelo: ${toAsciiSafe(report.model)}   |   Publico: ${toAsciiSafe(report.groupName)}`, 40, 138);

      // Caixa de Status e Participação
      doc.rect(40, 155, 515, 45).fill(lightBg).stroke(borderCol);
      const statusLabel = report.published ? 'STATUS: PUBLICADO' : 'STATUS: PROTEGIDO POR SIGILO';
      const statusColor = report.published ? '#166534' : '#991b1b';

      doc.fontSize(10).font('Helvetica-Bold').fillColor(statusColor).text(statusLabel, 55, 165);
      doc.fontSize(9).font('Helvetica').fillColor(darkText)
        .text(`Respostas: ${report.responseCount || 0} de ${report.invitedCount || 0} convidados (${Math.round((report.participationRate || 0) * 100)}% de adesao)   |   Fechamento: ${report.closedAt ? report.closedAt.slice(0, 10) : '—'}`, 55, 180);

      // Aviso Fixo Obrigatório
      doc.rect(40, 208, 515, 36).fill('#fffbeb').stroke('#fde68a');
      doc.fillColor('#92400e').fontSize(8).font('Helvetica-Bold')
        .text('AVISO METODOLOGICO:', 50, 214)
        .font('Helvetica')
        .text('Este relatorio descritivo tem finalidade preventiva no ambito das investigacoes de SST da empresa. Nao constitui laudo tecnico, diagnostico individual ou comprovacao isolada de conformidade com a NR-1.', 50, 225, { width: 495 });

      let curY = 255;

      // Estado PROTEGIDO
      if (!report.published) {
        doc.rect(40, curY, 515, 90).fill('#fee2e2').stroke('#fca5a5');
        doc.fillColor('#991b1b').fontSize(12).font('Helvetica-Bold').text('Divulgacao Protegida por Regras de Privacidade', 55, curY + 12);
        const reasonText = toAsciiSafe(report.suppressionReason || 'Volume insuficiente ou sobreposicao que inviabiliza a divulgacao estatistica.');
        doc.fontSize(9).font('Helvetica').fillColor('#7f1d1d')
          .text(`Motivo: ${reasonText}`, 55, curY + 32, { width: 485 });

        const firstAction = toAsciiSafe(report.publication?.reasons?.[0]?.action || 'Convide ao menos 5 pessoas para preservar o sigilo.');
        doc.font('Helvetica-Bold').text(`Recomendacao: ${firstAction}`, 55, curY + 60, { width: 485 });

        curY += 110;
      } else {
        // Estado PUBLICADO: Resumo
        if (report.summary?.text) {
          doc.fillColor(darkText).fontSize(12).font('Helvetica-Bold').text('Resumo Executivo (Calculo Determinístico)', 40, curY);
          curY += 16;
          doc.rect(40, curY, 515, 45).fill(lightBg).stroke(borderCol);
          doc.fillColor(darkText).fontSize(9).font('Helvetica')
            .text(toAsciiSafe(report.summary.text), 50, curY + 8, { width: 495, lineGap: 2 });
          curY += 55;
        }

        // Tabela de Fatores
        doc.fillColor(darkText).fontSize(12).font('Helvetica-Bold').text('Indice por Fator / Dimensao', 40, curY);
        curY += 16;

        // Cabeçalho da tabela
        doc.rect(40, curY, 515, 20).fill(primaryColor);
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
          .text('Fator / Dimensao', 50, curY + 6)
          .text('Media', 260, curY + 6)
          .text('Faixa Referencia', 330, curY + 6)
          .text('Delta Ciclo Ant.', 440, curY + 6);
        curY += 20;

        const factors = report.factors || [];
        for (let i = 0; i < factors.length; i++) {
          const f = factors[i];
          const rowBg = i % 2 === 0 ? '#ffffff' : lightBg;
          doc.rect(40, curY, 515, 20).fill(rowBg).stroke(borderCol);

          doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
            .text(toAsciiSafe(f.label), 50, curY + 6, { width: 200, ellipsis: true });

          const avgStr = f.average.toFixed(2);
          doc.fillColor(darkText).font('Helvetica').text(avgStr, 260, curY + 6);

          // Barrinha gráfica vetorizada
          const barWidth = Math.max(2, Math.min(60, (f.average / 5) * 60));
          const barColor = f.level === 'adequado' ? '#166534' : (f.level === 'cuidado' ? '#854d0e' : '#991b1b');
          doc.rect(285, curY + 6, barWidth, 7).fill(barColor);

          doc.fillColor(barColor).font('Helvetica-Bold').text(toAsciiSafe(f.levelLabel), 350, curY + 6);

          const deltaStr = typeof f.delta === 'number' ? (f.delta > 0 ? `+${f.delta.toFixed(2)}` : f.delta.toFixed(2)) : '—';
          doc.fillColor(darkText).font('Helvetica').text(deltaStr, 450, curY + 6);

          curY += 20;
          if (curY > 700) {
            doc.addPage();
            curY = 50;
          }
        }

        curY += 15;

        // Recorte por Segmento
        if (report.segmentation?.hasMatrix && Array.isArray(report.segmentation.buckets)) {
          if (curY > 620) { doc.addPage(); curY = 50; }
          doc.fillColor(darkText).fontSize(12).font('Helvetica-Bold').text('Recorte por Segmento (Particao Segura)', 40, curY);
          curY += 16;

          const buckets = report.segmentation.buckets;
          const bucketW = Math.floor(250 / Math.max(1, buckets.length));

          doc.rect(40, curY, 515, 20).fill(primaryColor);
          doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
            .text('Fator', 50, curY + 6);

          buckets.forEach((b, idx) => {
            doc.text(toAsciiSafe(b.name), 200 + idx * bucketW, curY + 6, { width: bucketW - 5, ellipsis: true });
          });
          doc.text('Total', 480, curY + 6);
          curY += 20;

          for (let i = 0; i < factors.length; i++) {
            const f = factors[i];
            const rowBg = i % 2 === 0 ? '#ffffff' : lightBg;
            doc.rect(40, curY, 515, 18).fill(rowBg).stroke(borderCol);

            doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
              .text(toAsciiSafe(f.label), 50, curY + 5, { width: 140, ellipsis: true });

            buckets.forEach((b, idx) => {
              const bf = (b.factors || []).find(item => item.key === f.key);
              const val = bf ? bf.average.toFixed(2) : '—';
              doc.fillColor(darkText).font('Helvetica').text(val, 200 + idx * bucketW, curY + 5);
            });

            doc.text(f.average.toFixed(2), 480, curY + 5);
            curY += 18;
            if (curY > 720) { doc.addPage(); curY = 50; }
          }

          if (report.segmentation.notes) {
            curY += 4;
            doc.fontSize(7).font('Helvetica-Oblique').fillColor(mutedText)
              .text(toAsciiSafe(`Nota: ${report.segmentation.notes}`), 40, curY, { width: 515 });
            curY += 14;
          }
        }
      }

      // Bloco de Aceite
      if (curY > 660) { doc.addPage(); curY = 50; }
      curY += 10;
      doc.rect(40, curY, 515, 45).fill('#f0ebf8').stroke(primaryColor);
      if (report.acceptance) {
        doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold')
          .text('TERMO DE ACEITE FORMALIZADO', 50, curY + 8);
        doc.fillColor(darkText).fontSize(8).font('Helvetica')
          .text(`Aceito por ${toAsciiSafe(report.acceptance.userName)} em ${report.acceptance.acceptedAt.slice(0, 10)}.`, 50, curY + 20)
          .text('Declaracao: "Reconheco que o PGR e as medidas sao de responsabilidade da empresa e que o Equilibra e uma ferramenta de apoio."', 50, curY + 30);
      } else {
        doc.fillColor(mutedText).fontSize(9).font('Helvetica-Bold')
          .text('TERMO DE ACEITE: PENDENTE', 50, curY + 8);
        doc.fontSize(8).font('Helvetica')
          .text('Este relatorio ainda nao possui termo de aceite registrado pela lideranca de RH/SST no sistema.', 50, curY + 22);
      }

      // Rodapé em todas as páginas
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.rect(40, 800, 515, 1).fill(borderCol);
        doc.fillColor(mutedText).fontSize(7).font('Helvetica')
          .text(`Confidencial  |  Exportado por ${userName} em ${genTime}  |  Hash: ${hash}`, 40, 808)
          .text(`Pagina ${i + 1} de ${range.count}`, 490, 808, { align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Exportação em JSON sanitizado.
 */
function generateJson(report) {
  const clone = structuredClone(report);
  delete clone.memberIds;
  delete clone.tokenHash;
  delete clone.passwordHash;
  return clone;
}

/**
 * Exportação consolidada do histórico de todos os ciclos da empresa em Excel (.xlsx).
 */
async function generateHistoryXlsx(reports, account) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Equilibra Web';
  workbook.created = new Date();

  const brandFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF581C43' } // Deep Mulberry
  };
  const headerFont = {
    name: 'Arial',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' }
  };

  // Aba 1: Histórico de Ciclos
  const sheetSummary = workbook.addWorksheet('Histórico de Ciclos');
  sheetSummary.views = [{ state: 'frozen', ySplit: 1 }];
  sheetSummary.columns = [
    { header: 'Ciclo', key: 'cycle', width: 14 },
    { header: 'Título da Pesquisa', key: 'title', width: 34 },
    { header: 'Instrumento', key: 'model', width: 18 },
    { header: 'Grupo / Abrangência', key: 'group', width: 22 },
    { header: 'Encerramento', key: 'closedAt', width: 14 },
    { header: 'Convidados', key: 'invited', width: 12 },
    { header: 'Respondentes', key: 'responses', width: 14 },
    { header: 'Adesão (%)', key: 'rate', width: 12 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Média Global', key: 'overallAvg', width: 14 },
    { header: 'Termo de Aceite', key: 'acceptance', width: 24 }
  ];

  sheetSummary.getRow(1).fill = brandFill;
  sheetSummary.getRow(1).font = headerFont;
  sheetSummary.getRow(1).height = 24;

  const sortedReports = [...reports].sort((a, b) => new Date(b.closedAt || 0) - new Date(a.closedAt || 0));

  for (const r of sortedReports) {
    const rate = r.invitedCount > 0 ? `${Math.round((r.responseCount / r.invitedCount) * 100)}%` : '-';
    let overallAvg = '-';
    if (r.published && Array.isArray(r.result) && r.result.length > 0) {
      const avg = r.result.reduce((s, f) => s + (f.average || 0), 0) / r.result.length;
      overallAvg = avg.toFixed(2).replace('.', ',');
    }
    const acceptance = r.acceptance ? `Aceito por ${r.acceptance.userName || 'Responsável'}` : 'Pendente';

    sheetSummary.addRow({
      cycle: r.cycle || '-',
      title: r.title || '-',
      model: r.model || r.instrument?.name || '-',
      group: r.groupName || '-',
      closedAt: (r.closedAt || '').slice(0, 10),
      invited: r.invitedCount || 0,
      responses: r.responseCount || 0,
      rate,
      status: r.published ? 'Publicado' : 'Protegido',
      overallAvg,
      acceptance
    });
  }

  // Aba 2: Evolução por Fator (para os ciclos publicados)
  const publishedReports = sortedReports.filter(r => r.published && Array.isArray(r.result));
  if (publishedReports.length > 0) {
    const sheetFactors = workbook.addWorksheet('Evolução por Fator');
    sheetFactors.views = [{ state: 'frozen', ySplit: 1 }];

    const factorMap = new Map();
    for (const r of publishedReports) {
      for (const f of r.result) {
        if (!factorMap.has(f.key)) factorMap.set(f.key, f.label || f.key);
      }
    }

    const factorCols = [
      { header: 'Fator / Tema', key: 'factor', width: 28 }
    ];
    for (const r of publishedReports) {
      factorCols.push({
        header: `${r.cycle || r.title} (${(r.closedAt || '').slice(0, 7)})`,
        key: `cycle_${r.id}`,
        width: 18
      });
    }
    sheetFactors.columns = factorCols;
    sheetFactors.getRow(1).fill = brandFill;
    sheetFactors.getRow(1).font = headerFont;
    sheetFactors.getRow(1).height = 24;

    for (const [key, label] of factorMap.entries()) {
      const rowData = { factor: label };
      for (const r of publishedReports) {
        const f = r.result.find(item => item.key === key);
        rowData[`cycle_${r.id}`] = f && typeof f.average === 'number' ? f.average.toFixed(2).replace('.', ',') : '-';
      }
      sheetFactors.addRow(rowData);
    }
  }

  // Aba 3: Metodologia
  const sheetMethod = workbook.addWorksheet('Metodologia & Honestidade');
  sheetMethod.columns = [{ header: 'Parâmetro', key: 'k', width: 25 }, { header: 'Diretriz Técnica', key: 'v', width: 70 }];
  sheetMethod.getRow(1).fill = brandFill;
  sheetMethod.getRow(1).font = headerFont;
  sheetMethod.addRow({ k: 'Empresa', v: account?.company || 'Equilibra' });
  sheetMethod.addRow({ k: 'Data da Extração', v: new Date().toISOString() });
  sheetMethod.addRow({ k: 'Proteção de Sigilo', v: 'Mínimo de 5 respostas exigidas para publicação de dados coletivos. Células menores são suprimidas ou agrupadas.' });
  sheetMethod.addRow({ k: 'Escala Adotada', v: 'Likert de 1 a 5 (1 = Maior percepção negativa / 5 = Maior percepção positiva).' });
  sheetMethod.addRow({ k: 'Aviso Legal', v: 'Relatório para instrução de gestão interna de SST e PGR. Não constitui laudo pericial, diagnóstico médico ou psicológico individual.' });

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  getExportFileName,
  computeContentHash,
  logExportAudit,
  generateCsv,
  generateXlsx,
  generateHistoryXlsx,
  generatePdf,
  generateJson
};
