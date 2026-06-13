const express = require('express');
const router = express.Router();
const AdminController = require('./controller');
const platformAuth = require('../../middlewares/platformAuth');

// Authentification plateforme
router.post('/login', AdminController.login);

// Toutes les routes suivantes exigent un super-admin authentifié
router.use(platformAuth);

router.get('/me', AdminController.me);
router.get('/stats', AdminController.stats);
router.get('/dashboard', AdminController.dashboard);

router.get('/owners', AdminController.listOwners);
router.post('/owners', AdminController.createOwner);
router.patch('/owners/:ownerId', AdminController.updateOwner);

router.get('/restaurants', AdminController.listRestaurants);
router.post('/restaurants', AdminController.createRestaurant);
router.patch('/restaurants/:restaurantId', AdminController.updateRestaurant);
router.get('/restaurants/:restaurantId/verify-domain', AdminController.verifyDomain);

router.get('/subscriptions', AdminController.listSubscriptions);
router.patch('/subscriptions/:restaurantId', AdminController.updateSubscription);

module.exports = router;
