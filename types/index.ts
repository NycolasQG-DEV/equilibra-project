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

export interface WhatsAppConnectionStatus {
  connected: boolean;
  phone?: string;
  qrDataUrl?: string;
  pairingCode?: string;
  state?: string;
}
