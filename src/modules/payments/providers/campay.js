// Provider Campay — Mobile Money Cameroun (MTN MoMo + Orange Money).
// Flux « collect » : on déclenche une demande de paiement, le client valide
// via USSD sur son téléphone, puis on suit le statut. `fetch` natif (Node ≥ 18).
//
// Multi-compte (Modèle B) : chaque méthode accepte des identifiants `creds`
// optionnels { username, password, baseUrl, webhookKey }. Sans `creds`, on
// retombe sur la configuration globale (.env) — rétro-compatible.
const jwt = require('jsonwebtoken');
const config = require('../../../config/campay');

// Cache de token par compte (clé : baseUrl + username).
const tokenCache = new Map();

// Complète des identifiants partiels avec la config globale.
function buildCreds(creds) {
  const c = creds || {};
  return {
    username: c.username || config.username,
    password: c.password || config.password,
    baseUrl: c.baseUrl || config.baseUrl,
    webhookKey: c.webhookKey != null ? c.webhookKey : config.webhookKey
  };
}

// Normalise un numéro camerounais au format attendu par Campay : 2376XXXXXXXX.
function normalizePhone(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.startsWith('00237')) d = d.slice(2);
  if (d.startsWith('237')) return d;
  if (d.startsWith('0')) d = d.slice(1);
  return `237${d}`;
}

async function campayFetch(baseUrl, path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Token ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let json;
  try { json = await res.json(); } catch { throw new Error(`Réponse Campay illisible (HTTP ${res.status})`); }
  if (!res.ok) {
    throw new Error(json.message || json.detail || `Erreur Campay (HTTP ${res.status})`);
  }
  return json;
}

const CampayProvider = {
  name: 'campay',
  currency: config.currency,

  isConfigured(creds) {
    const c = buildCreds(creds);
    return Boolean(c.username && c.password);
  },

  async getToken(creds, force = false) {
    const c = buildCreds(creds);
    const cacheKey = `${c.baseUrl}::${c.username}`;
    const cached = tokenCache.get(cacheKey);
    const now = Date.now();
    if (!force && cached && now < cached.expiresAt) return cached.token;

    const json = await campayFetch(c.baseUrl, '/api/token/', {
      method: 'POST',
      body: { username: c.username, password: c.password }
    });
    if (!json.token) throw new Error('Authentification Campay échouée (token manquant)');
    const ttlMs = (Number(json.expires_in) ? Number(json.expires_in) * 1000 : 10 * 60 * 1000) - 30000;
    tokenCache.set(cacheKey, { token: json.token, expiresAt: now + Math.max(ttlMs, 60000) });
    return json.token;
  },

  /**
   * Déclenche une demande de paiement Mobile Money (le client valide par USSD).
   * @returns {Promise<{reference: string, status: string, ussd_code?: string, operator?: string}>}
   */
  async collect({ amount, phone, description, externalReference }, creds) {
    const c = buildCreds(creds);
    const token = await this.getToken(creds);
    const json = await campayFetch(c.baseUrl, '/api/collect/', {
      method: 'POST',
      token,
      body: {
        amount: String(amount),
        currency: config.currency,
        from: normalizePhone(phone),
        description: description || 'Paiement Bizon',
        external_reference: externalReference || ''
      }
    });
    return json; // { reference, status, ussd_code, operator, ... }
  },

  /**
   * Décaissement (remboursement) : envoie de l'argent depuis le compte du
   * restaurant vers un numéro Mobile Money. Endpoint Campay : POST /api/withdraw/.
   * @returns {Promise<{reference: string, status?: string}>}
   */
  async disburse({ amount, phone, description, externalReference }, creds) {
    const c = buildCreds(creds);
    const token = await this.getToken(creds);
    const json = await campayFetch(c.baseUrl, '/api/withdraw/', {
      method: 'POST',
      token,
      body: {
        amount: String(amount),
        currency: config.currency,
        to: normalizePhone(phone),
        description: description || 'Remboursement Bizon',
        external_reference: externalReference || ''
      }
    });
    return json; // { reference, status, ... }
  },

  /**
   * Statut d'une transaction (source de vérité).
   * Normalise vers { status: 'successful'|'failed'|'pending', ... }.
   */
  async verifyTransaction(reference, creds) {
    const c = buildCreds(creds);
    const token = await this.getToken(creds);
    const json = await campayFetch(c.baseUrl, `/api/transaction/${reference}/`, { token });
    const raw = String(json.status || '').toUpperCase();
    const status = raw === 'SUCCESSFUL' ? 'successful'
      : (raw === 'FAILED' ? 'failed' : 'pending');
    return {
      status,
      raw,
      amount: json.amount,
      currency: json.currency,
      reference: json.reference || reference,
      external_reference: json.external_reference,
      operator: json.operator
    };
  },

  /**
   * Vérifie la signature (JWT) d'un webhook Campay avec la clé webhook du compte.
   * Renvoie false si pas de clé configurée ou signature invalide.
   * (Le règlement re-vérifie de toute façon la transaction côté API.)
   */
  verifyWebhookSignature(signature, creds) {
    const c = buildCreds(creds);
    if (!c.webhookKey || !signature) return false;
    try { jwt.verify(signature, c.webhookKey); return true; } catch { return false; }
  },

  _normalizePhone: normalizePhone
};

module.exports = CampayProvider;
