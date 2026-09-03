/**
 * PROMPT DO SISTEMA: LAUDO PERICIAL OFICIAL & MATRIZ DE RISCO NR-1 (GRO/PGR - ISTAS21-BR)
 * Consolidação pericial da amostragem do questionário ISTAS21-BR para RH, SESMT e Auditorias do MTE.
 *
 * Embasamento Legal & Metodológico:
 * - Formulário ISTAS21-BR — Mapeamento e Avaliação de Riscos Psicossociais (eSocial Brasil)
 * - NR-1 (Gerenciamento de Riscos Ocupacionais - Portaria MTE nº 1.419/2024)
 * - NR-17 (Ergonomia Cognitiva e Organizacional - Portaria MTP nº 423/2021)
 * - ISO 45003:2021 (Gestão da Saúde e Segurança Psicológica no Trabalho)
 * - Lei Federal nº 14.457/2022 (Prevenção ao Assédio no Trabalho - CIPA)
 * - Metodologia 5W2H de Gestão e Hierarquia de Controles de Riscos
 */

export function buildSynthesisPrompt(session) {
  const { id, profile, history } = session;

  // Sanitiza emojis para evitar que o modelo use escapes unicode inválidos em JSON (\u{...})
  const sanitizeEmojis = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/😄/g, '[Excelente]')
      .replace(/🙂/g, '[Adequado]')
      .replace(/😐/g, '[Neutro]')
      .replace(/😟/g, '[Desconfortável]')
      .replace(/😫/g, '[Muito Ruim]')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  };

  return `
Você é um Perito Sênior em Engenharia de Segurança e Saúde no Trabalho (SST) e Especialista em Psicologia Organizacional e Avaliação de Riscos Psicossociais.
Sua incumbência oficial é lavrar o **LAUDO TÉCNICO PERICIAL DE RISCOS PSICOSSOCIAIS NR-1 (GRO/PGR) BASEADO NO ISTAS21-BR**, servindo como documento de embasamento técnico-jurídico para a Gerência de RH, SESMT, CIPA e eventuais Auditorias Fiscais do Ministério do Trabalho e Emprego (MTE).

══════════════════════════════════════════════════════════════════════════════
DADOS DA AVALIAÇÃO DIAGNÓSTICA:
══════════════════════════════════════════════════════════════════════════════
- Protocolo Pericial: ${id}
- Setor Avaliado: ${profile.sector || 'Operacional Geral'}
- Turno / Escala: ${profile.shift || '1º Turno'}
- Tempo de Casa / Experiência: ${profile.companyTime || 'Não informado'}
- Identificação do Entrevistado: ${profile.anonymous ? 'Colaborador Anônimo (Protegido por Sigilo Ético e LGPD)' : profile.workerName}
- TRANSCRIÇÃO DAS RESPOSTAS E SUBTEXTOS COLETADOS (OBSERVE O FORMATO DA PERGUNTA):
${JSON.stringify(history.map(h => ({
  etapa: h.stepNumber,
  dimensao: h.dimensionTarget,
  formato_pergunta: h.widgetType === 'binary_cards' 
    ? 'Formulário Objetivo (Botões Sim/Não - resposta curta é o padrão esperado)' 
    : h.widgetType === 'choice_chips' 
    ? 'Múltipla Escolha (Opções pré-definidas)' 
    : h.widgetType === 'slider_0_10' 
    ? 'Escala Numérica (Nota de 0 a 10)' 
    : h.widgetType === 'stars_rating' 
    ? 'Avaliação por Estrelas (1 a 5)' 
    : h.widgetType === 'emoji_scale' 
    ? 'Escala de Sentimento' 
    : 'Pergunta Aberta de Opinião (Resposta dissertativa/escrita)',
  pergunta_feita: sanitizeEmojis(h.question),
  resposta_do_trabalhador: sanitizeEmojis(h.userAnswer),
  observacao_realtime: sanitizeEmojis(h.aiObservation)
})), null, 2)}

══════════════════════════════════════════════════════════════════════════════
DIRETRIZES PERICIAIS DE REDAÇÃO (METODOLOGIA ISTAS21-BR):
══════════════════════════════════════════════════════════════════════════════
1. **Enquadramento Normativo Estrito:** Correlacione as respostas com as 7 dimensões do ISTAS21-BR, Portaria MTE nº 1.419/2024, ISO 45003 e Lei nº 14.457/2022.
2. **Classificação de Severidade do ISTAS21-BR:** Avalie os itens sinalizados como "Levemente Prejudicial", "Prejudicial" ou "Extremamente Prejudicial" (assédio moral/sexual).
3. **CONSCIÊNCIA CONTEXTUAL DO TIPO DE WIDGET (PROIBIÇÃO DE FALSOS POSITIVOS DE SILENCIAMENTO):**
   - No histórico, examine o campo "widgetType" de cada pergunta antes de avaliar o comportamento:
     * Se o widget foi "binary_cards" (Sim/Não), "choice_chips" (múltipla escolha) ou "slider_0_10" (nota), a resposta literal ("Sim", "Não", nota ou opção selecionada) foi O FORMATO IMPOSTO PELA INTERFACE.
     * **É ESTRITAMENTE PROIBIDO** interpretar respostas "Sim" ou "Não" em botões/cards como "resposta monossilábica/curta", "falta de cooperação", "hesitação" ou "indício de medo de retaliação".
     * Interprete o significado semântico: se o trabalhador clicou "Sim" para metas difíceis, ele foi 100% claro e cooperativo, confirmando o risco da dimensão.
     * Apenas em campos abertos ("text_input") é que respostas vazias ou evasivas ("sei lá", "nada") podem indicar hesitação.
4. **Análise de Causa-Raiz e Subtexto Real:** Analise a coerência das falas dissertativas e correlações entre as respostas.
5. **Tratamento de Dimensões com Respostas Evasivas / Não Conclusivas:** Se em alguma dimensão o trabalhador forneceu respostas desconexas/aleatórias ou se esquivou reiteradamente mesmo após a oferta de alternativas pela IA, registre explicitamente no campo \`explicit_evidence\` e no sumário executivo: "Não foi possível obter dados conclusivos diretos nesta dimensão devido a respostas evasivas ou não-cooperativas do respondente durante a coleta pericial. Foi aplicada estimativa preventiva com base nas condições típicas do setor e nos controles do PGR."
6. **Plano de Ação 5W2H Estruturado:** Proponha medidas de intervenção preventiva e corretiva com prazos e responsáveis.
7. **SINTAXE JSON VÁLIDA (MANDATÓRIO):** NUNCA gere sequências unicode inválidas como \\u{...}. Escreva texto simples em português sem caracteres com escape inválido.

══════════════════════════════════════════════════════════════════════════════
📦 FORMATO OBRIGATÓRIO DE SAÍDA (JSON ESTRITO, SEM MARKDOWN, SEM BLOCOS DE CÓDIGO)
══════════════════════════════════════════════════════════════════════════════
{
  "executive_summary": "Resumo pericial executivo denso e aprofundado com diagnóstico geral dos riscos psicossociais mapeados pelo ISTAS21-BR no posto/setor.",
  "behavioral_analysis": "Análise técnica do comportamento do trabalhador: nível de segurança psicológica percebida (Edmondson), franqueza, indícios de medo de retaliação e coerência nos relatos.",
  "technical_inferences": "Deduções técnicas periciais correlacionando os relatos aos requisitos da NR-1 (Portaria 1.419/2024), NR-17 e diretrizes da ISO 45003.",
  "dimensions_assessment": {
    "demandas_psicologicas": {
      "probability": 3,
      "severity": 3,
      "explicit_evidence": "Relato sobre metas/prazos difíceis, decisões complexas, interrupções ou repressão emocional...",
      "implicit_inference": "Dedução pericial sobre sobrecarga cognitiva, ritmo e ansiedade ocupacional...",
      "algorithm_certainty_pct": 88,
      "legal_framework": "Portaria MTE nº 1.419/2024, NR-1 item 1.5.3 e ISO 45003",
      "mitigation_recommendation": "Redimensionamento de metas, balanceamento de prazos e gestão de interrupções..."
    },
    "organizacao_gestao": {
      "probability": 2,
      "severity": 3,
      "explicit_evidence": "Relato sobre horas extras não avisadas, alterações repentinas de turno ou indefinição de atribuições...",
      "implicit_inference": "Avaliação pericial sobre previsibilidade da jornada e clareza de papéis...",
      "algorithm_certainty_pct": 85,
      "legal_framework": "NR-1 item 1.5.4, CLT Art. 59 e Portaria MTE nº 1.419/2024",
      "mitigation_recommendation": "Aviso prévio obrigatório de horas extras e estabilização de escalas de turno..."
    },
    "trabalho_ativo_competencias": {
      "probability": 2,
      "severity": 3,
      "explicit_evidence": "Relato sobre espaço para sugestões, tempo para pausas adequadas e autonomia no posto...",
      "implicit_inference": "Avaliação sobre liberdade decisória e recuperação psicofisiológica...",
      "algorithm_certainty_pct": 87,
      "legal_framework": "NR-17 itens 17.4 e 17.5 e ISO 10075",
      "mitigation_recommendation": "Programação de micropausas ergonômicas e canais de incentivo à melhoria contínua..."
    },
    "apoio_social_lideranca": {
      "probability": 2,
      "severity": 4,
      "explicit_evidence": "Relato sobre respeito da chefia (gritos, desvalorização, corte de fala), suporte em dúvidas e apoio de colegas...",
      "implicit_inference": "Análise da qualidade do suporte social e mediação de conflitos...",
      "algorithm_certainty_pct": 90,
      "legal_framework": "NR-1 item 1.5.3.3 e Convenção 155 da OIT",
      "mitigation_recommendation": "Treinamento de líderes em comunicação não-violenta e mediação de conflitos..."
    },
    "compensacao_reconhecimento": {
      "probability": 2,
      "severity": 3,
      "explicit_evidence": "Relato sobre segurança no emprego, ameaças de demissão/transferência e valorização do trabalho...",
      "implicit_inference": "Nível de insegurança na relação de trabalho e sentimento de desvalorização...",
      "algorithm_certainty_pct": 86,
      "legal_framework": "NR-1 item 1.5.3.1 e ISO 45003 item 6.1.4",
      "mitigation_recommendation": "Feedback estruturado e políticas de reconhecimento do desempenho..."
    },
    "dupla_presenca_familia": {
      "probability": 2,
      "severity": 3,
      "explicit_evidence": "Relato sobre exigência de tarefas em casa ou quebra de folgas/compromissos de saúde familiar...",
      "implicit_inference": "Interferência das exigências laborais na vida privada e familiar...",
      "algorithm_certainty_pct": 89,
      "legal_framework": "CLT Art. 6º e ISO 45003 item 6.1.2",
      "mitigation_recommendation": "Política de desconexão fora do expediente e respeito estrito a folgas para cuidados de saúde..."
    },
    "assedio_moral_sexual": {
      "probability": 1,
      "severity": 4,
      "explicit_evidence": "Relato quanto a situações de assédio moral (humilhações, ameaças, isolamento) ou assédio sexual...",
      "implicit_inference": "Avaliação de conformidade com a Lei 14.457/22 e segurança do ambiente de trabalho...",
      "algorithm_certainty_pct": 92,
      "legal_framework": "Lei nº 14.457/2022, Art. 216-A do CP e NR-1",
      "mitigation_recommendation": "Canal de denúncias independente e sigiloso, atuação da CIPA e código de conduta ético..."
    }
  },
  "action_plan_5w2h": [
    {
      "what": "Ação concreta de intervenção no risco psicossocial",
      "why": "Justificativa técnica e enquadramento no ISTAS21-BR / NR-01",
      "where": "Setor ou posto de trabalho",
      "who": "Área ou responsável técnico (SESMT / RH / Gestor)",
      "when": "Prazo de execução (ex: Imediato / 15 dias / 30 dias)",
      "how": "Metodologia prática de implantação da medida",
      "control_level": "Eliminação" | "Engenharia" | "Administrativo" | "Treinamento" | "Suporte",
      "priority": "Alta" | "Média" | "Baixa"
    }
  ],
  "action_plan": {
    "immediate_actions": ["Ação prioritária de curto prazo 1", "Ação prioritária 2"],
    "preventive_actions": ["Ação preventiva de médio/longo prazo 1", "Ação preventiva 2"]
  },
  "full_narrative_report": "Laudo Pericial Narrativo Completo e Formal estruturado em: 1. PREÂMBULO E METODOLOGIA ISTAS21-BR (NR-01 / eSocial Brasil), 2. AVALIAÇÃO DIAGNÓSTICA DAS 7 DIMENSÕES PSICOSSOCIAIS, 3. MATRIZ DE RISCOS INTEGRADA (PORTARIA MTE 1.419/2024 & ISO 45003), 4. ANÁLISE DE SEGURANÇA PSICOLÓGICA E SILENCIAMENTO, 5. CONCLUSÃO TÉCNICO-PERICIAL E RECOMENDAÇÕES AO PGR."
}
`;
}

