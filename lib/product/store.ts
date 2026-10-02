import { supabaseAdmin } from "@/lib/db";

export function dataOrThrow<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Dados indisponíveis.");
  return result.data;
}

export async function ownedOrganizationIds(userId: string): Promise<string[]> {
  const rows = dataOrThrow(await supabaseAdmin.from("product_organizations")
    .select("id").eq("owner_user_id", userId));
  return rows.map((row: { id: string }) => row.id);
}

export async function ownedRunIds(userId: string): Promise<string[]> {
  const organizations = await ownedOrganizationIds(userId);
  if (!organizations.length) return [];
  const rows = dataOrThrow(await supabaseAdmin.from("product_runs")
    .select("id").in("organization_id", organizations));
  return rows.map((row: { id: string }) => row.id);
}
