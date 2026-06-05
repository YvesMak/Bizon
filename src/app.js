const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

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
const publicRoutes = require('./modules/public/routes');
const customerRoutes = require('./modules/customers/routes');
const voucherRoutes = require('./modules/vouchers/routes');
const analyticsRoutes = require('./modules/analytics/routes');
const uploadRoutes = require('./modules/uploads/routes');
const paymentWebhookRoutes = require('./modules/payments/webhook.routes');

const { errorTranslationMiddleware } = require('./utils/errorTranslator');

const app = express();

// Middlewares globaux
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques PWA
app.use(express.static(path.join(__dirname, '..', 'pwa')));

// Servir les images produits uploadées
app.use('/uploads', express.static(path.join(__dirname, '..', 'storage', 'uploads')));

// Webhooks paiement — PUBLICS, montés AVANT le rate-limiter
// (les webhooks proviennent d'un nombre réduit d'IP Flutterwave qui seraient
//  sinon rapidement limitées). Sécurité : signature + revérification serveur.
app.use('/api/payments/webhook', paymentWebhookRoutes);

// Rate limiting (désactivé en environnement de test pour éviter les faux négatifs)
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limite par IP
  });
  app.use('/api/', limiter);
}

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/uploads', uploadRoutes);

// Route de santé
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Gestion des erreurs 404 (routes non matchées)
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Middleware de traduction des erreurs (gestionnaire d'erreur, 4 args)
app.use(errorTranslationMiddleware);

// Gestion globale des erreurs (fallback)
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (process.env.NODE_ENV !== 'test') {
    console.error('Erreur:', err);
  }
  res.status(err.status || 500).json({
    error: err.message || 'Erreur serveur interne',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;
