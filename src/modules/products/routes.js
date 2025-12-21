const express = require('express');
const router = express.Router();
const ProductController = require('./controller');
const auth = require('../../middlewares/auth');
const roleCheck = require('../../middlewares/roleCheck');
const tenantIsolation = require('../../middlewares/tenantIsolation');

router.use(auth, tenantIsolation);

// CRUD produits
router.get('/', ProductController.getAll);
router.get('/:id', ProductController.getById);
router.post('/', roleCheck(['owner', 'manager']), ProductController.create);
router.put('/:id', roleCheck(['owner', 'manager']), ProductController.update);
router.delete('/:id', roleCheck(['owner', 'manager']), ProductController.delete);

// Gestion du stock
router.patch('/:id/stock', roleCheck(['owner', 'manager']), ProductController.updateStock);

module.exports = router;
