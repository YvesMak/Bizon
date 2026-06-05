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

router.get('/owners', AdminController.listOwners);
router.post('/owners', AdminController.createOwner);
router.patch('/owners/:ownerId', AdminController.updateOwner);

router.get('/restaurants', AdminController.listRestaurants);
router.post('/restaurants', AdminController.createRestaurant);
router.patch('/restaurants/:restaurantId', AdminController.updateRestaurant);

module.exports = router;
