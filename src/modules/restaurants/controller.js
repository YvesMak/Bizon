const RestaurantService = require('./service');

class RestaurantController {
  /**
   * Obtenir les informations du restaurant
   */
  async getRestaurant(req, res) {
    try {
      const restaurant = await RestaurantService.getRestaurant(req.restaurantId);
      res.json(restaurant);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  /**
   * Mettre à jour le restaurant
   */
  async updateRestaurant(req, res) {
    try {
      const restaurant = await RestaurantService.updateRestaurant(req.restaurantId, req.body);
      res.json({
        message: 'Restaurant mis à jour',
        restaurant
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Obtenir les statistiques du restaurant
   */
  async getStats(req, res) {
    try {
      const stats = await RestaurantService.getStats(req.restaurantId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtenir les utilisateurs du restaurant
   */
  async getUsers(req, res) {
    try {
      const users = await RestaurantService.getUsers(req.restaurantId);
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Créer un nouvel utilisateur
   */
  async createUser(req, res) {
    try {
      const user = await RestaurantService.createUser(req.restaurantId, req.body);
      res.status(201).json({
        message: 'Utilisateur créé',
        user
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Mettre à jour un utilisateur
   */
  async updateUser(req, res) {
    try {
      const user = await RestaurantService.updateUser(req.restaurantId, req.params.userId, req.body);
      res.json({
        message: 'Utilisateur mis à jour',
        user
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Supprimer un utilisateur
   */
  async deleteUser(req, res) {
    try {
      await RestaurantService.deleteUser(req.restaurantId, req.params.userId);
      res.json({ message: 'Utilisateur supprimé' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new RestaurantController();
