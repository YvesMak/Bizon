const OrderService = require('./service');
const sse = require('../../sse');

class OrderController {
  async getAll(req, res) {
    try {
      // Passer le rôle de l'utilisateur pour filtrage
      const userRole = req.user?.role || null;
      const orders = await OrderService.getAll(req.restaurantId, req.query, userRole);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const order = await OrderService.getById(req.restaurantId, req.params.id);
      res.json(order);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      const order = await OrderService.create(req.restaurantId, req.user.id, req.body);
      res.status(201).json({
        message: 'Commande créée en brouillon',
        order
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateStatus(req, res) {
    try {
      const order = await OrderService.updateStatus(
        req.restaurantId,
        req.params.id,
        req.body.status,
        req.user?.id
      );

      // Émettre l'événement SSE aux clients connectés du restaurant
      sse.emit(req.restaurantId, 'order_status_changed', {
        orderId: order.id,
        orderNumber: order.order_number,
        status: order.status,
        tableNumber: order.table_number,
        customerName: order.customer_name
      });

      res.json({
        message: 'Statut mis à jour',
        order
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  stream(req, res) {
    // Headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // désactive le buffering nginx
    res.flushHeaders();

    const restaurantId = req.restaurantId;

    // Enregistrer le client
    sse.addClient(restaurantId, res);

    // Ping toutes les 25s pour garder la connexion active
    const keepAlive = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 25000);

    // Nettoyage à la déconnexion
    req.on('close', () => {
      clearInterval(keepAlive);
      sse.removeClient(restaurantId, res);
    });
  }

  async cancel(req, res) {
    try {
      const order = await OrderService.cancel(req.restaurantId, req.params.id, req.user?.id);

      sse.emit(req.restaurantId, 'order_status_changed', {
        orderId: order.id,
        orderNumber: order.order_number,
        status: order.status,
        tableNumber: order.table_number,
        customerName: order.customer_name
      });

      res.json({
        message: 'Commande annulée',
        order
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new OrderController();
