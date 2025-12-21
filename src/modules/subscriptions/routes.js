const express = require('express');
const router = express.Router();
const SubscriptionController = require('./controller');
const auth = require('../../middlewares/auth');
const roleCheck = require('../../middlewares/roleCheck');
const tenantIsolation = require('../../middlewares/tenantIsolation');

router.use(auth, tenantIsolation);

// Consultation subscription
router.get('/', SubscriptionController.get);
router.get('/limits', roleCheck(['owner', 'manager']), SubscriptionController.checkLimits);

module.exports = router;
