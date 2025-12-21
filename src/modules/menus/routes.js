const express = require('express');
const router = express.Router();
const MenuController = require('./controller');
const auth = require('../../middlewares/auth');
const roleCheck = require('../../middlewares/roleCheck');
const tenantIsolation = require('../../middlewares/tenantIsolation');

router.use(auth, tenantIsolation);

// CRUD menus
router.get('/', MenuController.getAll);
router.get('/:id', MenuController.getById);
router.post('/', roleCheck(['owner', 'manager']), MenuController.create);
router.put('/:id', roleCheck(['owner', 'manager']), MenuController.update);
router.delete('/:id', roleCheck(['owner', 'manager']), MenuController.delete);

// Gestion des catégories
router.post('/:id/categories', roleCheck(['owner', 'manager']), MenuController.createCategory);
router.put('/categories/:categoryId', roleCheck(['owner', 'manager']), MenuController.updateCategory);
router.delete('/categories/:categoryId', roleCheck(['owner', 'manager']), MenuController.deleteCategory);

module.exports = router;
