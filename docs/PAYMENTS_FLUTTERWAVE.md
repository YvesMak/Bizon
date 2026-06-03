# Paiements — Intégration Flutterwave

Flutterwave est utilisé comme **agrégateur** : une seule intégration couvre le
**Mobile Money (MTN / Orange Cameroun)** et les **cartes bancaires**, en **XAF**.

## Configuration (`.env`)

```
FLW_PUBLIC_KEY=FLWPUBK_TEST-...-X
FLW_SECRET_KEY=FLWSECK_TEST-...-X
FLW_ENCRYPTION_KEY=FLWSECK_TEST...
FLW_WEBHOOK_HASH=         # voir « Webhook » ci-dessous
FLW_BASE_URL=https://api.flutterwave.com/v3
APP_BASE_URL=https://votre-domaine        # pour redirections + webhooks
```

> Les clés sont **TEST** (sandbox) tant qu'elles commencent par `..._TEST`.
> Pour la production : remplacer par les clés `LIVE` (jamais commitées).

## Flux de paiement

```
1. POST /api/payments/initiate           (staff authentifié)
   → crée un Payment "pending" (provider=flutterwave, reference=tx_ref)
   → appelle Flutterwave (lien de paiement hébergé)
   → renvoie { payment_id, tx_ref, link, amount, currency }

2. Le client paie sur `link` (Mobile Money ou carte).

3a. Webhook  POST /api/payments/webhook/flutterwave   (Flutterwave → serveur)
    → vérifie la signature `verif-hash`
    → REVÉRIFIE la transaction via l'API Flutterwave (source de vérité)
    → Payment "completed" + commande "paid" + facture (atomique, idempotent)

3b. Redirection  → /payment-callback.html?status=...&tx_ref=...&transaction_id=...
    → page de confirmation UX (le règlement réel vient du webhook)

4. GET /api/payments/:id/status          (polling de secours)
```

### Endpoints

| Méthode | Route | Auth | Rôle |
|--------|-------|------|------|
| POST | `/api/payments/initiate` | JWT staff | Génère le lien de paiement |
| GET  | `/api/payments/:id/status` | JWT staff | Statut du paiement |
| POST | `/api/payments/webhook/flutterwave` | **Public** (signature) | Règlement serveur |

## Webhook — sécurité

1. Dans le **dashboard Flutterwave** → *Settings → Webhooks* :
   - **URL** : `https://votre-domaine/api/payments/webhook/flutterwave`
   - **Secret hash** : une valeur secrète de votre choix
2. Reporter cette valeur dans `FLW_WEBHOOK_HASH`.

Le webhook est doublement sécurisé :
- vérification du header `verif-hash` (comparaison à temps constant) ;
- **revérification serveur** de la transaction auprès de Flutterwave
  (`GET /transactions/:id/verify`) avant tout règlement — on ne fait jamais
  confiance au seul payload reçu.

Le règlement est **idempotent** : un paiement déjà `completed` est ignoré, et la
facture n'est jamais générée deux fois.

## Développement local

Les webhooks nécessitent une URL publique. En local, exposer le serveur via un
tunnel, p. ex. :

```
cloudflared tunnel --url http://localhost:3000
# ou : ngrok http 3000
```

…puis utiliser l'URL fournie comme `APP_BASE_URL` et dans le dashboard.

## Tests

Les tests (`tests/integration/payments-flutterwave.test.js`,
`tests/unit/flutterwave-signature.test.js`) **mockent** le provider : aucun appel
réseau. Ils couvrent l'initiation, le règlement (succès / idempotence / échec /
montant insuffisant) et la sécurité du webhook (signature).
