const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function key() {
  const configured = process.env.EQUILIBRA_DATA_KEY;
  if (configured) {
    const value = Buffer.from(configured, 'base64');
    if (value.length !== 32) throw new Error('EQUILIBRA_DATA_KEY precisa conter 32 bytes em base64.');
    return value;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('EQUILIBRA_DATA_KEY é obrigatória em produção.');
  const directory = process.env.EQUILIBRA_DATA_DIR || path.join(__dirname, '..', '..', 'data');
  const file = path.join(directory, '.identity-key');
  fs.mkdirSync(directory, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32), { flag: 'wx', mode: 0o600 });
  return fs.readFileSync(file);
}

function encryptPhone(phone) {
  if (!phone) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(phone, 'utf8'), cipher.final()]);
  return `enc:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptPhone(value) {
  if (!value || typeof value !== 'string' || !value.startsWith('enc:')) return value || '';
  const [, iv, tag, encrypted] = value.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = { encryptPhone, decryptPhone };
