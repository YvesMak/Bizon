// ============================================
// SSE (Server-Sent Events) Manager
// Gestion des connexions temps réel par restaurant
// ============================================

// Map : restaurantId → Set de Response objects (staff)
const clients = new Map();
// Map : customerId → Set de Response objects (clients)
const customerClients = new Map();

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

// ----- Clients (customer-facing) -----

function addCustomerClient(customerId, res) {
  if (!customerClients.has(customerId)) {
    customerClients.set(customerId, new Set());
  }
  customerClients.get(customerId).add(res);
}

function removeCustomerClient(customerId, res) {
  const set = customerClients.get(customerId);
  if (set) {
    set.delete(res);
    if (set.size === 0) customerClients.delete(customerId);
  }
}

/**
 * Émet un événement SSE à un client précis.
 */
function emitToCustomer(customerId, eventName, data) {
  if (!customerId) return;
  const set = customerClients.get(customerId);
  if (!set || set.size === 0) return;

  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch (err) {
      set.delete(res);
    }
  }
}

module.exports = {
  addClient, removeClient, emit,
  addCustomerClient, removeCustomerClient, emitToCustomer
};
