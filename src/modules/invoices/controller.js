const InvoiceService = require('./service');

class InvoiceController {
  async getAll(req, res) {
    try {
      const invoices = await InvoiceService.getAll(req.restaurantId, req.query);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const invoice = await InvoiceService.getById(req.restaurantId, req.params.id);
      res.json(invoice);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async downloadPDF(req, res) {
    try {
      const pdfPath = await InvoiceService.getPDFPath(req.restaurantId, req.params.id);
      res.download(pdfPath);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async regenerate(req, res) {
    try {
      const invoice = await InvoiceService.regeneratePDF(req.restaurantId, req.params.id);
      res.json({
        message: 'Facture régénérée',
        invoice
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new InvoiceController();
