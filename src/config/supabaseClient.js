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
  if (process.env.NODE_ENV === 'test' || process.env.SUPABASE_DISABLE_SYNC === 'true') {
    return false;
  }
  if (process.env.EQUILIBRA_DATA_DIR && (process.env.EQUILIBRA_DATA_DIR.includes('equilibra-') || process.env.EQUILIBRA_DATA_DIR.includes('tmp'))) {
    return false;
  }
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
 * Realiza upsert dos itens vigentes E deleta do banco qualquer item que tenha sido removido.
 * @param {string} table
 * @param {Array} items
 */
async function syncCollection(table, items) {
  const sb = getClient();
  if (!sb || !TABLES.includes(table)) return;

  if (!Array.isArray(items) || items.length === 0) {
    // Se a coleção foi esvaziada, remove todos os registros da tabela no Supabase
    try {
      const { error } = await sb.from(table).delete().neq('id', '___non_existent___');
      if (error) {
        console.error(`[Supabase] Erro ao limpar tabela "${table}":`, error.message);
      }
    } catch (err) {
      console.error(`[Supabase] Falha ao limpar tabela "${table}":`, err.message);
    }
    return;
  }

  // Prepara registros para upsert
  const rows = items.map((item, index) => {
    // Garante identificador único consistente
    const rowId = String(item.id || item.tokenHash || `${table}-${index}`);
    return {
      id: rowId,
      data: item,
      updated_at: new Date().toISOString()
    };
  });

  const targetIds = new Set(rows.map((r) => r.id));

  // 1. Executa upsert em lotes de 100 para evitar limites de payload
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await sb.from(table).upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`[Supabase] Erro ao persistir lote em "${table}":`, error.message);
    }
  }

  // 2. Reconciliação de deleção: busca todos os IDs existentes no banco e remove os órfãos
  try {
    let allDbIds = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data: idBatch, error: idErr } = await sb
        .from(table)
        .select('id')
        .range(from, from + pageSize - 1);
      if (idErr || !idBatch || idBatch.length === 0) break;
      allDbIds.push(...idBatch.map((r) => r.id));
      if (idBatch.length < pageSize) break;
      from += pageSize;
    }

    const idsToDelete = allDbIds.filter((id) => !targetIds.has(id));
    if (idsToDelete.length > 0) {
      console.log(`[Supabase] Removendo ${idsToDelete.length} registro(s) excluído(s) da tabela "${table}"...`);
      await deleteByIds(table, idsToDelete);
    }
  } catch (err) {
    console.error(`[Supabase] Falha na reconciliação de deleções em "${table}":`, err.message);
  }
}

/**
 * Deleta um registro específico pelo seu ID no Supabase.
 * @param {string} table
 * @param {string} id
 */
async function deleteById(table, id) {
  const sb = getClient();
  if (!sb || !TABLES.includes(table) || !id) return;
  try {
    const { error } = await sb.from(table).delete().eq('id', String(id));
    if (error) {
      console.error(`[Supabase] Erro ao deletar "${id}" de "${table}":`, error.message);
    }
  } catch (err) {
    console.error(`[Supabase] Falha ao deletar "${id}" de "${table}":`, err.message);
  }
}

/**
 * Deleta uma lista de registros pelos seus IDs no Supabase em lotes seguros.
 * @param {string} table
 * @param {string[]} ids
 */
async function deleteByIds(table, ids) {
  const sb = getClient();
  if (!sb || !TABLES.includes(table) || !Array.isArray(ids) || ids.length === 0) return;
  const uniqueIds = [...new Set(ids.map(String))];
  const BATCH_SIZE = 100;
  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await sb.from(table).delete().in('id', batch);
      if (error) {
        console.error(`[Supabase] Erro ao deletar lote de IDs em "${table}":`, error.message);
      }
    } catch (err) {
      console.error(`[Supabase] Falha ao deletar lote de IDs em "${table}":`, err.message);
    }
  }
}

/**
 * Deleta registros filtrados por uma coluna/campo JSONB.
 * @param {string} table
 * @param {string} fieldPath Ex: 'data->>surveyId' ou 'data->>accountId'
 * @param {string} value
 */
async function deleteByJsonField(table, fieldPath, value) {
  const sb = getClient();
  if (!sb || !TABLES.includes(table) || !fieldPath || !value) return;
  try {
    const { error } = await sb.from(table).delete().filter(fieldPath, 'eq', String(value));
    if (error) {
      console.error(`[Supabase] Erro ao deletar onde ${fieldPath} = ${value} em "${table}":`, error.message);
    }
  } catch (err) {
    console.error(`[Supabase] Falha ao deletar onde ${fieldPath} = ${value} em "${table}":`, err.message);
  }
}

/**
 * Remove registros órfãos que possam ter sobrado de operações anteriores no Supabase.
 */
async function purgeOrphans() {
  const sb = getClient();
  if (!sb) return;
  try {
    const data = await loadAll();
    if (!data) return;
    const accountIds = new Set((data.accounts || []).map((a) => a.id));
    const surveyIds = new Set((data.surveys || []).map((s) => s.id));

    const orphanedSurveys = (data.surveys || []).filter((s) => s.accountId && !accountIds.has(s.accountId)).map((s) => s.id);
    const orphanedInvites = (data.invitations || []).filter((i) => i.surveyId && !surveyIds.has(i.surveyId)).map((i) => i.id);
    const orphanedResponses = (data.responses || []).filter((r) => r.surveyId && !surveyIds.has(r.surveyId)).map((r) => r.id);
    const orphanedReports = (data.reports || []).filter((r) => r.surveyId && !surveyIds.has(r.surveyId)).map((r) => r.id);

    if (orphanedSurveys.length > 0) await deleteByIds('surveys', orphanedSurveys);
    if (orphanedInvites.length > 0) await deleteByIds('invitations', orphanedInvites);
    if (orphanedResponses.length > 0) await deleteByIds('responses', orphanedResponses);
    if (orphanedReports.length > 0) await deleteByIds('reports', orphanedReports);

    if (orphanedSurveys.length || orphanedInvites.length || orphanedResponses.length || orphanedReports.length) {
      console.log(`[Supabase] Limpeza de órfãos concluída: ${orphanedSurveys.length} pesquisas, ${orphanedInvites.length} convites, ${orphanedResponses.length} respostas, ${orphanedReports.length} relatórios.`);
    }
  } catch (err) {
    console.error('[Supabase] Erro ao limpar órfãos:', err.message);
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
  deleteById,
  deleteByIds,
  deleteByJsonField,
  purgeOrphans,
  TABLES
};

