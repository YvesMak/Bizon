const RestaurantService = require('./service');
const NotificationService = require('../notifications/service');

class RestaurantController {
  // POST /api/restaurants/campaigns — campagne push marketing (owner/manager)
  async sendCampaign(req, res) {
    try {
      const result = await NotificationService.sendCampaign(req.restaurantId, req.body);
      res.json({ message: 'Campagne envoyée', ...result });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

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

  // GET /api/restaurants/qr?table=N — QR code PNG d'une table (commande à table)
  async tableQr(req, res) {
    try {
      const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
      const png = await RestaurantService.tableQrPng(req.restaurantId, req.query.table, baseUrl);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-store');
      res.send(png);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Config de paiement (Campay) du restaurant — secrets jamais renvoyés.
  async getPaymentConfig(req, res) {
    try {
      res.json(await RestaurantService.getPaymentConfig(req.restaurantId));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async setPaymentConfig(req, res) {
    try {
      const config = await RestaurantService.setPaymentConfig(req.restaurantId, req.body);
      res.json({ message: 'Identifiants de paiement enregistrés', ...config });
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

  // ----- Self-service propriétaire : multi-restaurants -----

  async getMyRestaurants(req, res) {
    try {
      const restaurants = await RestaurantService.getOwnedRestaurants(req.user);
      res.json({ restaurants, current_restaurant_id: req.restaurantId });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async createMyRestaurant(req, res) {
    try {
      const restaurant = await RestaurantService.createOwnedRestaurant(req.user, req.body);
      res.status(201).json({ message: 'Restaurant créé', restaurant });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async switchRestaurant(req, res) {
    try {
      const result = await RestaurantService.switchRestaurant(req.user, req.params.id);
      res.json({ message: 'Restaurant actif changé', ...result });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // ----- Gestion des clients (manager) -----

  async getCustomers(req, res) {
    try {
      const [customers, stats] = await Promise.all([
        RestaurantService.listCustomers(req.restaurantId, { q: req.query.q, segment: req.query.segment }),
        RestaurantService.getCustomerStats(req.restaurantId)
      ]);
      res.json({ customers, stats });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async exportCustomers(req, res) {
    try {
      const csv = await RestaurantService.exportCustomersCsv(req.restaurantId, { q: req.query.q, segment: req.query.segment });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="clients-bizon-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getCustomerDetail(req, res) {
    try {
      const result = await RestaurantService.getCustomerDetail(req.restaurantId, req.params.customerId);
      res.json(result);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async resetCustomerPassword(req, res) {
    try {
      const { tempPassword } = await RestaurantService.resetCustomerPassword(req.restaurantId, req.params.customerId);
      res.json({ message: 'Mot de passe réinitialisé', tempPassword });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async setCustomerStatus(req, res) {
    try {
      const customer = await RestaurantService.setCustomerStatus(req.restaurantId, req.params.customerId, req.body.status);
      res.json({ message: 'Statut du client mis à jour', customer });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async adjustCustomerLoyalty(req, res) {
    try {
      const result = await RestaurantService.adjustCustomerLoyalty(
        req.restaurantId, req.params.customerId, req.body.points, req.body.reason
      );
      res.json({ message: 'Points mis à jour', ...result });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new RestaurantController();
