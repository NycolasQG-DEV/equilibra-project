const fs = require('node:fs');
const path = require('node:path');
const directory = process.env.EQUILIBRA_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const files = Object.fromEntries(['accounts', 'members', 'groups', 'surveys', 'reports', 'invitations', 'responses', 'sessions', 'management'].map((name) => [name, path.join(directory, `${name}.json`)]));
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
function read(name) { initializeStorage(); return JSON.parse(fs.readFileSync(files[name], 'utf8')); }
function backup() {
  const backupDirectory = path.join(directory, 'backups', new Date().toISOString().slice(0, 10));
  if (fs.existsSync(path.join(backupDirectory, '.complete'))) return;
  fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  for (const filename of [...Object.values(files), path.join(directory, '.identity-key')]) {
    if (fs.existsSync(filename)) fs.copyFileSync(filename, path.join(backupDirectory, path.basename(filename)));
  }
  fs.writeFileSync(path.join(backupDirectory, '.complete'), new Date().toISOString(), { mode: 0o600 });
}
function rawWrite(name, value) {
  const temporary = `${files[name]}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, files[name]);
}
function writeMany(changes) {
  initializeStorage();
  for (const name of Object.keys(changes)) if (!files[name]) throw new Error('Coleção desconhecida.');
  backup();
  const journal = path.join(directory, '.transaction.json');
  const temporary = `${journal}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(changes), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, journal);
  for (const [name, value] of Object.entries(changes)) rawWrite(name, value);
  fs.unlinkSync(journal);
}
function write(name, value) { writeMany({ [name]: value }); }
module.exports = { initializeStorage, read, write, writeMany, backup, directory };
