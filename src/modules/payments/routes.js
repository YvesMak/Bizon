const express = require('express');
const router = express.Router();
const PaymentController = require('./controller');
const auth = require('../../middlewares/auth');
const roleCheck = require('../../middlewares/roleCheck');
const tenantIsolation = require('../../middlewares/tenantIsolation');

router.use(auth, tenantIsolation);

// Flutterwave : initiation + suivi de statut
router.post('/initiate', PaymentController.initiate);

// Campay (encaissement caissier) : initiation + suivi + règlement
router.post('/campay/initiate', PaymentController.initiateCampay);
router.get('/:id/campay-status', PaymentController.campayStatus);

// Rapport de caisse (Z) du jour
router.get('/report', PaymentController.report);

// Comptabilité (période) — défini avant /:id pour éviter toute ambiguïté
router.get('/accounting/consolidated', roleCheck(['owner']), PaymentController.consolidated);
router.get('/accounting', roleCheck(['owner', 'manager']), PaymentController.accounting);

router.get('/:id/status', PaymentController.status);

// Création et vérification de paiement (cash / manuel)
router.post('/', PaymentController.create);
router.post('/:id/verify', PaymentController.verify);
router.get('/order/:orderId', PaymentController.getByOrder);

module.exports = router;
