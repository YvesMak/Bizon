#!/usr/bin/env node
/**
 * Bootstrap au démarrage — utile sur les hébergeurs SANS accès shell
 * (ex. Render plan gratuit). Piloté par des variables d'environnement,
 * idempotent et NON bloquant (n'empêche jamais le serveur de démarrer) :
 *
 *   BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD
 *       → crée (ou met à jour le mot de passe du) super-admin plateforme.
 *   BOOTSTRAP_ADMIN_NAME   (optionnel, défaut « Admin Bizon »)
 *   SEED_DEMO=true
 *       → crée le restaurant de démo (menu + comptes) s'il n'existe pas.
 *
 * Une fois exécuté, tu peux retirer ces variables (l'opération est idempotente).
 */
require('dotenv').config();
const { execSync } = require('child_process');
const { sequelize } = require('../src/config/database');
const { PlatformAdmin, initModels } = require('../src/models');

async function ensureAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) return;
  if (`${password}`.length < 8) {
    console.warn('[bootstrap] BOOTSTRAP_ADMIN_PASSWORD trop court (min 8) — admin ignoré.');
    return;
  }
  initModels();
  const existing = await PlatformAdmin.findOne({ where: { email } });
  if (existing) {
    existing.password = password;
    existing.status = 'active';
    await existing.save();
    console.log(`[bootstrap] super-admin mis à jour : ${email}`);
  } else {
    await PlatformAdmin.create({
      email, password,
      name: process.env.BOOTSTRAP_ADMIN_NAME || 'Admin Bizon',
      status: 'active'
    });
    console.log(`[bootstrap] super-admin créé : ${email}`);
  }
}

async function main() {
  try {
    await sequelize.authenticate();
    await ensureAdmin();
  } catch (e) {
    console.error('[bootstrap] admin :', e.message);
  } finally {
    try { await sequelize.close(); } catch { /* ignore */ }
  }

  if (process.env.SEED_DEMO === 'true') {
    try {
      execSync('node scripts/seed-demo.js', { stdio: 'inherit' });
    } catch (e) {
      console.error('[bootstrap] seed démo :', e.message);
    }
  }
}

// Toujours sortir en 0 pour ne jamais bloquer le démarrage du serveur.
main().then(() => process.exit(0)).catch(() => process.exit(0));
