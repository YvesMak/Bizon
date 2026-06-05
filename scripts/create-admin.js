#!/usr/bin/env node
/**
 * Crée (ou met à jour le mot de passe d') un super-administrateur de la plateforme.
 *
 * Usage :
 *   node scripts/create-admin.js <email> <password> "<nom>"
 * ou via variables d'environnement :
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... node scripts/create-admin.js
 */
require('dotenv').config();
const { sequelize } = require('../src/config/database');
const { PlatformAdmin } = require('../src/models');

async function main() {
  const email = process.argv[2] || process.env.ADMIN_EMAIL;
  const password = process.argv[3] || process.env.ADMIN_PASSWORD;
  const name = process.argv[4] || process.env.ADMIN_NAME || 'Administrateur';

  if (!email || !password) {
    console.error('Usage : node scripts/create-admin.js <email> <password> "<nom>"');
    process.exit(1);
  }
  if (`${password}`.length < 8) {
    console.error('Le mot de passe doit contenir au moins 8 caractères.');
    process.exit(1);
  }

  await sequelize.authenticate();

  const existing = await PlatformAdmin.findOne({ where: { email } });
  if (existing) {
    existing.password = password; // ré-hashé par le hook beforeUpdate
    existing.name = name;
    existing.status = 'active';
    await existing.save();
    console.log(`✅ Mot de passe mis à jour pour l'administrateur : ${email}`);
  } else {
    await PlatformAdmin.create({ email, password, name, status: 'active' });
    console.log(`✅ Super-administrateur créé : ${email}`);
  }

  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
