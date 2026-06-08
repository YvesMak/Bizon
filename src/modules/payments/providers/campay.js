// Provider Campay — Mobile Money Cameroun (MTN MoMo + Orange Money).
// Flux « collect » : on déclenche une demande de paiement, le client valide
// via USSD sur son téléphone, puis on suit le statut. `fetch` natif (Node ≥ 18).
const jwt = require('jsonwebtoken');
const config = require('../../../config/campay');

let tokenCache = { token: null, expiresAt: 0 };

// Normalise un numéro camerounais au format attendu par Campay : 2376XXXXXXXX.
function normalizePhone(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.startsWith('00237')) d = d.slice(2);
  if (d.startsWith('237')) return d;
  if (d.startsWith('0')) d = d.slice(1);
  return `237${d}`;
}

async function campayFetch(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Token ${token}`;
  const res = await fetch(`${config.baseUrl}${path}`, {
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

  isConfigured() {
    return config.isConfigured();
  },

  async getToken(force = false) {
    const now = Date.now();
    if (!force && tokenCache.token && now < tokenCache.expiresAt) return tokenCache.token;
    const json = await campayFetch('/api/token/', {
      method: 'POST',
      body: { username: config.username, password: config.password }
    });
    if (!json.token) throw new Error('Authentification Campay échouée (token manquant)');
    const ttlMs = (Number(json.expires_in) ? Number(json.expires_in) * 1000 : 10 * 60 * 1000) - 30000;
    tokenCache = { token: json.token, expiresAt: now + Math.max(ttlMs, 60000) };
    return json.token;
  },

  /**
   * Déclenche une demande de paiement Mobile Money (le client valide par USSD).
   * @returns {Promise<{reference: string, status: string, ussd_code?: string, operator?: string}>}
   */
  async collect({ amount, phone, description, externalReference }) {
    const token = await this.getToken();
    const json = await campayFetch('/api/collect/', {
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
   * Statut d'une transaction (source de vérité).
   * Normalise vers { status: 'successful'|'failed'|'pending', ... }.
   */
  async verifyTransaction(reference) {
    const token = await this.getToken();
    const json = await campayFetch(`/api/transaction/${reference}/`, { token });
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
   * Vérifie la signature (JWT) d'un webhook Campay avec la clé webhook.
   * Renvoie false si pas de clé configurée ou signature invalide.
   * (Le règlement re-vérifie de toute façon la transaction côté API.)
   */
  verifyWebhookSignature(signature) {
    if (!config.webhookKey || !signature) return false;
    try { jwt.verify(signature, config.webhookKey); return true; } catch { return false; }
  },

  _normalizePhone: normalizePhone
};

module.exports = CampayProvider;
