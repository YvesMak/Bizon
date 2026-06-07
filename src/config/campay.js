// Configuration Campay (Mobile Money Cameroun), lue depuis l'environnement.
require('dotenv').config();

module.exports = {
  username: process.env.CAMPAY_USERNAME,
  password: process.env.CAMPAY_PASSWORD,
  // Sandbox : https://demo.campay.net · Production : https://www.campay.net
  baseUrl: process.env.CAMPAY_BASE_URL || 'https://demo.campay.net',
  // Clé webhook (dashboard Campay) — facultative : on revérifie côté serveur.
  webhookKey: process.env.CAMPAY_WEBHOOK_KEY || '',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  currency: 'XAF',

  isConfigured() {
    return Boolean(this.username && this.password);
  }
};
