/**
 * PROMPT DO SISTEMA: LAUDO PERICIAL OFICIAL & MATRIZ DE RISCO NR-1 (GRO/PGR - ISTAS21-BR)
 */

export function buildSynthesisPrompt(session: any): string {
  const { id, profile, history } = session;

  const sanitizeEmojis = (str: any) => {
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
Você é um Especialista em Gestão de Riscos Ocupacionais e Ergonomia Psicossocial (NR-01 / ISTAS21-BR).
Gere um RELATÓRIO OBJETIVO, DIRETO E ACIONÁVEL para a liderança e SESMT da empresa, focado estritamente no que realmente agrega valor: Diagnóstico Geral, Principais Riscos e Planos de Ação Concretos.

DADOS DA AVALIAÇÃO:
- Protocolo: ${id}
- Setor: ${profile.sector || 'Operacional Geral'}
- Cargo: ${profile.workerRole || 'Geral'}
- Turno: ${profile.shift || 'Geral'}
- Tempo na Empresa: ${profile.companyTime || 'Não informado'}

HISTÓRICO DE RESPOSTAS DO COLABORADOR:
${JSON.stringify((history || []).map((h: any) => ({
  etapa: h.stepNumber,
  dimensao: h.dimensionTarget,
  pergunta: sanitizeEmojis(h.question),
  resposta: sanitizeEmojis(h.userAnswer),
  observacao_tecnica: sanitizeEmojis(h.aiObservation)
})), null, 2)}

DIRETRIZES DE SÍNTESE:
1. Seja direto, conciso e técnico. Evite repetições, jargões vazios ou textos longos desnecessários.
2. Foque nos riscos reais apontados nas respostas.
3. Se o colaborador indicou respostas normais sem queixas, mantenha a classificação de risco como baixa/controlada.
4. Elabore planos de ação práticos no formato 5W2H focados em melhorias reais no posto de trabalho.
5. Retorne ESTRITAMENTE em formato JSON sem markdown. NUNCA gere sequências unicode inválidas.

FORMATO JSON OBRIGATÓRIO:
{
  "executive_summary": "Diagnóstico executivo direto e conciso (máximo 3 parágrafos objetivos) destacando a situação real do setor, principais riscos identificados e prioridades de intervenção.",
  "behavioral_analysis": "Avaliação objetiva da segurança psicológica e nível de clareza demonstrado pelo colaborador.",
  "technical_inferences": "Resumo pericial técnico correlacionando os achados às exigências práticas da NR-1 (GRO/PGR).",
  "dimensions_assessment": {
    "demandas_psicologicas": {
      "probability": 2,
      "severity": 2,
      "explicit_evidence": "Evidência direta observada nas respostas...",
      "implicit_inference": "Inferência sobre sobrecarga ou adequação...",
      "algorithm_certainty_pct": 85,
      "legal_framework": "Portaria MTE nº 1.419/2024 (NR-1)",
      "mitigation_recommendation": "Medida prática de controle."
    },
    "organizacao_gestao": {
      "probability": 2,
      "severity": 2,
      "explicit_evidence": "Evidência sobre rotina e jornadas...",
      "implicit_inference": "Previsibilidade do trabalho...",
      "algorithm_certainty_pct": 85,
      "legal_framework": "NR-1 item 1.5.4",
      "mitigation_recommendation": "Medida de controle da organização."
    },
    "trabalho_ativo_competencias": {
      "probability": 2,
      "severity": 2,
      "explicit_evidence": "Evidência sobre pausas e autonomia...",
      "implicit_inference": "Capacidade de recuperação psicofisiológica...",
      "algorithm_certainty_pct": 85,
      "legal_framework": "NR-17",
      "mitigation_recommendation": "Ajuste em pausas e ritmo."
    },
    "apoio_social_lideranca": {
      "probability": 2,
      "severity": 2,
      "explicit_evidence": "Evidência sobre liderança e relacionamento...",
      "implicit_inference": "Suporte e respeito no setor...",
      "algorithm_certainty_pct": 85,
      "legal_framework": "NR-1 item 1.5.3",
      "mitigation_recommendation": "Alinhamento com a supervisão."
    },
    "compensacao_reconhecimento": {
      "probability": 2,
      "severity": 2,
      "explicit_evidence": "Evidência sobre reconhecimento e estabilidade...",
      "implicit_inference": "Segurança ocupacional...",
      "algorithm_certainty_pct": 85,
      "legal_framework": "NR-1",
      "mitigation_recommendation": "Feedback e reconhecimento."
    },
    "dupla_presenca_familia": {
      "probability": 2,
      "severity": 2,
      "explicit_evidence": "Evidência sobre impacto no descanso e família...",
      "implicit_inference": "Equilíbrio entre jornada e recuperação...",
      "algorithm_certainty_pct": 85,
      "legal_framework": "CLT e ISO 45003",
      "mitigation_recommendation": "Respeito ao descanso e desconexão."
    },
    "assedio_moral_sexual": {
      "probability": 1,
      "severity": 1,
      "explicit_evidence": "Evidência sobre respeito mútuo e ausência/presença de assédio...",
      "implicit_inference": "Conformidade com a Lei 14.457/22...",
      "algorithm_certainty_pct": 90,
      "legal_framework": "Lei 14.457/2022 e NR-1",
      "mitigation_recommendation": "Manutenção de canais éticos e ações da CIPA."
    }
  },
  "action_plan_5w2h": [
    {
      "what": "Ação clara e objetiva",
      "why": "Motivo e benefício para o colaborador/empresa",
      "where": "Setor",
      "who": "Responsável (ex: RH / SESMT / Supervisão)",
      "when": "Prazo realista (ex: 15 dias)",
      "how": "Como executar de forma simples",
      "control_level": "Administrativo",
      "priority": "Alta"
    }
  ],
  "action_plan": {
    "immediate_actions": ["Ação imediata 1", "Ação imediata 2"],
    "preventive_actions": ["Ação preventiva 1", "Ação preventiva 2"]
  },
  "full_narrative_report": "Laudo Pericial Sintético e Direto: Diagnóstico estruturado com foco em dados relevantes, identificação dos riscos reais e direcionamento assertivo para o PGR da empresa."
}
`;
}
