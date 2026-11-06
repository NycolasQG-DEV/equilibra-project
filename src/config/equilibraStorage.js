const fs = require('node:fs');
const path = require('node:path');
const supabase = require('./supabaseClient');

const directory = process.env.EQUILIBRA_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const files = Object.fromEntries(['accounts', 'members', 'groups', 'surveys', 'reports', 'invitations', 'responses', 'sessions', 'management'].map((name) => [name, path.join(directory, `${name}.json`)]));

let memoryCache = null;

/**
 * Carrega todos os dados do Supabase na inicialização do servidor.
 */
async function initSupabaseIfEnabled() {
  if (!supabase.isEnabled()) return false;
  try {
    console.log('[Storage] Carregando coleções do Supabase...');
    const data = await supabase.loadAll();
    if (data) {
      memoryCache = data;
      console.log('✅ [Storage] Supabase conectado e sincronizado com sucesso!');
      if (typeof supabase.purgeOrphans === 'function') {
        supabase.purgeOrphans().catch((err) => {
          console.warn('[Storage] Aviso na purga de órfãos:', err.message);
        });
      }
      return true;
    }
  } catch (err) {
    console.error('❌ [Storage] Falha ao conectar ao Supabase:', err.message);
  }
  return false;
}

function initializeStorage() {
  fs.mkdirSync(directory, { recursive: true });
  for (const file of Object.values(files)) if (!fs.existsSync(file)) fs.writeFileSync(file, '[]\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  const journal = path.join(directory, '.transaction.json');
  if (fs.existsSync(journal)) {
    const pending = JSON.parse(fs.readFileSync(journal, 'utf8'));
    for (const [name, value] of Object.entries(pending)) {
      if (!files[name]) throw new Error('Transação contém coleção desconhecida.');
      rawWrite(name, value);
    }
    fs.unlinkSync(journal);
  }
}

function read(name) {
  if (supabase.isEnabled() && memoryCache && memoryCache[name]) {
    return JSON.parse(JSON.stringify(memoryCache[name]));
  }
  initializeStorage();
  const raw = fs.readFileSync(files[name], 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function backup() {
  try {
    const backupDirectory = path.join(directory, 'backups', new Date().toISOString().slice(0, 10));
    if (fs.existsSync(path.join(backupDirectory, '.complete'))) return;
    fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
    for (const filename of [...Object.values(files), path.join(directory, '.identity-key')]) {
      if (fs.existsSync(filename)) fs.copyFileSync(filename, path.join(backupDirectory, path.basename(filename)));
    }
    fs.writeFileSync(path.join(backupDirectory, '.complete'), new Date().toISOString(), { mode: 0o600 });
  } catch (err) {
    console.error('[Storage] Aviso de backup ignorado:', err.message);
  }
}

function rawWrite(name, value) {
  const temporary = `${files[name]}.${process.pid}.${Date.now()}-${Math.random().toString(36).slice(2, 7)}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try {
    fs.renameSync(temporary, files[name]);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EBUSY') {
      try {
        fs.copyFileSync(temporary, files[name]);
        fs.unlinkSync(temporary);
      } catch {
        fs.writeFileSync(files[name], `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
        try { fs.unlinkSync(temporary); } catch {}
      }
    } else {
      throw err;
    }
  }
}

function writeMany(changes) {
  initializeStorage();
  for (const name of Object.keys(changes)) if (!files[name]) throw new Error('Coleção desconhecida.');

  // Atualiza cache em memória se ativo
  if (memoryCache) {
    for (const [name, value] of Object.entries(changes)) {
      memoryCache[name] = JSON.parse(JSON.stringify(value));
    }
  }

  // Sincroniza assincronamente com o Supabase
  if (supabase.isEnabled()) {
    setImmediate(() => {
      supabase.syncMany(changes).catch((err) => {
        console.error('[Supabase] Erro na persistência assíncrona:', err.message);
      });
    });
  }

  backup();
  const journal = path.join(directory, '.transaction.json');
  const temporary = `${journal}.${process.pid}.${Date.now()}-${Math.random().toString(36).slice(2, 7)}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(changes), { encoding: 'utf8', mode: 0o600 });
  try {
    fs.renameSync(temporary, journal);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EBUSY') {
      try {
        fs.copyFileSync(temporary, journal);
        fs.unlinkSync(temporary);
      } catch {
        fs.writeFileSync(journal, JSON.stringify(changes), { encoding: 'utf8', mode: 0o600 });
        try { fs.unlinkSync(temporary); } catch {}
      }
    } else {
      throw err;
    }
  }

  for (const [name, value] of Object.entries(changes)) rawWrite(name, value);
  try {
    if (fs.existsSync(journal)) fs.unlinkSync(journal);
  } catch {}
}

function write(name, value) { writeMany({ [name]: value }); }

/**
 * Remove registros explicitamente do banco Supabase em segundo plano ou de forma direta.
 */
async function deleteDirectly(table, id) {
  if (supabase.isEnabled() && id) {
    try {
      await supabase.deleteById(table, id);
    } catch (err) {
      console.error(`[Storage] Erro ao deletar diretamente ${id} de ${table}:`, err.message);
    }
  }
}

async function deleteManyDirectly(table, ids) {
  if (supabase.isEnabled() && Array.isArray(ids) && ids.length > 0) {
    try {
      await supabase.deleteByIds(table, ids);
    } catch (err) {
      console.error(`[Storage] Erro ao deletar múltiplos registros de ${table}:`, err.message);
    }
  }
}

module.exports = {
  initializeStorage,
  initSupabaseIfEnabled,
  read,
  write,
  writeMany,
  deleteDirectly,
  deleteManyDirectly,
  backup,
  directory,
  supabase
};
