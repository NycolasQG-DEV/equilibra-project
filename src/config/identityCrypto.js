const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

let cachedKey = null;

function key() {
  if (cachedKey) return cachedKey;

  const configured = process.env.EQUILIBRA_DATA_KEY;
  if (configured) {
    try {
      const value = Buffer.from(configured, 'base64');
      if (value.length === 32) {
        cachedKey = value;
        return value;
      }
    } catch {
      // Ignora erro de base64 e usa derivação sha256 abaixo
    }
    cachedKey = crypto.createHash('sha256').update(configured).digest();
    return cachedKey;
  }

  // Se não houver EQUILIBRA_DATA_KEY definida, usa segredo existente do ambiente como semente
  const fallbackSeed = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.GROQ_API_KEY;
  if (fallbackSeed) {
    cachedKey = crypto.createHash('sha256').update(`equilibra-identity-salt:${fallbackSeed}`).digest();
    return cachedKey;
  }

  // Tenta persistir ou ler .identity-key no disco
  const directory = process.env.EQUILIBRA_DATA_DIR || path.join(__dirname, '..', '..', 'data');
  const file = path.join(directory, '.identity-key');
  try {
    fs.mkdirSync(directory, { recursive: true });
    if (!fs.existsSync(file)) {
      const generated = crypto.randomBytes(32);
      fs.writeFileSync(file, generated, { flag: 'wx', mode: 0o600 });
      cachedKey = generated;
      return generated;
    }
    cachedKey = fs.readFileSync(file);
    return cachedKey;
  } catch (err) {
    // Se o diretório for somente leitura ou houver erro de permissão
    cachedKey = crypto.createHash('sha256').update('equilibra-fallback-memory-key-2026').digest();
    return cachedKey;
  }
}

function encryptPhone(phone) {
  if (!phone) return '';
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
    const encrypted = Buffer.concat([cipher.update(phone, 'utf8'), cipher.final()]);
    return `enc:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
  } catch (err) {
    console.error('[Crypto] Falha ao criptografar telefone:', err.message);
    return phone;
  }
}

function decryptPhone(value) {
  if (!value || typeof value !== 'string' || !value.startsWith('enc:')) return value || '';
  try {
    const [, iv, tag, encrypted] = value.split(':');
    if (!iv || !tag || !encrypted) return value;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
  } catch (err) {
    console.error('[Crypto] Falha ao descriptografar telefone:', err.message);
    return '';
  }
}

module.exports = { encryptPhone, decryptPhone };
