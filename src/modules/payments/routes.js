const express = require('express');
const router = express.Router();
const PaymentController = require('./controller');
const auth = require('../../middlewares/auth');
const tenantIsolation = require('../../middlewares/tenantIsolation');

router.use(auth, tenantIsolation);

// Flutterwave : initiation + suivi de statut
router.post('/initiate', PaymentController.initiate);
router.get('/:id/status', PaymentController.status);

// Création et vérification de paiement (cash / manuel)
router.post('/', PaymentController.create);
router.post('/:id/verify', PaymentController.verify);
router.get('/order/:orderId', PaymentController.getByOrder);

module.exports = router;
