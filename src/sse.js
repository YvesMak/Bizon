// ============================================
// SSE (Server-Sent Events) Manager
// Gestion des connexions temps réel par restaurant
// ============================================

// Map : restaurantId → Set de Response objects
const clients = new Map();

/**
 * Enregistre un nouveau client SSE
 */
function addClient(restaurantId, res) {
  if (!clients.has(restaurantId)) {
    clients.set(restaurantId, new Set());
  }
  clients.get(restaurantId).add(res);
}

/**
 * Supprime un client SSE (déconnexion)
 */
function removeClient(restaurantId, res) {
  const set = clients.get(restaurantId);
  if (set) {
    set.delete(res);
    if (set.size === 0) {
      clients.delete(restaurantId);
    }
  }
}

/**
 * Émet un événement SSE à tous les clients d'un restaurant
 */
function emit(restaurantId, eventName, data) {
  const set = clients.get(restaurantId);
  if (!set || set.size === 0) return;

  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const res of set) {
    try {
      res.write(payload);
    } catch (err) {
      // Client disconnected — clean up
      set.delete(res);
    }
  }
}

module.exports = { addClient, removeClient, emit };
