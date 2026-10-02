import { isDimension, type DimensionId } from "./protocol";
function object(v: unknown, keys: string[]): v is Record<string, unknown> {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length === keys.length &&
    Object.keys(v).every((k) => keys.includes(k))
  );
}
export function followupContract(v: unknown): { followup_id: number } {
  if (
    !object(v, ["followup_id"]) ||
    (v.followup_id !== 0 && v.followup_id !== 1)
  )
    throw new Error("Invalid followup");
  return { followup_id: v.followup_id };
}
export function reportContract(
  v: unknown,
  eligible: string[],
): { dimension_ids: DimensionId[] } {
  if (
    !object(v, ["dimension_ids"]) ||
    !Array.isArray(v.dimension_ids) ||
    v.dimension_ids.length > 3 ||
    new Set(v.dimension_ids).size !== v.dimension_ids.length ||
    !v.dimension_ids.every((id) => isDimension(id) && eligible.includes(id))
  )
    throw new Error("Invalid report");
  return { dimension_ids: v.dimension_ids as DimensionId[] };
}
export type Intent = "overview" | "trend" | "actions" | "quality" | "limits";
export function managerContract(
  v: unknown,
  eligible: string[],
): { intent: Intent; dimension_id: DimensionId | null } {
  if (
    !object(v, ["intent", "dimension_id"]) ||
    !["overview", "trend", "actions", "quality", "limits"].includes(
      String(v.intent),
    ) ||
    (v.dimension_id !== null &&
      (!isDimension(v.dimension_id) || !eligible.includes(v.dimension_id)))
  )
    throw new Error("Invalid manager response");
  return {
    intent: v.intent as Intent,
    dimension_id: v.dimension_id as DimensionId | null,
  };
}
export function minimizeText(value: unknown, max = 1600) {
  return String(value ?? "")
    .slice(0, max)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[contato removido]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[documento removido]");
}
