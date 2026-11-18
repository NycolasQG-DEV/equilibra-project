/**
 * Biblioteca de Medidas de Prevenção e Controle — FASE 07 (EQ-010, EQ-011)
 *
 * Mapeamento de medidas de controle por fator de risco psicossocial conforme
 * a hierarquia de controle da NR-1 (subitem 1.5.5.2) e diretrizes de ergonomia da NR-17.
 *
 * Cada medida segue a metodologia 5W2H e define nível hierárquico:
 * - organizacional: adequação de processos, ritmo e metas (prioridade na NR-17)
 * - administrativa: procedimentos, políticas, escalas e pausas
 * - capacitacao: treinamentos de liderança e equipes
 */

'use strict';

const MEASURES_CATALOG = {
  demandas: [
    {
      id: 'dem-01',
      title: 'Adequação da Distribuição de Tarefas e Metas Operacionais',
      hierarchy: 'organizacional',
      nr17Topic: '17.4 - Organização do Trabalho',
      fiveWtwoH: {
        what: 'Revisão das cargas de trabalho e recalibração de prazos e entregas diárias/semanais',
        why: 'Prevenir sobrecarga mental, esgotamento profissional e queda de rendimento',
        where: 'Setores com pontuação crítica de demandas e pressão por prazos',
        when: 'Imediato, com ciclo de revisão em 30 dias',
        who: 'Gestão imediata com suporte do RH/SST',
        how: 'Mapeamento das atividades mais demoradas, eliminação de retrabalhos e equalização entre membros',
        howMuch: 'Custos operacionais internos de planejamento',
      },
      suggestedReviewDays: 60,
    },
    {
      id: 'dem-02',
      title: 'Instituição de Pausas Programadas de Recuperação Mental',
      hierarchy: 'administrativa',
      nr17Topic: '17.4.3 - Pausas e Recuperação',
      fiveWtwoH: {
        what: 'Implementação de intervalos regulares de 10 minutos a cada 90 minutos de atividade com alta exigência mental',
        why: 'Mitigar a fadiga cognitiva acumulada e manter a atenção sustentada',
        where: 'Ambientes operacionais e de atendimento ininterrupto',
        when: 'Início no ciclo seguinte ao diagnóstico',
        who: 'Coordenação operacional e técnicos de segurança',
        how: 'Definição de cronograma de revezamento para garantir continuidade da operação sem prejudicar o descanso',
        howMuch: 'Zero investimento financeiro direto',
      },
      suggestedReviewDays: 45,
    },
  ],

  autonomia: [
    {
      id: 'aut-01',
      title: 'Flexibilização e Gestão Participativa do Método de Trabalho',
      hierarchy: 'organizacional',
      nr17Topic: '17.4.2 - Ritmo e Métodos',
      fiveWtwoH: {
        what: 'Concessão de maior autonomia para o trabalhador planejar a sequência e o ritmo de suas atividades diárias',
        why: 'Diminuir o sentimento de cerceamento e elevar a responsabilidade compartilhada sobre os resultados',
        where: 'Equipes técnicas, administrativas e operacionais',
        when: 'Em até 30 dias após devolutiva',
        who: 'Lideranças setoriais e colaboradores',
        how: 'Reuniões semanais curtas onde os próprios colaboradores distribuem e ordenam as tarefas sob supervisão',
        howMuch: 'Sem custo adicional',
      },
      suggestedReviewDays: 60,
    },
  ],

  apoio: [
    {
      id: 'apo-01',
      title: 'Programa de Desenvolvimento de Liderança Facilitadora e Empática',
      hierarchy: 'capacitacao',
      nr17Topic: '17.4.1 - Relações Hierárquicas',
      fiveWtwoH: {
        what: 'Capacitação das lideranças em escuta ativa, apoio interpessoal e orientação construtiva',
        why: 'Reduzir o isolamento do trabalhador frente a desafios operacionais e fortalecer o suporte mútuo',
        where: 'Todas as lideranças operacionais e gerenciais',
        when: 'Bimestral, 2 encontros de 2h',
        who: 'Consultoria de desenvolvimento organizacional ou RH interno',
        how: 'Workshops com dinâmicas práticas, resolução de casos reais e técnicas de feedback positivo',
        howMuch: 'Investimento em instrutoria interna ou plataforma de treinamento',
      },
      suggestedReviewDays: 90,
    },
  ],

  relacoes: [
    {
      id: 'rel-01',
      title: 'Canal de Escuta Protegida e Protocolo de Mediação de Conflitos',
      hierarchy: 'administrativa',
      nr17Topic: 'Lei 14.457/22 - Prevenção ao Assédio',
      fiveWtwoH: {
        what: 'Estruturação de fluxo confidencial e acolhedor para relato e tratamento de conflitos no ambiente de trabalho',
        why: 'Cumprir a Lei 14.457/22 e prevenir situações de assédio moral, discriminação e atrito interpessoal crônico',
        where: 'Toda a organização',
        when: 'Imediato (prazo máximo de 15 dias para implantação ou reforço do canal)',
        who: 'Comitê de Ética / CIPA / RH',
        how: 'Divulgação dos meios de comunicação sigilosos e definição de procedimento de acolhimento e apuração imparcial',
        howMuch: 'Recursos de comunicação interna',
      },
      suggestedReviewDays: 30,
    },
  ],

  reconhecimento: [
    {
      id: 'rec-01',
      title: 'Sistema de Reconhecimento Contínuo e Feedback Estruturado',
      hierarchy: 'organizacional',
      nr17Topic: '17.4 - Valorização e Papel',
      fiveWtwoH: {
        what: 'Alinhamento transparente de expectativas, metas e rituais formais de reconhecimento pelo esforço empregado',
        why: 'Mitigar a frustração decorrente da percepção de esforço sem contrapartida de valorização',
        where: 'Todos os setores avaliados',
        when: 'Ciclos mensais de acompanhamento',
        who: 'Gestores de equipe com acompanhamento do RH',
        how: 'Check-ins individuais mensais focados em desenvolvimento e valorização das conquistas da equipe',
        howMuch: 'Sem custo financeiro adicional',
      },
      suggestedReviewDays: 60,
    },
  ],

  jornada: [
    {
      id: 'jor-01',
      title: 'Política de Desconexão Digital e Controle Efetivo de Sobrecarga Noturna/Extra',
      hierarchy: 'organizacional',
      nr17Topic: '17.4.4 - Jornadas e Turnos',
      fiveWtwoH: {
        what: 'Estabelecimento de diretriz explícita que desestimula envio de mensagens e cobranças fora do horário de trabalho',
        why: 'Assegurar a recuperação fisiológica e psicológica fora da jornada laboral (descanso efetivo)',
        where: 'Empresa toda, com ênfase no trabalho híbrido e remoto',
        when: 'Imediato',
        who: 'Diretoria e comitê gestor de pessoas',
        how: 'Publicação de comunicado oficial e configuração de alertas em ferramentas corporativas sobre mensagens fora de horário',
        howMuch: 'Custo nulo',
      },
      suggestedReviewDays: 45,
    },
  ],

  mudancas: [
    {
      id: 'mud-01',
      title: 'Protocolo de Gestão de Mudanças com Comunicação Antecipada e Treinamento Prévio',
      hierarchy: 'organizacional',
      nr17Topic: '17.4.2 - Introdução de Novas Tecnologias',
      fiveWtwoH: {
        what: 'Comunicação antecipada de transições de sistemas, lideranças ou processos, acompanhada de plano de capacitação',
        why: 'Reduzir a ansiedade e a incerteza geradas por mudanças repentinas e impositivas',
        where: 'Setores em processo de transformação digital ou reestruturação',
        when: 'Com antecedência mínima de 15 dias a qualquer alteração de impacto',
        who: 'Líderes de projeto e RH',
        how: 'Cronograma público com sessões de esclarecimento de dúvidas e pilotos controlados antes da virada geral',
        howMuch: 'Planejamento interno',
      },
      suggestedReviewDays: 60,
    },
  ],

  seguranca: [
    {
      id: 'seg-01',
      title: 'Alinhamento de Papéis e Clareza sobre Responsabilidades e Critérios de Desempenho',
      hierarchy: 'organizacional',
      nr17Topic: '17.4.1 - Definição de Papéis',
      fiveWtwoH: {
        what: 'Formalização e esclarecimento das atribuições de cada função e dos critérios objetivos de avaliação',
        why: 'Diminuir a insegurança profissional e a sobreposição ambígua de tarefas',
        where: 'Setores com queixas de instabilidade ou indefinição funcional',
        when: 'Em até 30 dias',
        who: 'Gestão de pessoas e lideranças imediatas',
        how: 'Revisão das descrições de cargo junto com os ocupantes para eliminar dúvidas de escopo',
        howMuch: 'Sem custo adicional',
      },
      suggestedReviewDays: 60,
    },
  ],

  psych_safety: [
    {
      id: 'psy-01',
      title: 'Rituais de Diálogo Aberto e Segurança Psicológica de Time (Edmondson)',
      hierarchy: 'capacitacao',
      nr17Topic: '17.4 - Clima e Comunicação',
      fiveWtwoH: {
        what: 'Criação de espaços seguros onde erros são tratados como oportunidade de aprendizado sem punição arbitrária',
        why: 'Estimular a manifestação de dúvidas, ideias e alertas de risco sem temor de represália',
        where: 'Todas as equipes operacionais e de apoio',
        when: 'Semanalmente em reuniões de alinhamento',
        who: 'Facilitadores internos e líderes de equipe',
        how: 'Adoção de práticas de retrospectiva construtiva e acordos de convivência explícitos',
        howMuch: 'Tempo de reunião interna (30min/semana)',
      },
      suggestedReviewDays: 45,
    },
  ],
};

/**
 * Retorna as medidas sugeridas para um determinado fator.
 * @param {string} factorKey
 * @returns {Array} Lista de medidas com 5W2H
 */
function getMeasuresForFactor(factorKey) {
  const normalized = String(factorKey || '').toLowerCase().trim();
  return MEASURES_CATALOG[normalized] || MEASURES_CATALOG.demandas;
}

/**
 * Retorna todo o catálogo de medidas disponível.
 */
function getAllMeasures() {
  return MEASURES_CATALOG;
}

module.exports = {
  MEASURES_CATALOG,
  getMeasuresForFactor,
  getAllMeasures,
};
