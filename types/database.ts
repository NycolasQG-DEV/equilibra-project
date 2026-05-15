export type UserRole = "default" | "dev" | "admin";
export type PlanType = "none" | "starter" | "professional" | "enterprise";

export interface User {
  id: string;
  name: string;
  email: string;
  cnpj?: string;
  phone?: string;
  role: UserRole;
  plan: PlanType;
  max_colaboradores: number;
  admin_id?: string | null;
  cargo?: string;
  setor?: string;
  observacao?: string;
  created_at: string;
  updated_at?: string;
}

/* ─── Pesquisas ─── */

export interface SurveyQuestionOption {
  label: string;
  value: number;
}

export interface SurveyQuestion {
  id: number;
  text: string;
  icon: string;
  options: SurveyQuestionOption[];
}

export interface Survey {
  id: string;
  admin_id: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
  is_active: boolean;
  scheduled_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at?: string;
}

export type AssignmentStatus = "pending" | "completed";

export interface SurveyAssignment {
  id: string;
  survey_id: string;
  user_id: string;
  admin_id: string;
  status: AssignmentStatus;
  completed_at: string | null;
  created_at: string;
  /** Joined from surveys table */
  surveys?: Survey;
}

/* ─── Respostas ─── */

export interface Response {
  id: string;
  user_id: string;
  survey_id?: string;
  admin_id?: string;
  survey_type?: string;
  answers?: Record<number, number>;
  score: number;
  risk_level: "baixo" | "medio" | "alto";
  created_at: string;
  /** Joined from surveys table */
  surveys?: { title: string };
}

/* ─── Chat ─── */

export interface ChatMessage {
  id: string;
  user_id: string;
  session_id: string;
  role: "user" | "ai";
  text: string;
  created_at: string;
}

export interface AdminChatMessage {
  id: string;
  admin_id: string;
  role: "user" | "ai";
  text: string;
  created_at: string;
}

/* ─── Assinaturas ─── */

export type SubscriptionStatus = "active" | "cancelled" | "expired";

export interface Subscription {
  id: string;
  user_id: string;
  plan: PlanType;
  status: SubscriptionStatus;
  price_brl: number;
  payment_method: string;
  card_brand: string;
  card_last4: string;
  started_at: string;
  expires_at: string;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ─── Constantes de plano ─── */

export const PLAN_LIMITS: Record<PlanType, number> = {
  none: 0,
  starter: 10,
  professional: 50,
  enterprise: 9999,
};

export const PLAN_PRICES: Record<PlanType, number> = {
  none: 0,
  starter: 9900,
  professional: 24900,
  enterprise: 49900,
};

export const PLAN_NAMES: Record<PlanType, string> = {
  none: "Sem plano",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};