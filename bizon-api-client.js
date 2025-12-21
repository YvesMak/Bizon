/**
 * 🔌 BIZON API CLIENT - EXEMPLE D'INTÉGRATION PWA
 * 
 * Ce fichier contient des exemples pratiques d'appels API
 * pour intégrer le backend Bizon dans votre PWA.
 */

// ============================================
// CONFIGURATION
// ============================================

const API_BASE_URL = 'http://localhost:3000/api';  // DEV
// const API_BASE_URL = 'https://api.bizon.app/api';  // PROD

// Récupérer le token depuis localStorage
const getToken = () => localStorage.getItem('bizon_token');

// Headers par défaut
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

// ============================================
// HELPER: FETCH WRAPPER
// ============================================

async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: getHeaders(),
    ...options
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    // Gestion erreur 401 → Redirect login
    if (response.status === 401) {
      localStorage.removeItem('bizon_token');
      window.location.href = '/login';
      return;
    }

    // Erreur HTTP
    if (!response.ok) {
      throw new Error(data.error || 'Erreur serveur');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// ============================================
// 1. AUTHENTIFICATION
// ============================================

// Login
async function login(email, password) {
  const data = await apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  // Stocker le token
  localStorage.setItem('bizon_token', data.token);
  localStorage.setItem('bizon_user', JSON.stringify(data.user));
  localStorage.setItem('bizon_restaurant', JSON.stringify(data.restaurant));

  return data;
}

// Inscription restaurant
async function register(formData) {
  const data = await apiCall('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: formData.restaurantName,
      email: formData.email,
      password: formData.password,
      phone: formData.phone,
      address: formData.address
    })
  });

  localStorage.setItem('bizon_token', data.token);
  localStorage.setItem('bizon_user', JSON.stringify(data.user));
  localStorage.setItem('bizon_restaurant', JSON.stringify(data.restaurant));

  return data;
}

// Logout
function logout() {
  localStorage.removeItem('bizon_token');
  localStorage.removeItem('bizon_user');
  localStorage.removeItem('bizon_restaurant');
  window.location.href = '/login';
}

// ============================================
// 2. MENU & PRODUITS (VITRINE CLIENT)
// ============================================

// Charger le menu complet (catégories + produits)
async function loadFullMenu() {
  const menus = await apiCall('/menus');
  
  // Structure retournée:
  // [
  //   {
  //     id: "uuid",
  //     name: "Menu Principal",
  //     categories: [
  //       {
  //         id: "uuid",
  //         name: "Plats",
  //         products: [
  //           { id, name, description, price, image_url, stock_quantity, is_available }
  //         ]
  //       }
  //     ]
  //   }
  // ]
  
  return menus;
}

// Alternative: Charger uniquement les produits disponibles
async function loadAvailableProducts() {
  const products = await apiCall('/products?isAvailable=true');
  
  // Grouper par catégorie côté PWA si nécessaire
  const grouped = products.reduce((acc, product) => {
    const categoryId = product.category_id;
    if (!acc[categoryId]) {
      acc[categoryId] = {
        id: categoryId,
        name: product.category?.name || 'Sans catégorie',
        products: []
      };
    }
    acc[categoryId].products.push(product);
    return acc;
  }, {});
  
  return Object.values(grouped);
}

// ============================================
// 3. PANIER & COMMANDE
// ============================================

// Exemple structure panier PWA
class Cart {
  constructor() {
    this.items = JSON.parse(localStorage.getItem('bizon_cart')) || [];
  }

  addItem(product, quantity = 1) {
    const existing = this.items.find(item => item.product_id === product.id);
    
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.items.push({
        product_id: product.id,
        product_name: product.name,
        unit_price: parseFloat(product.price),
        quantity: quantity,
        notes: ''
      });
    }
    
    this.save();
  }

  removeItem(productId) {
    this.items = this.items.filter(item => item.product_id !== productId);
    this.save();
  }

  clear() {
    this.items = [];
    this.save();
  }

  save() {
    localStorage.setItem('bizon_cart', JSON.stringify(this.items));
  }

  getTotal() {
    const subtotal = this.items.reduce((sum, item) => {
      return sum + (item.unit_price * item.quantity);
    }, 0);
    
    const tax = subtotal * 0.18;  // TVA 18%
    const total = subtotal + tax;
    
    return { subtotal, tax, total };
  }
}

// Créer une commande depuis le panier
async function createOrderFromCart(cart, tableNumber, type = 'dine_in') {
  const order = await apiCall('/orders', {
    method: 'POST',
    body: JSON.stringify({
      type: type,
      table_number: tableNumber,
      items: cart.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        notes: item.notes
      }))
    })
  });

  // Vider le panier après création
  cart.clear();

  return order.order;
}

// ============================================
// 4. SUIVI COMMANDES
// ============================================

// Charger les commandes actives
async function loadActiveOrders() {
  // Toutes les commandes non terminées
  const orders = await apiCall('/orders?status=pending,confirmed,preparing,ready');
  return orders;
}

// Charger une commande spécifique
async function loadOrderDetails(orderId) {
  const order = await apiCall(`/orders/${orderId}`);
  return order;
}

// Changer le statut d'une commande (cuisine)
async function updateOrderStatus(orderId, newStatus) {
  // newStatus: 'confirmed' | 'preparing' | 'ready' | 'completed'
  const order = await apiCall(`/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: newStatus })
  });

  return order;
}

// Annuler une commande
async function cancelOrder(orderId) {
  try {
    const result = await apiCall(`/orders/${orderId}/cancel`, {
      method: 'POST'
    });
    return result;
  } catch (error) {
    // Erreur possible: "Impossible d'annuler une commande déjà payée"
    throw error;
  }
}

// ============================================
// 5. PAIEMENTS
// ============================================

// Créer un paiement
async function createPayment(orderId, amount, method, details = {}) {
  const payment = await apiCall('/payments', {
    method: 'POST',
    body: JSON.stringify({
      order_id: orderId,
      amount: amount,
      method: method,  // 'mobile_money' | 'cash' | 'card'
      phone_number: details.phone_number,
      provider: details.provider  // 'Orange Money' | 'Wave' | 'Free Money'
    })
  });

  return payment.payment;
}

// Vérifier un paiement Mobile Money
async function verifyMobileMoneyPayment(paymentId, transactionCode) {
  try {
    const payment = await apiCall(`/payments/${paymentId}/verify`, {
      method: 'POST',
      body: JSON.stringify({
        transaction_code: transactionCode
      })
    });

    // À ce stade:
    // - Paiement status='completed'
    // - Facture générée automatiquement
    // - Commande status='completed'

    return payment;
  } catch (error) {
    // Erreurs possibles:
    // - "Code de transaction invalide"
    // - "Ce code de transaction a déjà été utilisé"
    // - "Paiement déjà vérifié"
    throw error;
  }
}

// Récupérer les paiements d'une commande
async function getOrderPayments(orderId) {
  const payments = await apiCall(`/payments/order/${orderId}`);
  return payments;
}

// ============================================
// 6. FACTURES
// ============================================

// Charger l'historique des factures
async function loadInvoices(filters = {}) {
  let url = '/invoices';
  const params = new URLSearchParams();
  
  if (filters.status) params.append('status', filters.status);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  
  if (params.toString()) {
    url += '?' + params.toString();
  }

  const invoices = await apiCall(url);
  return invoices;
}

// Télécharger une facture PDF
function downloadInvoicePDF(invoiceId) {
  const token = getToken();
  const url = `${API_BASE_URL}/invoices/${invoiceId}/pdf`;
  
  // Ouvrir dans un nouvel onglet
  window.open(`${url}?token=${token}`, '_blank');
  
  // OU télécharger directement
  // fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
  //   .then(res => res.blob())
  //   .then(blob => {
  //     const a = document.createElement('a');
  //     a.href = URL.createObjectURL(blob);
  //     a.download = `facture-${invoiceId}.pdf`;
  //     a.click();
  //   });
}

// ============================================
// 7. DASHBOARD STATS
// ============================================

async function loadRestaurantStats() {
  const stats = await apiCall('/restaurants/stats');
  
  // Structure:
  // {
  //   orders: { total, today },
  //   revenue: { total, today },
  //   products: { total, lowStock },
  //   users: { active }
  // }
  
  return stats;
}

// Charger les infos du restaurant
async function loadRestaurantInfo() {
  const restaurant = await apiCall('/restaurants');
  return restaurant;
}

// Charger l'abonnement
async function loadSubscription() {
  const subscription = await apiCall('/subscriptions');
  return subscription;
}

// ============================================
// 8. GESTION PRODUITS (ADMIN)
// ============================================

// Créer un produit
async function createProduct(productData) {
  const product = await apiCall('/products', {
    method: 'POST',
    body: JSON.stringify({
      category_id: productData.category_id,
      name: productData.name,
      description: productData.description,
      price: parseFloat(productData.price),
      cost_price: productData.cost_price ? parseFloat(productData.cost_price) : null,
      stock_quantity: parseInt(productData.stock_quantity) || 0,
      low_stock_threshold: parseInt(productData.low_stock_threshold) || 10,
      track_stock: productData.track_stock !== false,
      is_available: productData.is_available !== false,
      image_url: productData.image_url
    })
  });

  return product.product;
}

// Modifier un produit
async function updateProduct(productId, productData) {
  const product = await apiCall(`/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(productData)
  });

  return product.product;
}

// Ajuster le stock
async function adjustStock(productId, quantity, operation) {
  // operation: 'add' ou 'subtract'
  const product = await apiCall(`/products/${productId}/stock`, {
    method: 'PATCH',
    body: JSON.stringify({
      quantity: parseInt(quantity),
      operation: operation
    })
  });

  return product;
}

// Supprimer un produit
async function deleteProduct(productId) {
  await apiCall(`/products/${productId}`, {
    method: 'DELETE'
  });
}

// ============================================
// 9. GESTION UTILISATEURS (ADMIN)
// ============================================

// Charger les utilisateurs du restaurant
async function loadUsers() {
  const users = await apiCall('/restaurants/users');
  return users;
}

// Créer un utilisateur
async function createUser(userData) {
  const user = await apiCall('/restaurants/users', {
    method: 'POST',
    body: JSON.stringify({
      email: userData.email,
      password: userData.password,
      first_name: userData.first_name,
      last_name: userData.last_name,
      role: userData.role,  // 'waiter' | 'cashier' | 'manager'
      phone: userData.phone
    })
  });

  return user.user;
}

// Modifier un utilisateur
async function updateUser(userId, userData) {
  const user = await apiCall(`/restaurants/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(userData)
  });

  return user.user;
}

// Supprimer un utilisateur
async function deleteUser(userId) {
  await apiCall(`/restaurants/users/${userId}`, {
    method: 'DELETE'
  });
}

// ============================================
// 10. EXEMPLE: FLUX COMPLET PRISE DE COMMANDE
// ============================================

async function exemplePriseCommande() {
  try {
    // 1. Charger le menu
    const menu = await loadFullMenu();
    console.log('Menu chargé:', menu);

    // 2. Client ajoute au panier
    const cart = new Cart();
    const produit1 = menu[0].categories[0].products[0];
    cart.addItem(produit1, 2);
    
    console.log('Panier:', cart.items);
    console.log('Total:', cart.getTotal());

    // 3. Créer la commande
    const order = await createOrderFromCart(cart, '10', 'dine_in');
    console.log('Commande créée:', order.order_number);

    // 4. Cuisine: changer statut
    await updateOrderStatus(order.id, 'preparing');
    console.log('Statut: preparing');

    await updateOrderStatus(order.id, 'ready');
    console.log('Statut: ready');

    // 5. Paiement Mobile Money
    const payment = await createPayment(
      order.id,
      order.total_amount,
      'mobile_money',
      {
        phone_number: '+221771234567',
        provider: 'Orange Money'
      }
    );
    console.log('Paiement créé:', payment.id);

    // 6. Client compose *144# et obtient code transaction
    const transactionCode = 'OM-123456789';  // Exemple

    // 7. Vérifier le paiement
    await verifyMobileMoneyPayment(payment.id, transactionCode);
    console.log('Paiement vérifié, facture générée!');

    // 8. Télécharger la facture
    // downloadInvoicePDF(invoiceId);

  } catch (error) {
    console.error('Erreur:', error.message);
    alert(error.message);  // Afficher message d'erreur à l'utilisateur
  }
}

// ============================================
// EXPORT (si module ES6)
// ============================================

export {
  // Auth
  login,
  register,
  logout,

  // Menu
  loadFullMenu,
  loadAvailableProducts,

  // Panier
  Cart,
  createOrderFromCart,

  // Commandes
  loadActiveOrders,
  loadOrderDetails,
  updateOrderStatus,
  cancelOrder,

  // Paiements
  createPayment,
  verifyMobileMoneyPayment,
  getOrderPayments,

  // Factures
  loadInvoices,
  downloadInvoicePDF,

  // Stats
  loadRestaurantStats,
  loadRestaurantInfo,
  loadSubscription,

  // Produits
  createProduct,
  updateProduct,
  adjustStock,
  deleteProduct,

  // Utilisateurs
  loadUsers,
  createUser,
  updateUser,
  deleteUser
};
