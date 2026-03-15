const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { sequelize, testConnection } = require('./config/database');
const { initModels } = require('./models');

// Importation des routes
const authRoutes = require('./modules/auth/routes');
const restaurantRoutes = require('./modules/restaurants/routes');
const menuRoutes = require('./modules/menus/routes');
const productRoutes = require('./modules/products/routes');
const orderRoutes = require('./modules/orders/routes');
const paymentRoutes = require('./modules/payments/routes');
const invoiceRoutes = require('./modules/invoices/routes');
const subscriptionRoutes = require('./modules/subscriptions/routes');
const onboardingRoutes = require('./modules/onboarding/routes');

const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globaux
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques PWA
app.use(express.static(path.join(__dirname, '..', 'pwa')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limite par IP
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/onboarding', onboardingRoutes);

// Route de santé
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Middleware de gestion des erreurs (doit être en dernier)
const { errorTranslationMiddleware } = require('./utils/errorTranslator');
app.use(errorTranslationMiddleware);

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Erreur serveur interne',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Démarrage du serveur
const startServer = async () => {
  try {
    // Test connexion DB
    await testConnection();
    
    // Initialisation des modèles
    initModels();
    
    // TODO V2: REMPLACER SYNC() PAR MIGRATIONS SEQUELIZE
    // En production, utiliser migrations versionnées :
    // - npx sequelize-cli migration:generate --name add-promotions
    // - Créer src/migrations/ avec historique complet changements DB
    // - Permet rollback, synchronisation équipe, déploiement sûr
    // Voir détails : V2-ROADMAP.md section "Migrations Sequelize Formelles"
    
    // Synchronisation DB (dev uniquement)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
      console.log('✅ Modèles synchronisés');
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
