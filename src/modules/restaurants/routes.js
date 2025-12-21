const express = require('express');
const router = express.Router();
const RestaurantController = require('./controller');
const auth = require('../../middlewares/auth');
const roleCheck = require('../../middlewares/roleCheck');
const tenantIsolation = require('../../middlewares/tenantIsolation');

// Appliquer l'authentification et l'isolation multi-tenant à toutes les routes
router.use(auth, tenantIsolation);

// Informations restaurant
router.get('/', RestaurantController.getRestaurant);
router.put('/', roleCheck(['owner', 'manager']), RestaurantController.updateRestaurant);

// Statistiques
router.get('/stats', roleCheck(['owner', 'manager']), RestaurantController.getStats);

// Gestion des utilisateurs
router.get('/users', roleCheck(['owner', 'manager']), RestaurantController.getUsers);
router.post('/users', roleCheck(['owner', 'manager']), RestaurantController.createUser);
router.put('/users/:userId', roleCheck(['owner', 'manager']), RestaurantController.updateUser);
router.delete('/users/:userId', roleCheck(['owner']), RestaurantController.deleteUser);

module.exports = router;
