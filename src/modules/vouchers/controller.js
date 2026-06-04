const VoucherService = require('./service');

class VoucherController {
  async create(req, res) {
    try {
      const voucher = await VoucherService.create(req.restaurantId, req.body);
      res.status(201).json({ message: 'Code promo créé', voucher });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async list(req, res) {
    try {
      const vouchers = await VoucherService.list(req.restaurantId);
      res.json(vouchers);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async setActive(req, res) {
    try {
      const voucher = await VoucherService.setActive(req.restaurantId, req.params.id, req.body.active);
      res.json({ message: 'Code promo mis à jour', voucher });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new VoucherController();
