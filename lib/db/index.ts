import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

// ── Leitura de configurações do .env ──
const dbHost = process.env.DB_HOST || "localhost";
const dbPort = parseInt(process.env.DB_PORT || "3306", 10);
const dbUser = process.env.DB_USER || "root";
const dbPassword = process.env.DB_PASSWORD || "";
const dbName = process.env.DB_NAME || "equilibra_db";

let pool: mysql.Pool | null = null;
let isInitialized = false;

/**
 * Retorna ou cria a instância do Pool MySQL
 */
export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      multipleStatements: true,
    });
  }
  return pool;
}

/**
 * Converte queries com placeholders $1, $2, $1 para ? do MySQL,
 * reordenando/duplicando os parâmetros para corresponder exatamente à ordem dos '?'
 * e adaptando sintaxes comuns como ON CONFLICT (...) DO NOTHING para MySQL.
 */
function normalizeQueryAndParams(sql: string, params: any[] = []): { sql: string; params: any[] } {
  let transformedSql = sql;

  // Substitui ON CONFLICT (...) DO NOTHING por ON DUPLICATE KEY UPDATE id=id
  transformedSql = transformedSql.replace(
    /ON\s+CONFLICT\s*\([^)]*\)\s*DO\s+NOTHING/gi,
    "ON DUPLICATE KEY UPDATE id=id"
  );

  // Se a query contiver $1, $2, etc., mapeia os parâmetros para a ordem de aparição dos ?
  if (/\$\d+/.test(transformedSql)) {
    const newParams: any[] = [];
    transformedSql = transformedSql.replace(/\$(\d+)/g, (_, indexStr) => {
      const idx = parseInt(indexStr, 10) - 1;
      newParams.push(params[idx]);
      return "?";
    });
    return { sql: transformedSql, params: newParams };
  }

  return { sql: transformedSql, params };
}

/**
 * Inicialização e criação automática de banco de dados e tabelas no MySQL
 */
export async function initDatabase(): Promise<void> {
  if (isInitialized) return;

  try {
    const initConn = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
    });

    await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await initConn.end();

    const p = getPool();
    const schemaPath = path.join(process.cwd(), "lib", "db", "schema.sql");
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, "utf-8");
      await p.query(sql);
      console.log(`✅ Banco de dados MySQL (${dbName}) inicializado e sincronizado com sucesso.`);
    }

    isInitialized = true;
  } catch (err: any) {
    console.warn("⚠️ Aviso de inicialização MySQL:", err.message);
  }
}

/**
 * Executa uma consulta SQL parametrizada retornando múltiplas linhas
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const p = getPool();
  const normalized = normalizeQueryAndParams(sql, params);
  try {
    const [rows] = await p.execute(normalized.sql, normalized.params);
    return rows as T[];
  } catch (error: any) {
    console.error("❌ Erro ao executar query MySQL:", { sql: normalized.sql, params: normalized.params, error: error.message });
    throw error;
  }
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
  const p = getPool();
  const normalized = normalizeQueryAndParams(sql, params);
  try {
    const [result] = await p.execute(normalized.sql, normalized.params);
    const affected = (result as mysql.ResultSetHeader).affectedRows ?? 0;
    return { rowCount: affected };
  } catch (error: any) {
    console.error("❌ Erro ao executar comando MySQL:", { sql: normalized.sql, params: normalized.params, error: error.message });
    throw error;
  }
}
