import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Inicialização do Cliente Supabase Admin (HTTPS / Port 443) ──
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no servidor.");
}

export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export interface DbConnection {
  execute(sql: string, params?: any[]): Promise<[any[], any]>;
  query(sql: string, params?: any[]): Promise<[any[], any]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}

export interface ExtendedPool {
  query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }>;
  getConnection(): Promise<DbConnection>;
}

let isInitialized = false;
let initializing: Promise<void> | null = null;

/**
 * Normaliza parâmetros e substitui ? por $1, $2 se necessário
 */
function normalizeParams(sql: string, params: any[] = []): { sql: string; params: any[] } {
  let transformedSql = sql.trim().replace(/;+$/, "");
  if (transformedSql.includes("?") && !/\$\d+/.test(transformedSql)) {
    let paramIdx = 1;
    transformedSql = transformedSql.replace(/\?/g, () => `$${paramIdx++}`);
  }
  return { sql: transformedSql, params };
}

function extractValue(valRaw: string, params: any[]): any {
  valRaw = valRaw.trim();
  if (/^\$\d+$/.test(valRaw)) {
    const idx = parseInt(valRaw.slice(1), 10) - 1;
    return params[idx];
  }
  if (/^null$/i.test(valRaw)) return null;
  if (/^true$/i.test(valRaw)) return true;
  if (/^false$/i.test(valRaw)) return false;
  if (/^(?:NOW\(\)|CURRENT_TIMESTAMP|now\(\))$/i.test(valRaw)) return new Date().toISOString();
  if (/^['"].*['"]$/.test(valRaw)) return valRaw.slice(1, -1);
  if (!isNaN(Number(valRaw)) && valRaw !== "") return Number(valRaw);
  return valRaw;
}

function applyWhere(builder: any, whereClause: string, params: any[]): any {
  if (!whereClause) return builder;

  // Remove FOR UPDATE se presente
  whereClause = whereClause.replace(/FOR\s+UPDATE(?:\s+OF\s+[a-zA-Z0-9_,\s]+)?/gi, "").trim();

  // Caso contenha OR: "admin_id = $1 OR id = $1"
  if (/\s+OR\s+/i.test(whereClause) && !/\s+AND\s+/i.test(whereClause)) {
    const orParts = whereClause.split(/\s+OR\s+/i);
    const orFilters = orParts
      .map((part) => {
        const match = part.trim().match(/^([a-zA-Z0-9_.]+)\s*(=|!=|<>|IS|IS NOT)\s*([\s\S]+)$/i);
        if (match) {
          const col = match[1].trim().split(".").pop()!;
          const op = match[2].trim().toUpperCase();
          const val = extractValue(match[3], params);
          if (op === "=" || op === "IS") return `${col}.eq.${val}`;
          if (op === "!=" || op === "<>" || op === "IS NOT") return `${col}.neq.${val}`;
        }
        return null;
      })
      .filter(Boolean);

    if (orFilters.length > 0) {
      return builder.or(orFilters.join(","));
    }
  }

  // Caso contenha AND
  const andParts = whereClause.split(/\s+AND\s+/i);
  for (const part of andParts) {
    const match = part
      .trim()
      .match(/^([a-zA-Z0-9_.]+)\s*(=|!=|<>|<|>|<=|>=|IS\s+NOT|IS|LIKE|ILIKE)\s*([\s\S]+)$/i);
    if (match) {
      const col = match[1].trim().split(".").pop()!;
      const op = match[2].trim().toUpperCase();
      let val = extractValue(match[3], params);

      // Tratamento para datas dinâmicas como DATE_FORMAT(NOW(), "%Y-%m-01")
      if (typeof match[3] === "string" && /DATE_FORMAT\s*\(\s*NOW\(\)\s*,\s*["']%Y-%m-01["']\s*\)/i.test(match[3])) {
        const d = new Date();
        val = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)).toISOString();
      }

      if (op === "=" || op === "IS") {
        if (val === null) builder = builder.is(col, null);
        else builder = builder.eq(col, val);
      } else if (op === "!=" || op === "<>" || op === "IS NOT") {
        if (val === null) builder = builder.not(col, "is", null);
        else builder = builder.neq(col, val);
      } else if (op === "<") {
        builder = builder.lt(col, val);
      } else if (op === "<=") {
        builder = builder.lte(col, val);
      } else if (op === ">") {
        builder = builder.gt(col, val);
      } else if (op === ">=") {
        builder = builder.gte(col, val);
      } else if (op === "LIKE" || op === "ILIKE") {
        builder = builder.ilike(col, val);
      }
    }
  }

  return builder;
}

/**
 * Executa uma query através do Supabase HTTPS Client
 */
async function executeSupabaseQuery(sql: string, params: any[] = []): Promise<any[]> {
  const norm = normalizeParams(sql, params);
  let cleanSql = norm.sql.replace(/FOR\s+UPDATE(?:\s+OF\s+[a-zA-Z0-9_,\s]+)?/gi, "").trim();
  const currentParams = norm.params;

  // 1. SELECT 1 (Health Check)
  if (/^SELECT\s+1$/i.test(cleanSql)) {
    return [{ "?column?": 1 }];
  }

  // 2. JOIN Queries personalizadas
  // survey_links JOIN management_batches
  if (/FROM\s+survey_links\s+(?:l\s+)?(?:LEFT\s+)?JOIN\s+management_batches/i.test(cleanSql)) {
    const whereMatch = cleanSql.match(/WHERE\s+([\s\S]+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);
    let lBuilder = supabaseAdmin.from("survey_links").select("*");
    if (whereMatch) {
      lBuilder = applyWhere(lBuilder, whereMatch[1], currentParams);
    }
    lBuilder = lBuilder.order("created_at", { ascending: false });
    const { data: links, error: lErr } = await lBuilder;
    if (lErr) throw new Error(lErr.message);

    const { data: batches } = await supabaseAdmin.from("management_batches").select("*");
    const batchMap = new Map<string, any>((batches || []).map((b: any) => [b.id, b]));

    return (links || []).map((l: any) => {
      const b = batchMap.get(l.batch_id) || {};
      return {
        ...l,
        batch_title: b.title || null,
        batch_sector: b.sector || null,
        batch_color: b.color || null,
        batch_closed: b.closed_at ? true : false,
        closed_at: b.closed_at || null,
      };
    });
  }

  // colaborador/surveys / assignments JOIN surveys
  if (/FROM\s+survey_assignments\s+(?:sa\s+)?(?:INNER\s+|LEFT\s+)?JOIN\s+surveys/i.test(cleanSql)) {
    const whereMatch = cleanSql.match(/WHERE\s+([\s\S]+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);
    let saBuilder = supabaseAdmin.from("survey_assignments").select("*");
    if (whereMatch) {
      saBuilder = applyWhere(saBuilder, whereMatch[1], currentParams);
    }
    const { data: assignments, error: saErr } = await saBuilder;
    if (saErr) throw new Error(saErr.message);

    const { data: surveys } = await supabaseAdmin.from("surveys").select("*");
    const surveyMap = new Map<string, any>((surveys || []).map((s: any) => [s.id, s]));

    return (assignments || []).map((sa: any) => {
      const s = surveyMap.get(sa.survey_id) || {};
      return {
        ...sa,
        title: s.title || null,
        description: s.description || null,
        questions: s.questions || null,
        expires_at: s.expires_at || s.ends_at || null,
      };
    });
  }

  // colaborador/history: responses LEFT JOIN surveys
  if (/FROM\s+responses\s+(?:r\s+)?(?:LEFT\s+)?JOIN\s+surveys/i.test(cleanSql)) {
    const whereMatch = cleanSql.match(/WHERE\s+([\s\S]+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);
    let rBuilder = supabaseAdmin.from("responses").select("*");
    if (whereMatch) {
      rBuilder = applyWhere(rBuilder, whereMatch[1], currentParams);
    }
    rBuilder = rBuilder.order("created_at", { ascending: false });
    const { data: responses, error: rErr } = await rBuilder;
    if (rErr) throw new Error(rErr.message);

    const { data: surveys } = await supabaseAdmin.from("surveys").select("*");
    const surveyMap = new Map<string, any>((surveys || []).map((s: any) => [s.id, s]));

    return (responses || []).map((r: any) => {
      const s = surveyMap.get(r.survey_id) || {};
      return {
        ...r,
        survey_title: s.title || r.survey_type || "Pesquisa",
      };
    });
  }

  // 3. Standard SELECT Queries
  const selectMatch = cleanSql.match(
    /^SELECT\s+([\s\S]+?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+?))?(?:\s+LIMIT\s+(\d+|\$\d+))?$/i,
  );
  if (selectMatch) {
    const rawCols = selectMatch[1].trim();
    const table = selectMatch[2].trim();
    const rawWhere = selectMatch[3]?.trim();
    const rawOrderBy = selectMatch[4]?.trim();
    const rawLimit = selectMatch[5]?.trim();

    const isCount = /^COUNT\s*\(\s*\*\s*\)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?$/i.test(rawCols);

    if (isCount) {
      let builder = supabaseAdmin.from(table).select("*", { count: "exact", head: true });
      if (rawWhere) builder = applyWhere(builder, rawWhere, currentParams);
      const { count, error } = await builder;
      if (error) throw new Error(`Supabase count error on table ${table}: ${error.message}`);
      const aliasMatch = rawCols.match(/(?:AS\s+)?([a-zA-Z0-9_]+)$/i);
      const colName = aliasMatch && aliasMatch[1] !== "COUNT(*)" ? aliasMatch[1] : "count";
      return [{ [colName]: count || 0 }];
    }

    let cols = "*";
    if (rawCols !== "*") {
      cols = rawCols
        .split(",")
        .map((c) => {
          const parts = c.trim().split(/\s+as\s+/i);
          return parts[0].trim().split(".").pop()!;
        })
        .join(",");
    }

    let builder = supabaseAdmin.from(table).select(cols);
    if (rawWhere) builder = applyWhere(builder, rawWhere, currentParams);

    if (rawOrderBy) {
      const orderClauses = rawOrderBy.split(",");
      for (const clause of orderClauses) {
        const [colRaw, dir] = clause.trim().split(/\s+/);
        const col = colRaw.split(".").pop()!;
        builder = builder.order(col, { ascending: !dir || dir.toLowerCase() === "asc" });
      }
    }

    if (rawLimit) {
      const limitVal = rawLimit.startsWith("$")
        ? currentParams[parseInt(rawLimit.slice(1), 10) - 1]
        : parseInt(rawLimit, 10);
      builder = builder.limit(limitVal);
    }

    const { data, error } = await builder;
    if (error) throw new Error(`Supabase select error on table ${table}: ${error.message}`);
    return data || [];
  }

  // 4. INSERT Queries
  const insertMatch = cleanSql.match(
    /^INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([\s\S]+?)\)\s*VALUES\s*\(([\s\S]+?)\)(?:\s+RETURNING\s+([\s\S]+))?$/i,
  );
  if (insertMatch) {
    const table = insertMatch[1].trim();
    const colNames = insertMatch[2].split(",").map((c) => c.trim().replace(/["'`]/g, ""));
    const valPlaceholders = insertMatch[3].split(",").map((v) => v.trim());
    const returning = insertMatch[4]?.trim() || "*";

    const row: Record<string, any> = {};
    colNames.forEach((col, idx) => {
      row[col] = extractValue(valPlaceholders[idx], currentParams);
    });

    const { data, error } = await supabaseAdmin
      .from(table)
      .insert(row)
      .select(returning === "*" ? "*" : returning);

    if (error) throw new Error(`Supabase insert error on table ${table}: ${error.message}`);
    return data || [{ rowCount: 1 }];
  }

  // 5. UPDATE Queries (incluindo toggle NOT active)
  const updateMatch = cleanSql.match(
    /^UPDATE\s+([a-zA-Z0-9_]+)(?:\s+[a-zA-Z0-9_]+)?(?:\s+(?:JOIN|LEFT\s+JOIN)\s+[\s\S]+?)?\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+?))?$/i,
  );
  if (updateMatch) {
    const table = updateMatch[1].trim();
    const setClause = updateMatch[2].trim();
    const whereClause = updateMatch[3]?.trim();

    const updates: Record<string, any> = {};
    const setPairs = setClause.split(/,(?![^(]*\))/);
    let isToggleActive = false;

    for (const pair of setPairs) {
      const [colRaw, valRaw] = pair.split("=").map((s) => s.trim());
      const col = colRaw.split(".").pop()!.replace(/["'`]/g, "");
      if (valRaw && /NOT\s+[a-zA-Z0-9_.]+/i.test(valRaw)) {
        isToggleActive = true;
      } else {
        updates[col] = extractValue(valRaw, currentParams);
      }
    }

    if (isToggleActive) {
      // Busca registro atual para inverter valor
      let q = supabaseAdmin.from(table).select("*");
      if (whereClause) q = applyWhere(q, whereClause, currentParams);
      const { data: existing } = await q;
      if (existing && existing.length > 0) {
        for (const item of existing) {
          await supabaseAdmin
            .from(table)
            .update({ active: !item.active })
            .eq("id", item.id);
        }
        return existing;
      }
      return [];
    }

    let builder = supabaseAdmin.from(table).update(updates);
    if (whereClause) builder = applyWhere(builder, whereClause, currentParams);
    const { data, error } = await builder.select();
    if (error) throw new Error(`Supabase update error on table ${table}: ${error.message}`);
    return data || [];
  }

  // 6. DELETE Queries
  const deleteMatch = cleanSql.match(/^DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([\s\S]+?))?$/i);
  if (deleteMatch) {
    const table = deleteMatch[1].trim();
    const whereClause = deleteMatch[2]?.trim();

    let builder = supabaseAdmin.from(table).delete();
    if (whereClause) builder = applyWhere(builder, whereClause, currentParams);
    const { data, error } = await builder.select();
    if (error) throw new Error(`Supabase delete error on table ${table}: ${error.message}`);
    return data || [];
  }

  console.warn("Query fallback execution:", cleanSql);
  return [];
}

function wrapClient(): DbConnection {
  return {
    async execute(sql: string, params: any[] = []) {
      const rows = await executeSupabaseQuery(sql, params);
      return [rows, { rowCount: rows.length }];
    },
    async query(sql: string, params: any[] = []) {
      const rows = await executeSupabaseQuery(sql, params);
      return [rows, { rowCount: rows.length }];
    },
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
  };
}

/**
 * Retorna o pool / connection interface para queries do Supabase
 */
export function getPool(): ExtendedPool {
  return {
    async query(sql: string, params: any[] = []) {
      const rows = await executeSupabaseQuery(sql, params);
      return { rows, rowCount: rows.length };
    },
    async getConnection() {
      return wrapClient();
    },
  };
}

/**
 * Inicialização e verificação de conexão com o Supabase
 */
async function initializeDatabase(): Promise<void> {
  if (isInitialized) return;

  try {
    const { data, error } = await supabaseAdmin.from("users").select("id").limit(1);
    if (error) throw error;
    isInitialized = true;
    console.log("✅ Conexão com Supabase HTTPS estabelecida com sucesso.");
  } catch (err: any) {
    console.error("⚠️ Falha ao conectar ao Supabase:", err.message);
    throw new Error("Banco de dados Supabase indisponível: " + err.message);
  }
}

export async function initDatabase(): Promise<void> {
  if (isInitialized) return;
  if (!initializing) {
    initializing = initializeDatabase().finally(() => {
      initializing = null;
    });
  }
  await initializing;
}

/**
 * Executa uma consulta SQL parametrizada retornando múltiplas linhas
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return (await executeSupabaseQuery(sql, params)) as T[];
}

/**
 * Executa uma consulta SQL parametrizada retornando uma única linha
 */
export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Executa uma instrução SQL de inserção/atualização/remoção
 */
export async function execute(sql: string, params: any[] = []): Promise<{ rowCount: number }> {
  const rows = await executeSupabaseQuery(sql, params);
  return { rowCount: Array.isArray(rows) ? rows.length : 1 };
}
