// Charge les variables d'environnement de test AVANT le chargement des modules applicatifs.
// (setupFiles s'exécute avant l'import de src/, donc database.js lira bien bizon_test.)
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.test') });

// Garde-fou : ne jamais lancer les tests hors environnement de test.
process.env.NODE_ENV = 'test';
