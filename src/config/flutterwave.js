// Configuration Flutterwave, lue depuis l'environnement.
require('dotenv').config();

module.exports = {
  publicKey: process.env.FLW_PUBLIC_KEY,
  secretKey: process.env.FLW_SECRET_KEY,
  encryptionKey: process.env.FLW_ENCRYPTION_KEY,
  // Secret hash configuré dans le dashboard Flutterwave (Settings → Webhooks).
  webhookHash: process.env.FLW_WEBHOOK_HASH || '',
  baseUrl: process.env.FLW_BASE_URL || 'https://api.flutterwave.com/v3',
  // URL publique de l'app (redirections + webhooks).
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  currency: 'XAF', // Franc CFA (Cameroun)

  isConfigured() {
    return Boolean(this.secretKey && this.publicKey);
  }
};
