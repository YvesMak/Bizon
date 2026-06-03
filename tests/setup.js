// Setup exécuté pour chaque fichier de test (setupFilesAfterEnv).
// Reconstruit un schéma propre sur la base de test, puis nettoie entre chaque test.
const { sequelize } = require('../src/config/database');
const { initModels } = require('../src/models');

// Sécurité absolue : on refuse de toucher autre chose qu'une base de test.
const dbName = sequelize.config.database;
if (!/test/i.test(dbName)) {
  throw new Error(
    `❌ Refus d'exécuter les tests : la base "${dbName}" ne ressemble pas à une base de test.`
  );
}

beforeAll(async () => {
  initModels();
  // Recrée tout le schéma à neuf (force) sur la base de test isolée.
  await sequelize.sync({ force: true });
});

afterEach(async () => {
  // Vide toutes les tables entre les tests pour garantir l'isolation.
  await sequelize.truncate({ cascade: true, restartIdentity: true });
});

afterAll(async () => {
  await sequelize.close();
});
