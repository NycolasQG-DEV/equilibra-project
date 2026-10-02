// Instrumento próprio de percepção, não uma aplicação validada do ISTAS21.
export const PROTOCOL_VERSION = "equilibra-percepcao-2";
export const MIN_GROUP = 10;
export const ANSWERS = [
  "Nunca",
  "Raramente",
  "Às vezes",
  "Frequentemente",
  "Sempre",
  "Não se aplica",
  "Prefiro não responder",
] as const;
export const DIMENSIONS = [
  {
    id: "demandas_psicologicas",
    name: "Volume de trabalho",
    question:
      "Nas últimas duas semanas, com que frequência o volume de trabalho ultrapassou o que você conseguia fazer na jornada?",
    followups: [
      "Em quais momentos o volume costuma aumentar?",
      "Como as prioridades são definidas quando as tarefas se acumulam?",
    ],
    action: {
      title: "Rever demanda e capacidade da equipe",
      steps: [
        "Levantar volume por horário e atividade, sem medir desempenho individual.",
        "Comparar demanda, capacidade e interrupções com a equipe.",
        "Ajustar prioridades, distribuição e recursos nos períodos de maior demanda.",
      ],
      owner: "Gestão da operação",
      days: 30,
      evidence: "Registro das mudanças de prioridades e distribuição",
      indicator:
        "Demanda acumulada por período e frequência de sobrecarga na próxima rodada",
      resources: "Dados de volume e tempo da equipe para revisar a rotina",
    },
  },
  {
    id: "organizacao_gestao",
    name: "Clareza e organização",
    question:
      "Nas últimas duas semanas, com que frequência faltaram orientações claras sobre o que era prioridade no seu trabalho?",
    followups: [
      "Como você resolve uma dúvida sobre prioridades?",
      "O que costuma mudar nas orientações durante a jornada?",
    ],
    action: {
      title: "Definir um procedimento de priorização",
      steps: [
        "Mapear orientações contraditórias com a equipe.",
        "Definir quem resolve conflitos de prioridade e como comunicar mudanças.",
        "Experimentar o procedimento e revisar dificuldades após duas semanas.",
      ],
      owner: "Coordenação da equipe",
      days: 21,
      evidence: "Procedimento acordado e registro de revisão",
      indicator: "Ocorrências de orientações conflitantes e clareza percebida",
      resources: "Tempo da coordenação e canal acessível",
    },
  },
  {
    id: "trabalho_ativo_competencias",
    name: "Pausas e autonomia",
    question:
      "Nas últimas duas semanas, com que frequência as exigências do trabalho impediram você de fazer as pausas previstas?",
    followups: [
      "O que dificulta a pausa na rotina?",
      "Como o trabalho é coberto quando alguém faz uma pausa?",
    ],
    action: {
      title: "Organizar a cobertura das pausas",
      steps: [
        "Verificar as pausas aplicáveis à atividade com o responsável de SST.",
        "Identificar conflitos entre demanda, cobertura e pausas.",
        "Ajustar a organização e verificar se as pausas se tornam possíveis.",
      ],
      owner: "Operação e SST",
      days: 21,
      evidence: "Organização de cobertura e verificação das pausas",
      indicator: "Viabilidade das pausas relatada pela equipe",
      resources: "Análise da atividade e disponibilidade de cobertura",
    },
  },
  {
    id: "apoio_social_lideranca",
    name: "Apoio no trabalho",
    question:
      "Nas últimas duas semanas, com que frequência faltou apoio para resolver dificuldades do trabalho?",
    followups: [
      "Que tipo de apoio faria diferença nessa situação?",
      "Como a equipe pede ajuda quando surge uma dificuldade?",
    ],
    action: {
      title: "Estabelecer apoio para dificuldades da rotina",
      steps: [
        "Identificar situações sem suporte e canais existentes.",
        "Definir responsáveis e formas de encaminhar dificuldades.",
        "Verificar com a equipe se o apoio chegou em tempo útil.",
      ],
      owner: "Coordenação e gestão de pessoas",
      days: 30,
      evidence: "Fluxo de apoio acordado e revisão com a equipe",
      indicator: "Dificuldades sem encaminhamento e apoio percebido",
      resources: "Disponibilidade dos responsáveis e canal de apoio",
    },
  },
  {
    id: "compensacao_reconhecimento",
    name: "Reconhecimento e critérios",
    question:
      "Nas últimas duas semanas, com que frequência os critérios usados para avaliar seu trabalho ficaram pouco claros?",
    followups: [
      "Quais critérios precisariam ser explicados?",
      "Como você recebe retorno sobre o trabalho realizado?",
    ],
    action: {
      title: "Tornar os critérios de avaliação compreensíveis",
      steps: [
        "Revisar critérios e sua compatibilidade com os recursos disponíveis.",
        "Explicar os critérios e abrir espaço para dúvidas.",
        "Reavaliar critérios conflitantes ou fora do controle do trabalhador.",
      ],
      owner: "Gestão de pessoas e liderança",
      days: 30,
      evidence: "Critérios comunicados e dúvidas respondidas",
      indicator: "Clareza dos critérios na próxima consulta",
      resources: "Critérios existentes e tempo para revisão participativa",
    },
  },
  {
    id: "dupla_presenca_familia",
    name: "Jornada e descanso",
    question:
      "Nas últimas duas semanas, com que frequência demandas de trabalho fora da jornada interromperam seu descanso?",
    followups: [
      "Como as demandas fora da jornada chegam até a equipe?",
      "O que ajudaria a tornar os horários mais previsíveis?",
    ],
    action: {
      title: "Rever demandas fora da jornada",
      steps: [
        "Identificar a origem das solicitações fora do horário.",
        "Definir cobertura e critérios para situações realmente excepcionais.",
        "Ajustar canais e escalas para preservar os períodos de descanso.",
      ],
      owner: "Operação e gestão de pessoas",
      days: 30,
      evidence: "Procedimento de contato e cobertura revisto",
      indicator: "Solicitações fora da jornada e descanso percebido",
      resources: "Registros agregados de demanda e revisão das escalas",
    },
  },
  {
    id: "assedio_moral_sexual",
    name: "Respeito nas relações",
    question:
      "Nas últimas duas semanas, com que frequência você percebeu comportamentos desrespeitosos nas relações de trabalho?",
    followups: [
      "Que mudança na organização das relações ajudaria a equipe?",
      "Você sabe onde buscar apoio de forma reservada, se precisar?",
    ],
    action: {
      title: "Revisar proteção e encaminhamento de situações de desrespeito",
      steps: [
        "Verificar acesso a um canal reservado e proteção contra retaliação.",
        "Designar responsáveis preparados para acolher e encaminhar relatos.",
        "Revisar práticas de gestão e acompanhar a segurança do processo.",
      ],
      owner: "Gestão de pessoas e responsáveis de SST",
      days: 15,
      evidence: "Canal e responsabilidades verificados",
      indicator: "Conhecimento do canal e condições de respeito percebidas",
      resources:
        "Responsáveis preparados e procedimento reservado de encaminhamento",
    },
  },
] as const;
export type DimensionId = (typeof DIMENSIONS)[number]["id"];
export function explicitRating(answer: unknown): number | null {
  const index = ANSWERS.indexOf(answer as (typeof ANSWERS)[number]);
  return index >= 0 && index <= 4 ? index : null;
}
export function isDimension(value: unknown): value is DimensionId {
  return DIMENSIONS.some((d) => d.id === value);
}
export function isSkipped(answer: unknown) {
  return answer === "Prefiro não responder" || answer === "Não se aplica";
}
