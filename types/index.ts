/**
 * Tipos centrais do ecossistema Equilibra
 */

export type Role = 'admin' | 'manager' | 'viewer';

export interface Account {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyName: string;
  phone?: string;
  planId?: string;
  createdAt: string;
}

export interface Session {
  token: string;
  accountId: string;
  expiresAt: string;
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  department?: string;
  groupIds?: string[];
  active?: boolean;
  createdAt?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  memberIds: string[];
  createdAt?: string;
}

export type SurveyStatus = 'draft' | 'open' | 'closed';

export interface SurveyFactor {
  key: string;
  label: string;
  question: string;
  options?: string[];
}

export interface Survey {
  id: string;
  title: string;
  cycle: string;
  model: string;
  collectionChannel: 'web' | 'whatsapp';
  status: SurveyStatus;
  groupIds: string[];
  startsAt: string | null;
  endsAt: string;
  createdAt: string;
  totalMembersCount?: number;
  responseCount?: number;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  token?: string;
  answers: Record<string, number>;
  channel?: 'web' | 'whatsapp';
  submittedAt: string;
}

export type BenchmarkBand = 'adequado' | 'cuidado' | 'atencao' | 'unclassified';

export interface FactorMetric {
  key: string;
  label: string;
  mean: number;
  favorableRatio: number;
  unfavorableRatio: number;
  neutralRatio: number;
  band: BenchmarkBand;
}

export interface SurveyAnalysisReport {
  survey: Survey;
  totalInvited: number;
  totalAnswered: number;
  participationRate: number;
  participationBand: 'baixa' | 'media' | 'adequada';
  factors: FactorMetric[];
  generalScore: number;
  recommendations: Array<{
    factorKey: string;
    priority: 'alta' | 'media' | 'baixa';
    action: string;
    rationale: string;
  }>;
}

export interface ActionPlanItem {
  id: string;
  surveyId?: string;
  factorKey?: string;
  title: string;
  description: string;
  responsible: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  impact?: 'alto' | 'medio' | 'baixo';
  createdAt: string;
}

export type RiskLevel = 'trivial' | 'toleravel' | 'moderado' | 'substancial' | 'intoleravel';
export type AssessmentStatus = 'investigating' | 'evaluated' | 'rejected' | 'archived';

export interface RiskAssessment {
  id: string;
  tenantId?: string;
  establishmentId?: string;
  departmentId?: string;
  factor: string;
  category: 'organizacional' | 'relacional' | 'ergonomico' | 'psicossocial';
  hazard: string;
  consequence: string;
  severity: 1 | 2 | 3 | 4 | 5;
  probability: 1 | 2 | 3 | 4 | 5;
  riskScore: number;
  riskLevel: RiskLevel;
  sourceType: 'questionario' | 'observacao' | 'oficina' | 'entrevista' | 'documental';
  observedDataSummary: string;
  descriptiveInterpretation: string;
  technicalHypothesis: string;
  status: AssessmentStatus;
  version: number;
  evaluatorId?: string;
  evaluatorName?: string;
  evaluatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ActionStatus = 'planned' | 'in_progress' | 'implemented' | 'effective' | 'ineffective' | 'cancelled';

export interface Action5W2H {
  id: string;
  tenantId?: string;
  assessmentId?: string;
  title: string;
  what: string;
  why: string;
  where: string;
  who: string;
  when: string;
  how: string;
  howMuch?: string;
  dueDate: string;
  status: ActionStatus;
  controlHierarchy: 'eliminacao' | 'substituicao' | 'engenharia_coletiva' | 'administrativa' | 'individual';
  efficacyCriteria: string;
  reviewDate?: string;
  evidenceCount?: number;
  evidences?: Array<{
    id: string;
    description: string;
    fileUrl?: string;
    registeredBy: string;
    registeredAt: string;
  }>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Establishment {
  id: string;
  tenantId?: string;
  name: string;
  cnpj?: string;
  cnae?: string;
  address?: string;
  city?: string;
  state?: string;
  totalWorkers?: number;
  sectors?: string[];
  active: boolean;
  createdAt?: string;
}

export interface WorkProcess {
  id: string;
  establishmentId: string;
  name: string;
  description?: string;
  activities: string[];
  shiftType?: 'diurno' | 'noturno' | 'revezamento' | 'flexivel';
  workerCount: number;
}

export interface EvidenceRecord {
  id: string;
  tenantId: string;
  establishmentId?: string;
  departmentId?: string;
  method: 'questionario' | 'observacao' | 'oficina' | 'entrevista' | 'documento';
  date: string;
  location: string;
  participantCount?: number;
  description: string;
  keyFindings: string[];
  registeredBy: string;
  confidentialityNote?: string;
  createdAt: string;
}

export interface WhatsAppConnectionStatus {
  connected: boolean;
  phone?: string;
  qrDataUrl?: string;
  pairingCode?: string;
  state?: string;
}
