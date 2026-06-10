const express = require('express');
const router = express.Router();
const CustomerController = require('./controller');
const jwt = require('jsonwebtoken');

// Middleware auth client (token via header OU query param pour SSE)
const customerAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;
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
router.get('/push/vapid-key', CustomerController.getVapidKey.bind(CustomerController));

// Routes protégées
router.get('/me', customerAuth, CustomerController.getProfile.bind(CustomerController));
router.put('/me', customerAuth, CustomerController.updateProfile.bind(CustomerController));
router.post('/me/password', customerAuth, CustomerController.changePassword.bind(CustomerController));
router.get('/me/orders', customerAuth, CustomerController.getOrders.bind(CustomerController));
router.post('/orders', customerAuth, CustomerController.createOrder.bind(CustomerController));
router.post('/orders/:id/cancel', customerAuth, CustomerController.cancelOrder.bind(CustomerController));
router.get('/orders/:id/receipt', customerAuth, CustomerController.orderReceipt.bind(CustomerController));
router.get('/payments/:paymentId/status', customerAuth, CustomerController.getPaymentStatus.bind(CustomerController));
router.get('/me/loyalty', customerAuth, CustomerController.getLoyalty.bind(CustomerController));
router.post('/validate-voucher', customerAuth, CustomerController.validateVoucher.bind(CustomerController));
router.get('/me/rewards', customerAuth, CustomerController.getRewards.bind(CustomerController));
router.post('/me/redeem', customerAuth, CustomerController.redeemReward.bind(CustomerController));
router.get('/me/stream', customerAuth, CustomerController.stream.bind(CustomerController));
router.post('/me/push/subscribe', customerAuth, CustomerController.subscribePush.bind(CustomerController));
router.post('/me/push/unsubscribe', customerAuth, CustomerController.unsubscribePush.bind(CustomerController));

module.exports = router;
