require('dotenv').config();

const app = require('./app');
const { sequelize, testConnection } = require('./config/database');
const { initModels } = require('./models');
const OrderService = require('./modules/orders/service');

const PORT = process.env.PORT || 3000;

// Délai d'expiration des commandes client non payées (minutes)
const DRAFT_TTL_MIN = parseInt(process.env.ORDER_DRAFT_TTL_MINUTES) || 30;
// Fréquence du nettoyage (minutes)
const CLEANUP_INTERVAL_MIN = parseInt(process.env.CLEANUP_INTERVAL_MINUTES) || 10;

function startCleanupJob() {
  const run = async () => {
    try {
      const n = await OrderService.expireStaleCustomerDrafts(DRAFT_TTL_MIN);
      if (n > 0) console.log(`🧹 ${n} commande(s) non payée(s) expirée(s)`);
    } catch (error) {
      console.error('❌ Nettoyage commandes:', error.message);
    }
  };
  // Planification périodique (ne maintient pas le process en vie à lui seul)
  const timer = setInterval(run, CLEANUP_INTERVAL_MIN * 60 * 1000);
  if (timer.unref) timer.unref();
  run(); // premier passage au démarrage
}

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

    // Nettoyage périodique des commandes non payées
    startCleanupJob();
  } catch (error) {
    console.error('❌ Erreur au démarrage:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
