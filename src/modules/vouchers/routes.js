const express = require('express');
const router = express.Router();
const VoucherController = require('./controller');
const auth = require('../../middlewares/auth');
const roleCheck = require('../../middlewares/roleCheck');
const tenantIsolation = require('../../middlewares/tenantIsolation');

router.use(auth, tenantIsolation);

// Gestion des codes promo (réservée owner/manager)
router.get('/', roleCheck(['owner', 'manager']), VoucherController.list);
router.post('/', roleCheck(['owner', 'manager']), VoucherController.create);
router.patch('/:id', roleCheck(['owner', 'manager']), VoucherController.setActive);

module.exports = router;
