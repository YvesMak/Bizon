const express = require('express');
const router = express.Router();
const RestaurantController = require('./controller');
const auth = require('../../middlewares/auth');
const roleCheck = require('../../middlewares/roleCheck');
const tenantIsolation = require('../../middlewares/tenantIsolation');

// Appliquer l'authentification et l'isolation multi-tenant à toutes les routes
router.use(auth, tenantIsolation);

// Self-service propriétaire : ses restaurants (multi-restaurant)
router.get('/mine', roleCheck(['owner']), RestaurantController.getMyRestaurants);
router.post('/mine', roleCheck(['owner']), RestaurantController.createMyRestaurant);
router.post('/switch/:id', roleCheck(['owner']), RestaurantController.switchRestaurant);

// Informations restaurant
router.get('/', RestaurantController.getRestaurant);
router.put('/', roleCheck(['owner', 'manager']), RestaurantController.updateRestaurant);

// Statistiques
router.get('/stats', roleCheck(['owner', 'manager']), RestaurantController.getStats);

// Gestion des clients (manager)
router.get('/customers', roleCheck(['owner', 'manager']), RestaurantController.getCustomers);
router.get('/customers/:customerId', roleCheck(['owner', 'manager']), RestaurantController.getCustomerDetail);
router.post('/customers/:customerId/reset-password', roleCheck(['owner', 'manager']), RestaurantController.resetCustomerPassword);
router.patch('/customers/:customerId/status', roleCheck(['owner', 'manager']), RestaurantController.setCustomerStatus);

// Gestion des utilisateurs
router.get('/users', roleCheck(['owner', 'manager']), RestaurantController.getUsers);
router.post('/users', roleCheck(['owner', 'manager']), RestaurantController.createUser);
router.put('/users/:userId', roleCheck(['owner', 'manager']), RestaurantController.updateUser);
router.delete('/users/:userId', roleCheck(['owner']), RestaurantController.deleteUser);

module.exports = router;
