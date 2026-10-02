import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/db";
import { dataOrThrow, ownedOrganizationIds } from "./store";
import { HttpError } from "@/lib/security";

export interface SectorProfile {
  id: string;
  organizationId: string;
  name: string;
  roles: string[]; // Cargos do setor
  workModel: "presencial" | "hibrido" | "remoto";
  routineDescription: string; // Descrição da rotina diária prevista
  plannedBaseline: {
    volume: number; // 1 (Muito Baixo) a 5 (Muito Alto)
    clarity: number;
    autonomy: number;
    support: number;
    recognition: number;
    relations: number;
  };
  shiftHours: number; // Carga horária prevista (ex: 8h, 6h)
  hasOvertimeExpected: boolean;
  breakPolicy: string; // Ex: "Pausas regulares de 15min + 1h almoço"
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_SECTOR_TEMPLATES: Omit<SectorProfile, "id" | "organizationId">[] = [
  {
    name: "Atendimento ao Cliente / SAC",
    roles: ["Operador de SAC", "Monitor de Qualidade", "Supervisor de Atendimento"],
    workModel: "presencial",
    routineDescription: "Atendimento contínuo de chamados e chats com metas de tempo médio de atendimento (TMA) e satisfação (CSAT). Escala de pausas da NR-17.",
    plannedBaseline: { volume: 3, clarity: 4, autonomy: 2, support: 4, recognition: 4, relations: 5 },
    shiftHours: 6.3,
    hasOvertimeExpected: false,
    breakPolicy: "2 pausas de 10 minutos + 1 pausa de 20 minutos regulamentadas.",
  },
  {
    name: "Operações & Logística",
    roles: ["Auxiliar de Estoque", "Conferente", "Operador de Empilhadeira", "Encarregado"],
    workModel: "presencial",
    routineDescription: "Movimentação, separação e conferência de mercadorias com metas de expedição física e cumprimento de prazos de entrega.",
    plannedBaseline: { volume: 4, clarity: 4, autonomy: 2, support: 3, recognition: 3, relations: 4 },
    shiftHours: 8,
    hasOvertimeExpected: true,
    breakPolicy: "Pausa de 1 hora de almoço e descansos de hidratação.",
  },
  {
    name: "Comercial & Vendas",
    roles: ["SDR / Pré-vendas", "Executivo de Contas", "Gerente de Vendas"],
    workModel: "hibrido",
    routineDescription: "Prospecção ativa, reuniões com clientes e negociações com metas quinzenais e mensais sob alta pressão de fechamento.",
    plannedBaseline: { volume: 4, clarity: 4, autonomy: 4, support: 4, recognition: 4, relations: 4 },
    shiftHours: 8,
    hasOvertimeExpected: false,
    breakPolicy: "Flexibilidade na gestão do horário diário.",
  },
  {
    name: "Engenharia & Tecnologia",
    roles: ["Desenvolvedor de Software", "Designer de Produto", "Tech Lead", "QA"],
    workModel: "hibrido",
    routineDescription: "Desenvolvimento de funcionalidades em ciclos de sprints quinzenais com reuniões diárias (dailies) e entregas contínuas.",
    plannedBaseline: { volume: 3, clarity: 5, autonomy: 4, support: 4, recognition: 4, relations: 5 },
    shiftHours: 8,
    hasOvertimeExpected: false,
    breakPolicy: "Pausas livres e horários flexíveis de foco.",
  },
];

export async function getSectorsForUser(userId: string): Promise<SectorProfile[]> {
  const orgIds = await ownedOrganizationIds(userId);
  if (!orgIds.length) return [];

  // Busca na tabela product_templates ou metadata de templates
  const { data: rows, error } = await supabaseAdmin
    .from("product_templates")
    .select("id,organization_id,title,description,created_at,updated_at")
    .in("organization_id", orgIds)
    .eq("kind", "sector_profile");

  if (error) {
    // Caso a tabela não suporte kind 'sector_profile', retornamos os templates padrão mapeados
    return DEFAULT_SECTOR_TEMPLATES.map((t, i) => ({
      ...t,
      id: `sector_${i + 1}`,
      organizationId: orgIds[0],
    }));
  }

  if (!rows || rows.length === 0) {
    return DEFAULT_SECTOR_TEMPLATES.map((t, i) => ({
      ...t,
      id: `sector_${i + 1}`,
      organizationId: orgIds[0],
    }));
  }

  return rows.map((r) => {
    try {
      const parsed = JSON.parse(r.description || "{}");
      return {
        id: r.id,
        organizationId: r.organization_id,
        name: r.title,
        roles: parsed.roles || ["Geral"],
        workModel: parsed.workModel || "presencial",
        routineDescription: parsed.routineDescription || "",
        plannedBaseline: parsed.plannedBaseline || { volume: 3, clarity: 4, autonomy: 3, support: 4, recognition: 4, relations: 4 },
        shiftHours: parsed.shiftHours || 8,
        hasOvertimeExpected: !!parsed.hasOvertimeExpected,
        breakPolicy: parsed.breakPolicy || "Pausa padrão.",
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    } catch {
      return {
        id: r.id,
        organizationId: r.organization_id,
        name: r.title,
        roles: ["Geral"],
        workModel: "presencial",
        routineDescription: r.description || "",
        plannedBaseline: { volume: 3, clarity: 4, autonomy: 3, support: 4, recognition: 4, relations: 4 },
        shiftHours: 8,
        hasOvertimeExpected: false,
        breakPolicy: "Pausa padrão.",
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    }
  });
}

export async function saveSectorProfile(userId: string, orgId: string, profile: Omit<SectorProfile, "id" | "organizationId"> & { id?: string }) {
  const orgIds = await ownedOrganizationIds(userId);
  if (!orgIds.includes(orgId)) throw new HttpError(403, "Acesso não autorizado a esta empresa.");

  const payload = {
    roles: profile.roles,
    workModel: profile.workModel,
    routineDescription: profile.routineDescription,
    plannedBaseline: profile.plannedBaseline,
    shiftHours: profile.shiftHours,
    hasOvertimeExpected: profile.hasOvertimeExpected,
    breakPolicy: profile.breakPolicy,
  };

  if (profile.id && !profile.id.startsWith("sector_")) {
    // Update
    const { error } = await supabaseAdmin
      .from("product_templates")
      .update({
        title: profile.name,
        description: JSON.stringify(payload),
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id)
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);
    return { id: profile.id };
  } else {
    // Insert
    const newId = randomUUID();
    const { error } = await supabaseAdmin.from("product_templates").insert({
      id: newId,
      organization_id: orgId,
      kind: "sector_profile",
      title: profile.name,
      description: JSON.stringify(payload),
      questions: [],
      invites_per_run: 10,
      active: true,
    });
    if (error) throw new Error(error.message);
    return { id: newId };
  }
}
