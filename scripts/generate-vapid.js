#!/usr/bin/env node
/**
 * Génère une paire de clés VAPID pour les notifications Web Push.
 * Copiez la sortie dans votre fichier .env (la clé privée est SECRÈTE,
 * ne la committez jamais).
 *
 * Usage : npm run generate-vapid
 */
const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();
console.log('# Notifications push (Web Push / VAPID)');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:contact@bizon.cm');
