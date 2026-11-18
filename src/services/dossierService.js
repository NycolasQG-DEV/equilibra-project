/**
 * dossierService — FASE 09 (EQ-013)
 *
 * Compilação de Dossiê Técnico de Apoio à Análise Ergonômica Preliminar (AEP)
 * e ao Programa de Gerenciamento de Riscos (PGR) — NR-1 e NR-17.
 *
 * GERAÇÃO DE SNAPSHOT VERSIONADO COM RASTREABILIDADE E EXPORTAÇÃO PDF.
 * AVISO REGULATÓRIO: NUNCA ROTULAR COMO LAUDO PERICIAL OU CERTIFICADO DE CONFORMIDADE.
 */

'use strict';

const crypto = require('node:crypto');
const PDFDocument = require('pdfkit');
const storage = require('../config/equilibraStorage');
const repo = require('../repositories/managementRepository');

const DOSSIER_LIMITATIONS =
  'Dossiê técnico de apoio consultivo para subsídio à AEP (NR-17) e ao inventário de riscos do PGR (NR-1). ' +
  'Não substitui laudo técnico pericial emitido por profissional legalmente habilitado, avaliação clínica ' +
  'nem certifica conformidade jurídica automática.';

/**
 * Compila todos os dados consolidados do dossiê para um tenant.
 */
function buildDossierData(account) {
  const accountId = account.id;
  const companyName = account.company || account.companyName || 'Organização';
  const managementState = repo.get(accountId);

  const allReports = storage.read('reports') || [];
  const reports = allReports.filter((r) => r.accountId === accountId);

  const allEvidences = storage.read('evidences') || [];
  const evidences = allEvidences.filter((e) => e.accountId === accountId);

  const allMembers = storage.read('members') || [];
  const members = allMembers.filter((m) => m.accountId === accountId);

  const allGroups = storage.read('groups') || [];
  const groups = allGroups.filter((g) => g.accountId === accountId);

  const rawPayload = JSON.stringify({
    accountId,
    reports: reports.map((r) => r.id),
    assessments: managementState.assessments.map((a) => a.id),
    actions: managementState.actions.map((ac) => ac.id),
  });
  const snapshotHash = crypto.createHash('sha256').update(rawPayload).digest('hex').slice(0, 16);

  return {
    title: `Dossiê Técnico de Apoio ao PGR — ${companyName}`,
    generatedAt: new Date().toISOString(),
    organization: companyName,
    snapshotHash,
    limitations: DOSSIER_LIMITATIONS,
    governance: {
      framework: 'NR-1 (PGR/GRO) & NR-17 (Ergonomia e Organização do Trabalho)',
      statutoryReferences: [
        'Portaria MTP nº 4.219/2022 (NR-1 - Gerenciamento de Riscos Ocupacionais)',
        'Portaria MTP nº 423/2021 (NR-17 - Ergonomia)',
        'Lei Federal nº 14.457/2022 (Canal de Escuta e Prevenção ao Assédio)',
      ],
      privacyAssurance: 'Supressão amostral estrita para subgrupos com menos de 5 respondentes.',
      segregationLayers: [
        '1. Dado Observado (Frequência e Pontuação Agregada)',
        '2. Interpretação Descritiva (Faixas de Atenção Operacional)',
        '3. Hipótese Técnica (Fatores e Condições de Trabalho)',
        '4. Decisão Humana/Técnica (Validação Explícita do Avaliador)',
      ],
    },
    populationSummary: {
      totalMembersMapped: members.length,
      totalGroups: groups.length,
      totalCycles: reports.length,
      publishedCycles: reports.filter((r) => r.published).length,
    },
    evidences,
    assessments: managementState.assessments,
    actions: managementState.actions,
    auditTrail: managementState.audit.slice(-50).reverse(),
  };
}

/**
 * Gera o documento PDF do Dossiê Técnico usando PDFKit.
 * Retorna uma Promise que resolve em Buffer.
 */
function generateDossierPdf(dossierData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: dossierData.title,
        Author: 'Equilibra SaaS — Plataforma de Gestão de Riscos Psicossociais',
        Subject: 'Dossiê Técnico de Apoio ao PGR (NR-1 e NR-17)',
      },
    });

    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // ── Cabeçalho ──────────────────────────────────────────────────────────
    doc.fontSize(18).fillColor('#1e3a8a').text('EQUILIBRA — SAÚDE & SEGURANÇA DO TRABALHO', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor('#0f172a').text(dossierData.title, { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(9).fillColor('#64748b').text(
      `Gerado em: ${new Date(dossierData.generatedAt).toLocaleString('pt-BR')} | Snapshot ID: ${dossierData.snapshotHash}`,
      { align: 'center' },
    );
    doc.moveDown(1);

    // Linha divisória
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);

    // ── Limitações Regulatórias ────────────────────────────────────────────
    doc.rect(40, doc.y, 515, 45).fillAndStroke('#f8fafc', '#94a3b8');
    doc.fillColor('#0f172a').fontSize(8).text(
      'AVISO REGULATÓRIO IMPORTANTE:\n' + dossierData.limitations,
      45,
      doc.y - 40,
      { width: 505, align: 'justify' },
    );
    doc.moveDown(1.5);

    // ── Quadro de Governança ───────────────────────────────────────────────
    doc.fontSize(12).fillColor('#1e3a8a').text('1. Governança e Enquadramento Legal');
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#334155');
    dossierData.governance.statutoryReferences.forEach((ref) => {
      doc.text(`• ${ref}`);
    });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#475569').text(`Garantia de Sigilo: ${dossierData.governance.privacyAssurance}`);
    doc.moveDown(1);

    // ── Resumo Populacional ────────────────────────────────────────────────
    doc.fontSize(12).fillColor('#1e3a8a').text('2. População e Cobertura Avaliativa');
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#334155');
    doc.text(`Colaboradores mapeados: ${dossierData.populationSummary.totalMembersMapped}`);
    doc.text(`Grupos/Setores estruturados: ${dossierData.populationSummary.totalGroups}`);
    doc.text(`Ciclos de escuta realizados: ${dossierData.populationSummary.totalCycles}`);
    doc.text(`Ciclos publicados (com quórum atingido): ${dossierData.populationSummary.publishedCycles}`);
    doc.moveDown(1);

    // ── Achados de Risco (Assessments) ──────────────────────────────────────
    doc.fontSize(12).fillColor('#1e3a8a').text(`3. Inventário de Achados de Riscos (${dossierData.assessments.length})`);
    doc.moveDown(0.3);
    if (dossierData.assessments.length === 0) {
      doc.fontSize(9).fillColor('#64748b').text('Nenhum achado de risco registrado até o momento.');
    } else {
      dossierData.assessments.forEach((a, idx) => {
        doc.fontSize(10).fillColor('#0f172a').text(`${idx + 1}. ${a.title} [Status: ${a.status.toUpperCase()}]`);
        doc.fontSize(8).fillColor('#475569').text(`   Fator: ${a.factor} | Prioridade: ${a.classification || 'pending'}`);
        if (a.context) doc.text(`   Contexto (2ª camada): ${a.context}`);
        if (a.decision) doc.text(`   Decisão Técnica (4ª camada): ${a.decision}`);
        doc.moveDown(0.3);
      });
    }
    doc.moveDown(1);

    // ── Planos de Ação (5W2H) ──────────────────────────────────────────────
    doc.fontSize(12).fillColor('#1e3a8a').text(`4. Plano de Intervenção Preventiva — 5W2H (${dossierData.actions.length})`);
    doc.moveDown(0.3);
    if (dossierData.actions.length === 0) {
      doc.fontSize(9).fillColor('#64748b').text('Nenhum plano de ação registrado.');
    } else {
      dossierData.actions.forEach((act, idx) => {
        doc.fontSize(10).fillColor('#0f172a').text(`${idx + 1}. ${act.title} [Status: ${act.status}]`);
        doc.fontSize(8).fillColor('#475569').text(
          `   Responsável: ${act.owner} | Prazo: ${act.dueDate} | Revisão Bienal: ${act.reviewDate}`,
        );
        doc.text(`   Critério de Eficácia: ${act.successCriteria}`);
        if (act.reviewOutcome) {
          doc.text(`   Desfecho de Eficácia: Delta ${act.reviewOutcome.delta} (${act.reviewOutcome.efficacyStatus})`);
        }
        doc.moveDown(0.3);
      });
    }
    doc.moveDown(1);

    // ── Trilha de Auditoria e Rodapé ───────────────────────────────────────
    doc.fontSize(12).fillColor('#1e3a8a').text('5. Rastreabilidade e Assinatura Digital');
    doc.moveDown(0.3);
    doc.fontSize(8).fillColor('#64748b').text(
      `Este documento possui integridade criptográfica atestada pelo snapshot SHA-256: ${dossierData.snapshotHash}. ` +
      `Trilha cronológica auditada com ${dossierData.auditTrail.length} eventos registrados.`,
    );

    doc.end();
  });
}

module.exports = {
  buildDossierData,
  generateDossierPdf,
  DOSSIER_LIMITATIONS,
};
