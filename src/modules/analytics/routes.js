const express = require('express');
const router = express.Router();
const AnalyticsController = require('./controller');
const auth = require('../../middlewares/auth');
const roleCheck = require('../../middlewares/roleCheck');
const tenantIsolation = require('../../middlewares/tenantIsolation');

router.use(auth, tenantIsolation);

// Vue d'ensemble analytique (owner/manager)
router.get('/', roleCheck(['owner', 'manager']), AnalyticsController.getOverview);

module.exports = router;
