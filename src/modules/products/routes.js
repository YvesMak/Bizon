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

// Options / variantes (2+ segments → pas de conflit avec /:id)
router.get('/:productId/option-groups', ProductController.getOptionGroups);
router.post('/:productId/option-groups', roleCheck(['owner', 'manager']), ProductController.createOptionGroup);
router.delete('/option-groups/:groupId', roleCheck(['owner', 'manager']), ProductController.deleteOptionGroup);
router.post('/option-groups/:groupId/options', roleCheck(['owner', 'manager']), ProductController.createOption);
router.delete('/product-options/:optionId', roleCheck(['owner', 'manager']), ProductController.deleteOption);

module.exports = router;
