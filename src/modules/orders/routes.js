const express = require('express');
const router = express.Router();
const OrderController = require('./controller');
const auth = require('../../middlewares/auth');
const roleCheck = require('../../middlewares/roleCheck');
const tenantIsolation = require('../../middlewares/tenantIsolation');

router.use(auth, tenantIsolation);

// SSE — flux temps réel des changements de statut
router.get('/stream', OrderController.stream);

// CRUD commandes
router.get('/', OrderController.getAll);
router.get('/:id/receipt', OrderController.receipt);
router.get('/:id', OrderController.getById);
router.post('/', OrderController.create);

// Gestion du statut
router.patch('/:id/status', OrderController.updateStatus);
router.post('/:id/cancel', OrderController.cancel);

module.exports = router;
