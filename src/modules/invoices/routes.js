const express = require('express');
const router = express.Router();
const InvoiceController = require('./controller');
const auth = require('../../middlewares/auth');
const tenantIsolation = require('../../middlewares/tenantIsolation');

router.use(auth, tenantIsolation);

// Liste et consultation
router.get('/', InvoiceController.getAll);
router.get('/:id', InvoiceController.getById);

// Téléchargement PDF
router.get('/:id/pdf', InvoiceController.downloadPDF);

// Régénération
router.post('/:id/regenerate', InvoiceController.regenerate);

module.exports = router;
