const MenuService = require('./service');

class MenuController {
  async getAll(req, res) {
    try {
      const menus = await MenuService.getAll(req.restaurantId);
      res.json(menus);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const menu = await MenuService.getById(req.restaurantId, req.params.id);
      res.json(menu);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      const menu = await MenuService.create(req.restaurantId, req.body);
      res.status(201).json({
        message: 'Menu créé',
        menu
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const menu = await MenuService.update(req.restaurantId, req.params.id, req.body);
      res.json({
        message: 'Menu mis à jour',
        menu
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      await MenuService.delete(req.restaurantId, req.params.id);
      res.json({ message: 'Menu supprimé' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Catégories
  async createCategory(req, res) {
    try {
      const category = await MenuService.createCategory(req.restaurantId, req.params.id, req.body);
      res.status(201).json({
        message: 'Catégorie créée',
        category
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateCategory(req, res) {
    try {
      const category = await MenuService.updateCategory(req.restaurantId, req.params.categoryId, req.body);
      res.json({
        message: 'Catégorie mise à jour',
        category
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteCategory(req, res) {
    try {
      await MenuService.deleteCategory(req.restaurantId, req.params.categoryId);
      res.json({ message: 'Catégorie supprimée' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new MenuController();
