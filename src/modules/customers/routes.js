const express = require('express');
const router = express.Router();
const CustomerController = require('./controller');
const jwt = require('jsonwebtoken');

// Middleware auth client
const customerAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'customer') return res.status(403).json({ error: 'Accès refusé' });
    req.customerId = decoded.customerId;
    req.restaurantId = decoded.restaurantId;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};

// Routes publiques
router.post('/register', CustomerController.register.bind(CustomerController));
router.post('/login', CustomerController.login.bind(CustomerController));

// Routes protégées
router.get('/me', customerAuth, CustomerController.getProfile.bind(CustomerController));
router.put('/me', customerAuth, CustomerController.updateProfile.bind(CustomerController));
router.get('/me/orders', customerAuth, CustomerController.getOrders.bind(CustomerController));

module.exports = router;
