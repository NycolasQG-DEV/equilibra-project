/* Central labels and text constants for Equilibra */

export const surveyStatusLabels = {
  draft: 'Rascunho',
  open: 'Em coleta',
  closed: 'Encerrada'
};

export const actionStatusLabels = {
  planned: 'Planejada',
  in_progress: 'Em execução',
  implemented: 'Implementada; revisar eficácia',
  effective: 'Eficaz',
  ineffective: 'Não eficaz',
  cancelled: 'Cancelada'
};

export const assessmentStatusLabels = {
  investigating: 'Em investigação',
  evaluated: 'Avaliado',
  dismissed: 'Descartado'
};

export const priorityLabels = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa'
};

export const roleLabels = {
  owner: 'Administrador',
  editor: 'RH / SST',
  viewer: 'Consulta'
};

export const bandLabels = {
  adequado: 'Adequado (≥ 3,6)',
  cuidado: 'Cuidado (2,8 – 3,59)',
  atencao: 'Atenção (< 2,8)',
  unclassified: 'Não classificado'
};

export const decisionQueueLabels = {
  report_pending_acceptance: 'Relatório aguarda aceite formal',
  report_without_assessment: 'Relatório sem investigação ou avaliação',
  survey_low_participation: 'Pesquisa próxima ao fim com baixa adesão',
  action_overdue: 'Plano de ação com prazo vencido',
  action_review_due: 'Ação aguardando revisão de eficácia'
};

export const quorumNotice = 'Público mínimo configurado';
