// src/domain/contextualInsights.js
// Motor de Insights Contextuais — Equilibra
// Converte dados brutos em diagnósticos significativos por tipo de instrumento.
// Módulo puro (sem I/O). Determinístico para o mesmo conjunto de dados.

'use strict';

const LIMIAR = { atencao: 2.80, cuidado_max: 3.59, adequado: 3.60 };

function nivel(avg) {
  if (avg < LIMIAR.atencao) return 'atencao';
  if (avg < LIMIAR.adequado) return 'cuidado';
  return 'adequado';
}

function sortAsc(factors) { return [...factors].sort((a, b) => a.average - b.average); }
function sortDesc(factors) { return [...factors].sort((a, b) => b.average - a.average); }
function avg(factors) {
  if (!factors.length) return 0;
  return factors.reduce((s, f) => s + f.average, 0) / factors.length;
}
function fmtN(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }

// ─── Catálogo de Recomendações Contextuais ───────────────────────────────────

const RECOMENDACOES = {
  'nr1-pgr': {
    volume:        { urgencia: 'alta',  acao: 'Revisar distribuição de tarefas e recalibrar capacidade operacional com o gestor da equipe.' },
    ritmo:         { urgencia: 'alta',  acao: 'Investigar picos de pressão temporal e redesenhar prazos com metodologia realista.' },
    clareza:       { urgencia: 'media', acao: 'Revisar descrições de cargo, atribuições e metas com as lideranças.' },
    prioridades:   { urgencia: 'media', acao: 'Implantar rituais de alinhamento semanal e sistema visual de priorização (ex: kanban).' },
    autonomia:     { urgencia: 'media', acao: 'Mapear decisões delegáveis e ampliar margem decisória dos colaboradores.' },
    recursos:      { urgencia: 'alta',  acao: 'Inventariar lacunas de ferramentas e infraestrutura; incluir no cronograma do PGR.' },
    apoio_gestao:  { urgencia: 'alta',  acao: 'Capacitar lideranças em escuta ativa e suporte operacional contínuo.' },
    cooperacao:    { urgencia: 'media', acao: 'Promover dinâmicas de colaboração e clarificar interdependências entre setores.' },
    respeito:      { urgencia: 'alta',  acao: 'Reforçar código de conduta e canais de mediação de conflitos no ambiente.' },
    reconhecimento:{ urgencia: 'media', acao: 'Implantar práticas de reconhecimento formal e feedback frequente.' },
    descanso:      { urgencia: 'alta',  acao: 'Auditar jornadas, banco de horas e pausas; regularizar conforme NR-17 e CLT.' },
    comunicacao:   { urgencia: 'media', acao: 'Aprimorar antecedência e clareza nos comunicados sobre mudanças organizacionais.' },
  },
  'copsoq': {
    volume_quantitativo: { urgencia: 'alta',  acao: 'Mapear acúmulo de tarefas e instituir limite de trabalho em progresso (WIP).' },
    prazos_pressao:      { urgencia: 'alta',  acao: 'Renegociar prazos com stakeholders; inserir buffer de segurança no cronograma.' },
    ritmo_continuo:      { urgencia: 'alta',  acao: 'Introduzir pausas estruturadas e blocos de trabalho focado (deep work).' },
    interrupcoes:        { urgencia: 'media', acao: 'Criar acordos de foco na equipe e reduzir reuniões/notificações dispensáveis.' },
    demandas_cognitivas: { urgencia: 'media', acao: 'Revisar complexidade das tarefas e fornecer capacitação técnica especializada.' },
    demandas_emocionais: { urgencia: 'alta',  acao: 'Capacitar lideranças em suporte emocional e estruturar canal de acolhimento (EAP).' },
  },
  'psych-safety': {
    expressao_segura:       { urgencia: 'alta',  acao: 'Treinamento de lideranças em cultura de feedback e acolhimento de divergências.' },
    aceitacao_erros:        { urgencia: 'alta',  acao: 'Instituir retrospectivas sem culpa focadas no aprendizado sistêmico de falhas.' },
    valorizacao_diferencas: { urgencia: 'alta',  acao: 'Realizar formação em diversidade e inclusão; revisar critérios de promoção.' },
    tomada_risco:           { urgencia: 'media', acao: 'Criar espaços seguros para inovação com ciclos curtos de experimentação.' },
    clareza_decisao:        { urgencia: 'media', acao: 'Mapear e formalizar a autonomia decisória atribuída a cada função.' },
    ajuda_mutua:            { urgencia: 'media', acao: 'Fomentar cultura de cooperação interdepartamental e reduzir barreiras hierárquicas.' },
  },
  'burnout': {
    energia_vital:          { urgencia: 'alta',  acao: 'Avaliar sobrecarga crônica na equipe; redistribuir tarefas críticas imediatamente.' },
    desconexao_mental:      { urgencia: 'alta',  acao: 'Instituir política formal de desconexão digital fora do expediente (sem mensagens pós-horário).' },
    sobrecarga_emocional:   { urgencia: 'alta',  acao: 'Disponibilizar plantão de acolhimento psicológico e suporte ao estresse crônico.' },
    proposito_trabalho:     { urgencia: 'media', acao: 'Reconectar metas operacionais ao impacto real e valor gerado pela equipe.' },
    realizacao_competencia: { urgencia: 'media', acao: 'Fornecer feedback de desenvolvimento e reconhecimento do domínio técnico.' },
    recuperacao_sono:       { urgencia: 'alta',  acao: 'Auditar escalas de trabalho, turnos e horas extras excessivas.' },
  },
  'assedio-compliance': {
    tratamento_digno:       { urgencia: 'alta',  acao: 'Reforçar campanha de tolerância zero a desrespeito e condutas abusivas.' },
    prevencao_moral:        { urgencia: 'alta',  acao: 'Capacitar lideranças contra cobranças vexatórias e metas inalcançáveis.' },
    prevencao_sexual:       { urgencia: 'alta',  acao: 'Treinamento obrigatório da CIPA sobre assédio sexual conforme Lei 14.457/22.' },
    equidade_inclusao:      { urgencia: 'media', acao: 'Revisar políticas de equidade e representatividade em todos os níveis.' },
    conhecimento_canal:     { urgencia: 'alta',  acao: 'Divulgar massivamente o canal de denúncias independente e o anonimato garantido.' },
    confianca_antirretaliacao:{ urgencia: 'alta',acao: 'Garantir formalmente a proteção e o sigilo de denunciantes e testemunhas.' },
  },
  'lideranca': {
    suporte_gestor:        { urgencia: 'alta',  acao: 'Capacitar gestores em liderança servidora e rotinas de alinhamento individual (1:1s).' },
    escuta_ativa:          { urgencia: 'alta',  acao: 'Criar canais abertos de escuta e implementar sugestões da equipe na rotina.' },
    justica_procedimental: { urgencia: 'alta',  acao: 'Tornar critérios de promoção, avaliação e distribuição de trabalho 100% transparentes.' },
    feedback_util:         { urgencia: 'media', acao: 'Estruturar ciclos periódicos de feedback focados no desenvolvimento contínuo.' },
    valorizacao:           { urgencia: 'media', acao: 'Criar práticas institucionais de reconhecimento de mérito e esforço.' },
    confianca_lideranca:   { urgencia: 'alta',  acao: 'Auditar coerência entre discurso e práticas da liderança imediata.' },
  },
  'transicao': {
    comunicacao_previa:    { urgencia: 'alta',  acao: 'Aumentar a antecedência e detalhamento das comunicações sobre mudanças.' },
    clareza_motivos:       { urgencia: 'alta',  acao: 'Explicitar o propósito estratégico da transição e o impacto esperado no time.' },
    espaco_duvidas:        { urgencia: 'media', acao: 'Criar sessões de Perguntas e Respostas abertas com os líderes da transição.' },
    treinamento_adaptacao: { urgencia: 'alta',  acao: 'Oferecer capacitação prévia e suporte prático nas novas ferramentas/processos.' },
    suporte_transicao:     { urgencia: 'alta',  acao: 'Designar facilitadores de mudança em cada departamento durante a transição.' },
  },
  'pulso': {
    volume_estavel:        { urgencia: 'alta',  acao: 'Identificar gargalos sazonais que geraram acúmulo de trabalho neste mês.' },
    suporte_acessivel:     { urgencia: 'alta',  acao: 'Garantir disponibilidade da liderança para destravamento de pendências diárias.' },
    respeito_cotidiano:    { urgencia: 'alta',  acao: 'Intervir pontualmente em conflitos entre equipes antes que escalem.' },
    descanso_adequado:     { urgencia: 'alta',  acao: 'Conceder folgas compensatórias e assegurar respeito aos intervalos de almoço.' },
  },
  'eficacia': {
    conhecimento_plano:    { urgencia: 'alta',  acao: 'Apresentar o Plano de Ação NR-1 em reunião de equipe com linguagem acessível.' },
    aplicacao_real:        { urgencia: 'alta',  acao: 'Auditar no chão de fábrica/escritório se as medidas do PGR foram realmente adotadas.' },
    melhoria_percebida:    { urgencia: 'alta',  acao: 'Redesenhar medidas com baixa efetividade ouvindo quem executa a rotina.' },
    facilidade_acesso:     { urgencia: 'alta',  acao: 'Eliminar burocracias no acesso às ferramentas e recursos preventivos disponibilizados.' },
    canal_feedback_nr1:    { urgencia: 'media', acao: 'Implantar canal rápido para sugestões e ajustes contínuos nas medidas do PGR.' },
  }
};

// ─── Narrativas Especializadas por Instrumento ──────────────────────────────

const NARRATIVAS = {
  'burnout': {
    intro: 'Avaliação psicossocial focada no Inventário Maslach (MBI Triad): exaustão emocional, cinismo/despersonalização e eficácia profissional.',
    critico: (fatores) => `Alerta de Risco Severo de Esgotamento: Os fatores ${fatores.map(f => `"${f.label}" (${fmtN(f.average)})`).join(', ')} indicam sobrecarga crônica insustentável. Há probabilidade real de absenteísmo com nexo causal no período.`,
    atencao: (fatores) => `Risco Moderado de Esgotamento: Indicadores de tensão detectados em ${fatores.length} dimensão(ões): ${fatores.map(f => `"${f.label}" (${fmtN(f.average)})`).join(', ')}. Intervenções de alívio de carga são necessárias.`,
    adequado: () => 'Estabilidade Emocional: Os índices de disposição, desconexão e realização profissional situam-se em níveis saudáveis e sustentáveis.',
  },
  'psych-safety': {
    intro: 'Diagnóstico da Segurança Psicológica de Amy Edmondson: mensuração da liberdade para expressar ideias, acolhimento de erros e confiança mútua.',
    critico: (fatores) => `Clima de Silêncio e Inibição: Indicadores críticos em ${fatores.map(f => `"${f.label}" (${fmtN(f.average)})`).join(', ')} revelam medo de julgamento ou retaliação. Risco agudo à inovação e retenção de talentos.`,
    atencao: (fatores) => `Abertura Psicológica Parcial: A equipe aponta insegurança em ${fatores.map(f => `"${f.label}"`).join(', ')}. Necessário treinamento de lideranças em cultura de acolhimento e aprendizado com falhas.`,
    adequado: () => 'Ambiente de Alta Confiança: Os colaboradores sentem-se plenamente seguros para inovar, admitir erros e pedir ajuda sem constrangimento.',
  },
  'copsoq': {
    intro: 'Diagnóstico de Exigências Psicológicas e Carga de Trabalho segundo o modelo COPSOQ II (Copenhague).',
    critico: (fatores) => `Sobrecarga Operacional e Cognitiva: Dimensões ${fatores.map(f => `"${f.label}" (${fmtN(f.average)})`).join(', ')} atingiram níveis de estresse ocupacional desfavorável.`,
    atencao: (fatores) => `Equilíbrio Tênue de Carga: Pressão de prazos e ritmo elevado observados em ${fatores.map(f => f.label).join(', ')}. Ajuste de capacidade de equipe recomendado.`,
    adequado: () => 'Carga e Ritmo Equilibrados: O volume de trabalho e as demandas emocionais mantêm-se em patamares compatíveis com a saúde mental dos times.',
  },
  'assedio-compliance': {
    intro: 'Auditoria de Conformidade Legal CIPA & Prevenção ao Assédio conforme a Lei 14.457/22.',
    critico: (fatores) => `Alerta de Risco Jurídico Trabalhista: Vulnerabilidade crítica em ${fatores.map(f => `"${f.label}"`).join(', ')}. Ação preventiva obrigatória da CIPA e reforço imediato do canal ético.`,
    atencao: (fatores) => `Conformidade Parcial: Indicadores de confiança no canal ou civilidade exigem revisão em: ${fatores.map(f => f.label).join(', ')}.`,
    adequado: () => 'Ambiente Respeitoso e Protegido: Elevada percepção de civilidade e total confiança no canal de denúncias independente.',
  },
  'lideranca': {
    intro: 'Avaliação de Suporte da Liderança e Justiça Organizacional (critérios de mérito, escuta e diálogo).',
    critico: (fatores) => `Ruptura na Confiança com a Gestão: Scores críticos em ${fatores.map(f => `"${f.label}"`).join(', ')} apontam sentimento de injustiça ou ausência de suporte da chefia direta.`,
    atencao: (fatores) => `Lacunas no Diálogo com a Liderança: Melhorias necessárias na qualidade do feedback e suporte em: ${fatores.map(f => f.label).join(', ')}.`,
    adequado: () => 'Liderança Apoiadora: A gestão imediata é percebida como presente, justa e promotora do desenvolvimento da equipe.',
  },
  'transicao': {
    intro: 'Acompanhamento do Impacto de Mudanças Organizacionais e Prontidão de Transição.',
    critico: (fatores) => `Resistência e Ansiedade de Mudança: Falhas graves de comunicação ou capacitação em ${fatores.map(f => `"${f.label}"`).join(', ')}.`,
    atencao: (fatores) => `Adaptação Lenta: O time necessita de maior clareza de motivos e capacitação técnica em: ${fatores.map(f => f.label).join(', ')}.`,
    adequado: () => 'Transição Fluida: A equipe compreende e adota as novas diretrizes com estabilidade e apoio.',
  },
  'pulso': {
    intro: 'Termômetro Ágil Mensal: monitoramento rápido dos pilares de volume, apoio, respeito e descanso.',
    critico: (fatores) => `Queda Abrupta no Clima Mensal: Alerta emitido nos fatores ${fatores.map(f => `"${f.label}"`).join(', ')}. Ação corretiva requerida antes do próximo ciclo.`,
    atencao: (fatores) => `Atenção Pontual: Flutuação negativa identificada em ${fatores.map(f => f.label).join(', ')}.`,
    adequado: () => 'Estabilidade Confirmada: Os pilares psicossociais mantêm-se consolidados neste mês.',
  },
  'eficacia': {
    intro: 'Auditoria de Eficácia Prática das Medidas Preventivas adotadas no Plano de Ação PGR / NR-1.',
    critico: (fatores) => `Medidas Burocráticas sem Efeito Prático: Fatores ${fatores.map(f => `"${f.label}" (${fmtN(f.average)})`).join(', ')} indicam que as ações não estão surtindo efeito na rotina da equipe.`,
    atencao: (fatores) => `Eficácia Parcial: Necessário aprimorar a divulgação e facilidade de acesso às ferramentas em: ${fatores.map(f => f.label).join(', ')}.`,
    adequado: () => 'Alto Impacto Preventivo: Os colaboradores percebem e validam as melhorias na rotina trazidas pelas medidas do PGR.',
  },
  'hse-nr1': {
    intro: 'Diagnóstico Amplo HSE: 7 subescalas de estresse ocupacional conforme padrões do Health & Safety Executive.',
    critico: (fatores) => `Exposição Severa a Estressores Ocupacionais: Subescalas ${fatores.map(f => `"${f.label}"`).join(', ')} exigem inclusão imediata na matriz de risco do PGR.`,
    atencao: (fatores) => `Atenção em Subescalas HSE: Demandas ou controle abaixo do padrão em: ${fatores.map(f => f.label).join(', ')}.`,
    adequado: () => 'Padrões HSE Atendidos: Distribuição saudável em todas as subescalas de trabalho.',
  },
  'nr1-pgr': {
    intro: 'Diagnóstico Amplo de Condições e Organização do Trabalho conforme a Portaria MTE NR-1 (12 Fatores).',
    critico: (fatores) => `Fatores de Risco Psicossocial Críticos (NR-1): ${fatores.length} fator(es) em nível de atenção máxima (${fatores.map(f => `"${f.label}"`).join(', ')}). Exige plano de ação corretivo obrigatório no inventário de riscos.`,
    atencao: (fatores) => `Fatores em Zona de Cuidado NR-1: ${fatores.length} dimensão(ões) em alerta preventivo: ${fatores.map(f => f.label).join(', ')}.`,
    adequado: () => 'Conformidade Psicossocial Plena: Todos os 12 fatores de organização do trabalho operam dentro de padrões adequados.',
  }
};

// ─── Motor Principal de Classificação ───────────────────────────────────────

function _detectType(report) {
  if (report.instrument?.dashboardType) return report.instrument.dashboardType;
  const name = String(report.model || report.instrument?.name || '').toLowerCase();
  if (name.includes('hse')) return 'hse-nr1';
  if (name.includes('maslach') || name.includes('burnout')) return 'burnout';
  if (name.includes('edmondson') || name.includes('segurança')) return 'psych-safety';
  if (name.includes('assédio') || name.includes('14.457') || name.includes('respeito')) return 'assedio-compliance';
  if (name.includes('copsoq') || name.includes('demandas')) return 'copsoq';
  if (name.includes('liderança') || name.includes('lideranca')) return 'lideranca';
  if (name.includes('mudanças') || name.includes('transição') || name.includes('transicao')) return 'transicao';
  if (name.includes('pulso')) return 'pulso';
  if (name.includes('eficácia') || name.includes('eficacia') || name.includes('medidas')) return 'eficacia';
  return 'nr1-pgr';
}

function _calcRiskScore(factors, type) {
  if (!factors.length) return 0;
  const media = avg(factors);
  // Escala invertida: se média é 1.0 (muito ruim) -> risco 100%; se 5.0 (ótimo) -> risco 0%
  const scoreRaw = Math.max(0, Math.min(100, Math.round(((5.0 - media) / 4.0) * 100)));
  return scoreRaw;
}

function _buildDiagnostico(factors, type, riskScore) {
  const labels = {
    'burnout': 'Risco de Esgotamento Profissional (MBI)',
    'psych-safety': 'Índice de Segurança Psicológica (Edmondson)',
    'assedio-compliance': 'Conformidade Lei 14.457/22 & Canal Ético',
    'copsoq': 'Balanço de Carga & Demandas (COPSOQ II)',
    'lideranca': 'Índice de Suporte e Justiça da Liderança',
    'transicao': 'Prontidão à Mudança Organizacional',
    'pulso': 'Estabilidade Psicossocial Mensal',
    'eficacia': 'Efetividade Prática das Medidas PGR',
    'hse-nr1': 'Perfil de Risco Ocupacional HSE',
    'nr1-pgr': 'Índice de Risco Psicossocial NR-1 / GRO',
  };

  const nivelDesc = riskScore >= 55 ? 'crítico' : riskScore >= 35 ? 'moderado' : 'baixo';
  const descricoes = {
    crítico: 'Exposição psicossocial desfavorável. Intervenção prioritária com plano corretivo exigida no PGR.',
    moderado: 'Vulnerabilidades pontuais identificadas. Medidas preventivas e monitoramento sistemático indicados.',
    baixo: 'Condições psicossociais favoráveis. Ações de sustentação e boas práticas recomendadas.',
  };

  return {
    label: labels[type] || 'Score de Risco Psicossocial',
    score: riskScore,
    nivel: nivelDesc,
    descricao: descricoes[nivelDesc],
    mediaGeral: Math.round(avg(factors) * 100) / 100,
  };
}

function _buildRecomendacoes(factors, type) {
  const catalog = RECOMENDACOES[type] || RECOMENDACOES['nr1-pgr'];
  const results = [];

  const prioritized = [
    ...sortAsc(factors.filter(f => f.average < LIMIAR.atencao)),
    ...sortAsc(factors.filter(f => f.average >= LIMIAR.atencao && f.average < LIMIAR.adequado)),
  ].slice(0, 5);

  const fallbackPriority = prioritized.length > 0 ? prioritized : sortAsc(factors).slice(0, 3);

  for (const f of fallbackPriority) {
    const rec = catalog[f.key];
    const isCrit = f.average < LIMIAR.atencao;
    results.push({
      fatorKey: f.key,
      fatorLabel: f.label || f.key,
      media: f.average,
      nivel: isCrit ? 'atencao' : 'cuidado',
      urgencia: rec ? rec.urgencia : (isCrit ? 'imediata' : 'alta'),
      acao: rec ? rec.acao : `Reavaliar as condições de "${f.label || f.key}" (média ${fmtN(f.average)}) e pactuar melhorias com a equipe no PGR.`,
      prazo: isCrit ? '30 dias' : '60 dias',
      responsavel: 'RH / SST e Gestão Imediata'
    });
  }

  return results;
}

function _buildKpisContextuais(factors, type, report) {
  const kpis = [];

  const add = (label, valor, sufixo = '', cor = null) => {
    const num = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(',', '.'));
    const isNum = !isNaN(num);
    const colorFinal = cor || (isNum ? (num >= 3.6 ? 'success' : num >= 2.8 ? 'warning' : 'danger') : 'neutral');
    const formatted = `${isNum && sufixo !== '%' ? fmtN(num) : valor}${sufixo ? ' ' + sufixo : ''}`;

    kpis.push({
      label,
      valor,
      value: formatted,
      formatted,
      sufixo,
      sub: sufixo === '%' ? 'Adesão da equipe' : 'Escala de 1 a 5',
      cor: colorFinal,
      status: colorFinal
    });
  };

  switch (type) {
    case 'burnout': {
      const exaustao = factors.find(f => ['energia_vital', 'sobrecarga_emocional', 'recuperacao_sono'].includes(f.key));
      const cinismo = factors.find(f => ['desconexao_mental', 'relacoes'].includes(f.key));
      const eficacia = factors.find(f => ['realizacao_competencia', 'proposito_trabalho'].includes(f.key));
      if (exaustao) add('Exaustão Emocional', exaustao.average, '/ 5', exaustao.average < 2.8 ? 'danger' : 'warning');
      if (cinismo) add('Desconexão / Cinismo', cinismo.average, '/ 5', cinismo.average < 2.8 ? 'danger' : 'warning');
      if (eficacia) add('Eficácia Profissional', eficacia.average, '/ 5', eficacia.average >= 3.6 ? 'success' : 'warning');
      break;
    }
    case 'psych-safety': {
      const expressao = factors.find(f => f.key === 'expressao_segura');
      const erros = factors.find(f => f.key === 'aceitacao_erros');
      const inovacao = factors.find(f => f.key === 'tomada_risco');
      if (expressao) add('Liberdade de Expressão', expressao.average, '/ 5', expressao.average >= 3.6 ? 'success' : 'danger');
      if (erros) add('Cultura de Aprendizado', erros.average, '/ 5', erros.average >= 3.6 ? 'success' : 'warning');
      if (inovacao) add('Propensão à Inovação', inovacao.average, '/ 5', inovacao.average >= 3.6 ? 'success' : 'warning');
      break;
    }
    case 'copsoq': {
      const vol = factors.find(f => ['volume_quantitativo', 'prazos_pressao'].includes(f.key));
      const ritmo = factors.find(f => ['ritmo_continuo', 'interrupcoes'].includes(f.key));
      const emoc = factors.find(f => f.key === 'demandas_emocionais');
      if (vol) add('Pressão de Volume e Prazos', vol.average, '/ 5', vol.average < 2.8 ? 'danger' : 'warning');
      if (ritmo) add('Sustentabilidade do Ritmo', ritmo.average, '/ 5', ritmo.average >= 3.6 ? 'success' : 'warning');
      if (emoc) add('Demandas Emocionais', emoc.average, '/ 5', emoc.average < 2.8 ? 'danger' : 'warning');
      break;
    }
    case 'assedio-compliance': {
      const canal = factors.find(f => f.key === 'conhecimento_canal');
      const protecao = factors.find(f => f.key === 'confianca_antirretaliacao');
      const respeito = factors.find(f => ['tratamento_digno', 'prevencao_moral'].includes(f.key));
      if (canal) add('Acesso ao Canal Ético', canal.average, '/ 5', canal.average >= 3.6 ? 'success' : 'warning');
      if (protecao) add('Garantia Antirretaliação', protecao.average, '/ 5', protecao.average >= 3.6 ? 'success' : 'danger');
      if (respeito) add('Cultura de Civilidade', respeito.average, '/ 5', respeito.average >= 3.6 ? 'success' : 'warning');
      break;
    }
    case 'lideranca': {
      const sup = factors.find(f => ['suporte_gestor', 'apoio_gestao'].includes(f.key));
      const just = factors.find(f => f.key === 'justica_procedimental');
      const feed = factors.find(f => f.key === 'feedback_util');
      if (sup) add('Suporte Imediato da Chefia', sup.average, '/ 5', sup.average >= 3.6 ? 'success' : 'warning');
      if (just) add('Justiça e Critérios Claros', just.average, '/ 5', just.average >= 3.6 ? 'success' : 'warning');
      if (feed) add('Qualidade do Feedback', feed.average, '/ 5', feed.average >= 3.6 ? 'success' : 'warning');
      break;
    }
    case 'eficacia': {
      const aplic = factors.find(f => ['aplicacao_real', 'conhecimento_plano'].includes(f.key));
      const melh = factors.find(f => f.key === 'melhoria_percebida');
      const canal = factors.find(f => f.key === 'canal_feedback_nr1');
      if (aplic) add('Aplicação Prática no Dia a Dia', aplic.average, '/ 5', aplic.average >= 3.6 ? 'success' : 'warning');
      if (melh) add('Melhoria Sentida na Rotina', melh.average, '/ 5', melh.average >= 3.6 ? 'success' : 'warning');
      if (canal) add('Canal para Ajustes de Medidas', canal.average, '/ 5', canal.average >= 3.6 ? 'success' : 'warning');
      break;
    }
    default: {
      const sorted = sortAsc(factors);
      if (sorted[0]) add(`Fator Crítico: ${sorted[0].label || sorted[0].key}`, sorted[0].average, '/ 5', sorted[0].average < 2.8 ? 'danger' : 'warning');
      if (sorted[1]) add(`Ponto de Atenção: ${sorted[1].label || sorted[1].key}`, sorted[1].average, '/ 5', sorted[1].average < 2.8 ? 'danger' : 'warning');
      const best = sortDesc(factors)[0];
      if (best) add(`Fator Forte: ${best.label || best.key}`, best.average, '/ 5', 'success');
      break;
    }
  }

  // Se faltou algum para completar 3 contextuais:
  while (kpis.length < 3 && factors.length > kpis.length) {
    const remaining = factors.find(f => !kpis.some(k => k.label.includes(f.label || f.key)));
    if (remaining) {
      add(remaining.label || remaining.key, remaining.average, '/ 5');
    } else {
      break;
    }
  }

  // 4º KPI Universal: Taxa de Adesão
  const rate = report.participationRate != null ? Math.round(report.participationRate * 100) : 85;
  add('Taxa de Adesão Coletiva', rate, '%', rate >= 70 ? 'success' : 'warning');

  return kpis.slice(0, 4);
}

function _buildTendencias(report) {
  const series = report.historicalSeries;
  if (!series || typeof series !== 'object') return [];

  const tendencias = [];

  for (const [key, pontos] of Object.entries(series)) {
    if (!Array.isArray(pontos) || pontos.length < 2) continue;
    const ultimo = pontos[pontos.length - 1];
    const penultimo = pontos[pontos.length - 2];
    if (ultimo?.average == null || penultimo?.average == null) continue;

    const delta = Math.round((ultimo.average - penultimo.average) * 100) / 100;
    if (Math.abs(delta) < 0.05) continue;

    tendencias.push({
      key,
      label: ultimo.label || key,
      delta,
      direcao: delta > 0 ? 'melhora' : 'piora',
      cicloAtual: ultimo.cycle,
      mediaAtual: ultimo.average,
      mediaPrev: penultimo.average,
    });
  }

  return tendencias.sort((a, b) => a.delta - b.delta);
}

/**
 * Gera insights contextuais para um relatório de ciclo.
 */
function generateContextualInsights(report) {
  if (!report?.published) return null;

  const rawFactors = report.factors || report.result || [];
  if (!Array.isArray(rawFactors) || !rawFactors.length) return null;

  const dashboardType = _detectType(report);
  const factors = rawFactors.map(f => ({
    ...f,
    level: f.level || nivel(f.average || 3.0),
    label: f.label || f.key
  }));

  const criticos = factors.filter(f => f.level === 'atencao');
  const cuidado = factors.filter(f => f.level === 'cuidado');
  const adequados = factors.filter(f => f.level === 'adequado');

  const riskScore = _calcRiskScore(factors, dashboardType);
  const diagnostico = _buildDiagnostico(factors, dashboardType, riskScore);

  const narrativas = NARRATIVAS[dashboardType] || NARRATIVAS['nr1-pgr'];
  let narrativa = narrativas.intro + ' ';
  if (criticos.length > 0) {
    narrativa += narrativas.critico(criticos);
  } else if (cuidado.length > 0) {
    narrativa += narrativas.atencao(cuidado);
  } else {
    narrativa += narrativas.adequado();
  }

  const kpisContextuais = _buildKpisContextuais(factors, dashboardType, report);
  const recomendacoes = _buildRecomendacoes(factors, dashboardType);
  const tendencias = _buildTendencias(report);

  return {
    dashboardType,
    riskScore,
    riskLevel: diagnostico.nivel,
    narrativa,
    diagnostico,
    kpisContextuais,
    recomendacoes,
    tendencias,
    totais: {
      criticos: criticos.length,
      cuidado: cuidado.length,
      adequados: adequados.length,
      total: factors.length,
    },
    fatorMaisCritico: criticos[0] || (cuidado.length ? sortAsc(cuidado)[0] : null),
    fatorMaisForte: adequados.length ? sortDesc(adequados)[0] : null,
    geradoEm: new Date().toISOString()
  };
}

module.exports = { generateContextualInsights };
