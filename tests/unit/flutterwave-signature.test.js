// Teste la vraie vérification de signature (sans mock).
// On fixe le secret hash AVANT de charger le provider.
process.env.FLW_WEBHOOK_HASH = 'secret-hash-de-test';

const flutterwave = require('../../src/modules/payments/providers/flutterwave');

describe('Flutterwave — verifyWebhookSignature', () => {
  it('accepte le hash exact configuré', () => {
    expect(flutterwave.verifyWebhookSignature('secret-hash-de-test')).toBe(true);
  });

  it('rejette un hash incorrect', () => {
    expect(flutterwave.verifyWebhookSignature('mauvais')).toBe(false);
  });

  it('rejette un hash absent', () => {
    expect(flutterwave.verifyWebhookSignature(undefined)).toBe(false);
    expect(flutterwave.verifyWebhookSignature('')).toBe(false);
  });
});
