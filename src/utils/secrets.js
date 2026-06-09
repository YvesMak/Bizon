// Chiffrement symétrique des secrets stockés en base (ex. identifiants de
// paiement par restaurant). AES-256-GCM (confidentialité + intégrité).
//
// Clé : APP_SECRETS_KEY (recommandé en prod, 32+ octets). À défaut, on dérive
// une clé de JWT_SECRET pour le dev/test. ⚠️ En production, définir une vraie
// APP_SECRETS_KEY distincte et la garder hors du dépôt.
const crypto = require('crypto');

const PREFIX = 'enc:v1:';

function deriveKey() {
  const material = process.env.APP_SECRETS_KEY || process.env.JWT_SECRET || 'bizon-dev-secret';
  // scrypt → 32 octets déterministes (sel fixe : la clé reste dérivée du secret).
  return crypto.scryptSync(material, 'bizon-secrets-salt', 32);
}

/**
 * Chiffre une chaîne. Renvoie un blob "enc:v1:<iv>:<tag>:<ciphertext>" (base64).
 */
function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return '';
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

/**
 * Déchiffre un blob produit par encrypt(). Renvoie null si le format est
 * invalide ou la clé incorrecte (jamais d'exception qui fuit).
 */
function decrypt(blob) {
  if (!blob || typeof blob !== 'string' || !blob.startsWith(PREFIX)) return null;
  try {
    const [ivB64, tagB64, ctB64] = blob.slice(PREFIX.length).split(':');
    const key = deriveKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
    return pt.toString('utf8');
  } catch {
    return null;
  }
}

function isEncrypted(blob) {
  return typeof blob === 'string' && blob.startsWith(PREFIX);
}

module.exports = { encrypt, decrypt, isEncrypted };
