/**
 * Supabase Storage Adapter para o Equilibra
 * Conexão direta com PostgreSQL em nuvem via @supabase/supabase-js.
 *
 * Variáveis de ambiente:
 *   SUPABASE_URL              - URL do projeto (https://xxxx.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY - Chave de serviço (para acesso backend seguro)
 *   SUPABASE_KEY              - Chave de fallback (caso service role não seja informada)
 */

const { createClient } = require('@supabase/supabase-js');

const TABLES = ['accounts', 'members', 'groups', 'surveys', 'reports', 'invitations', 'responses', 'sessions', 'management'];

let client = null;

function isEnabled() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  return Boolean(url && key);
}

function getClient() {
  if (!isEnabled()) return null;
  if (!client) {
    const url = process.env.SUPABASE_URL.trim();
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY).trim();
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return client;
}

/**
 * Carrega todas as coleções do Supabase para memória inicial.
 * @returns {Promise<Record<string, Array>>}
 */
async function loadAll() {
  const sb = getClient();
  if (!sb) return null;

  const result = {};

  for (const table of TABLES) {
    try {
      const { data, error } = await sb
        .from(table)
        .select('id, data');

      if (error) {
        console.warn(`[Supabase] Aviso ao ler tabela "${table}":`, error.message);
        result[table] = [];
      } else {
        // Converte os registros { id, data } para a lista original de objetos JSON
        result[table] = (data || []).map((row) => ({
          ...row.data,
          id: row.id || row.data?.id
        }));
      }
    } catch (err) {
      console.error(`[Supabase] Erro ao carregar "${table}":`, err.message);
      result[table] = [];
    }
  }

  return result;
}

/**
 * Sincroniza uma coleção inteira com o Supabase.
 * @param {string} table
 * @param {Array} items
 */
async function syncCollection(table, items) {
  const sb = getClient();
  if (!sb || !TABLES.includes(table)) return;

  if (!Array.isArray(items) || items.length === 0) {
    // Se a coleção foi limpa, remove todos os registros da tabela
    await sb.from(table).delete().neq('id', '___non_existent___').catch(() => {});
    return;
  }

  // Prepara registros para upsert
  const rows = items.map((item, index) => {
    // Garante um identificador único (sessions ou outros itens podem usar tokenHash ou id)
    const rowId = String(item.id || item.tokenHash || `${table}-${index}`);
    return {
      id: rowId,
      data: item,
      updated_at: new Date().toISOString()
    };
  });

  // Executa upsert em lote
  const { error } = await sb.from(table).upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error(`[Supabase] Erro ao persistir "${table}":`, error.message);
  }
}

/**
 * Sincroniza múltiplas coleções com o Supabase.
 * @param {Record<string, Array>} changes
 */
async function syncMany(changes) {
  const sb = getClient();
  if (!sb) return;

  const promises = Object.entries(changes).map(([table, items]) => syncCollection(table, items));
  await Promise.allSettled(promises);
}

module.exports = {
  isEnabled,
  getClient,
  loadAll,
  syncCollection,
  syncMany,
  TABLES
};

