const ProductService = require('./service');

class ProductController {
  async getAll(req, res) {
    try {
      const products = await ProductService.getAll(req.restaurantId, req.query);
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const product = await ProductService.getById(req.restaurantId, req.params.id);
      res.json(product);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      const product = await ProductService.create(req.restaurantId, req.body);
      res.status(201).json({
        message: 'Produit créé',
        product
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const product = await ProductService.update(req.restaurantId, req.params.id, req.body);
      res.json({
        message: 'Produit mis à jour',
        product
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      await ProductService.delete(req.restaurantId, req.params.id);
      res.json({ message: 'Produit supprimé' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateStock(req, res) {
    try {
      const product = await ProductService.updateStock(
        req.restaurantId,
        req.params.id,
        req.body.quantity,
        req.body.operation
      );
      res.json({
        message: 'Stock mis à jour',
        product
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new ProductController();
