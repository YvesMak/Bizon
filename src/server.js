require('dotenv').config();

const app = require('./app');
const { sequelize, testConnection } = require('./config/database');
const { initModels } = require('./models');

const PORT = process.env.PORT || 3000;

// Démarrage du serveur
const startServer = async () => {
  try {
    // Test connexion DB
    await testConnection();

    // Initialisation des modèles
    initModels();

    // ⚠️ Le schéma est désormais géré par les migrations Sequelize.
    //    En production : `npm run db:migrate` avant de démarrer.
    //    En développement, on peut garder une synchronisation non destructive.
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
      console.log('✅ Modèles synchronisés (dev)');
    }

    // Démarrage serveur
    app.listen(PORT, () => {
      console.log(`🚀 Serveur Bizon démarré sur le port ${PORT}`);
      console.log(`📍 http://localhost:${PORT}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Erreur au démarrage:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
