const AdminService = require('./service');

class AdminController {
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await AdminService.login(email, password);
      res.json(result);
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  }

  async me(req, res) {
    res.json({ admin: req.admin });
  }

  async stats(req, res) {
    try {
      res.json(await AdminService.getStats());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async dashboard(req, res) {
    try {
      res.json(await AdminService.getDashboard());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async restaurantDetail(req, res) {
    try {
      res.json(await AdminService.getRestaurantDetail(req.params.restaurantId));
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async listOwners(req, res) {
    try {
      res.json(await AdminService.listOwners());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async createOwner(req, res) {
    try {
      const result = await AdminService.createOwner(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateOwner(req, res) {
    try {
      res.json(await AdminService.updateOwner(req.params.ownerId, req.body));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async listRestaurants(req, res) {
    try {
      res.json(await AdminService.listRestaurants());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async createRestaurant(req, res) {
    try {
      const result = await AdminService.createRestaurant(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateRestaurant(req, res) {
    try {
      res.json(await AdminService.updateRestaurant(req.params.restaurantId, req.body));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async verifyDomain(req, res) {
    try {
      res.json(await AdminService.verifyDomain(req.params.restaurantId));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async listSubscriptions(req, res) {
    try {
      res.json(await AdminService.listSubscriptions());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateSubscription(req, res) {
    try {
      res.json(await AdminService.updateSubscription(req.params.restaurantId, req.body));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new AdminController();
