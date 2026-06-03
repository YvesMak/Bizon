// Provider Flutterwave — encapsule les appels HTTP à l'API Flutterwave v3.
// Utilise `fetch` natif (Node ≥ 18). Aucune dépendance externe.
const crypto = require('crypto');
const config = require('../../../config/flutterwave');

async function flwFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Réponse Flutterwave illisible (HTTP ${res.status})`);
  }

  if (!res.ok || json.status === 'error') {
    throw new Error(json.message || `Erreur Flutterwave (HTTP ${res.status})`);
  }
  return json;
}

const FlutterwaveProvider = {
  /**
   * Crée un lien de paiement hébergé (Standard).
   * Supporte Mobile Money (MTN/Orange) ET cartes côté page Flutterwave.
   * @returns {Promise<{link: string, tx_ref: string}>}
   */
  async createPaymentLink({ tx_ref, amount, customer, redirectUrl, meta }) {
    const payload = {
      tx_ref,
      amount: Number(amount),
      currency: config.currency,
      redirect_url: redirectUrl,
      payment_options: 'mobilemoneyfranco,card',
      customer: {
        email: customer.email || 'client@bizon.cm',
        phonenumber: customer.phone || undefined,
        name: customer.name || 'Client Bizon'
      },
      customizations: {
        title: 'Bizon',
        description: meta?.description || 'Paiement de commande'
      },
      meta: meta || {}
    };

    const json = await flwFetch('/payments', { method: 'POST', body: payload });
    return { link: json.data.link, tx_ref };
  },

  /**
   * Vérifie une transaction côté serveur (source de vérité).
   * @returns {Promise<object>} l'objet `data` de la transaction
   */
  async verifyTransaction(transactionId) {
    const json = await flwFetch(`/transactions/${transactionId}/verify`, { method: 'GET' });
    return json.data;
  },

  /**
   * Vérifie la signature d'un webhook (header `verif-hash` == secret hash du dashboard).
   * Comparaison à temps constant.
   */
  verifyWebhookSignature(receivedHash) {
    const expected = config.webhookHash;
    if (!expected) return false;          // pas de hash configuré → on refuse
    if (!receivedHash) return false;
    const a = Buffer.from(String(receivedHash));
    const b = Buffer.from(String(expected));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
};

module.exports = FlutterwaveProvider;
