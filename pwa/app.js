// ============================================
// BIZON — App Client
// ============================================
const API = '/api';

const state = {
  customer: null,
  token: localStorage.getItem('bizon_customer_token') || null,
  restaurantId: null,
  allProducts: [], // tous les produits chargés
  currentCategory: null,
  menus: [],
  cart: JSON.parse(localStorage.getItem('bizon_cart') || '[]')
};

// ============================================
// NAVIGATION
// ============================================

function showSection(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');

  // Mettre à jour la nav
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const navMap = { menu: 'nav-menu', orders: 'nav-orders', loyalty: 'nav-loyalty' };
  if (navMap[name]) document.getElementById(navMap[name])?.classList.add('active');

  // Actions spécifiques
  if (name === 'orders') loadOrders();
  if (name === 'loyalty') renderLoyalty();
  if (name === 'profile') fillProfileForm();
}

function requireAuth(callback) {
  if (!state.token) {
    showSection('login');
    return;
  }
  callback();
}

// ============================================
// AUTH ZONE HEADER
// ============================================

function renderAuthZone() {
  const zone = document.getElementById('header-auth-zone');
  if (state.customer) {
    zone.innerHTML = `
      <button class="header-user-btn" onclick="showSection('profile')">
        👤 ${state.customer.first_name}
      </button>
      <button class="btn-secondary" onclick="logout()" style="margin-left:8px;font-size:0.8125rem;padding:6px 12px">
        Déconnexion
      </button>
    `;
  } else {
    zone.innerHTML = `
      <button class="btn-secondary" onclick="showSection('login')">Connexion</button>
      <button class="btn-primary" onclick="showSection('register')" style="margin-left:8px">S'inscrire</button>
    `;
  }
}

// ============================================
// API
// ============================================

async function apiCall(endpoint, options = {}, useCustomerToken = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useCustomerToken && state.token) headers['Authorization'] = `Bearer ${state.token}`;
  try {
    const res = await fetch(`${API}${endpoint}`, { ...options, headers: { ...headers, ...options.headers } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur');
    return data;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// ============================================
// MENU PUBLIC
// ============================================

async function loadMenu() {
  try {
    const restaurantId = state.restaurantId;
    const url = restaurantId ? `/public/menu?restaurantId=${restaurantId}` : '/public/menu';
    const data = await apiCall(url, {}, false);

    document.getElementById('menu-loading').style.display = 'none';

    if (!data.available || !data.menus || data.menus.length === 0) {
      document.getElementById('menu-unavailable').style.display = 'block';
      return;
    }

    // Stocker restaurant_id pour les futures requêtes
    if (data.restaurant) state.restaurantId = data.restaurant.id;

    state.menus = data.menus;
    state.allProducts = [];

    // Construire la liste des catégories
    const categories = [];
    for (const menu of data.menus) {
      for (const cat of (menu.categories || [])) {
        if (cat.products && cat.products.length > 0) {
          categories.push(cat);
          state.allProducts.push(...cat.products.map(p => ({ ...p, _categoryId: cat.id, _categoryName: cat.name })));
        }
      }
    }

    if (categories.length === 0) {
      document.getElementById('menu-unavailable').style.display = 'block';
      return;
    }

    // Pills catégories
    const pillsEl = document.getElementById('category-pills');
    pillsEl.innerHTML = categories.map((cat, i) => `
      <button class="cat-pill ${i === 0 ? 'active' : ''}" data-cat="${cat.id}" onclick="filterByCategory('${cat.id}', this)">
        ${cat.name}
      </button>
    `).join('');

    // Sidebar
    const sidebarEl = document.getElementById('sidebar-categories');
    sidebarEl.innerHTML = categories.map((cat, i) => `
      <a class="sidebar-link ${i === 0 ? 'active' : ''}" data-cat="${cat.id}" onclick="filterByCategory('${cat.id}', this)">
        ${cat.name}
      </a>
    `).join('');
    document.getElementById('sidebar').style.display = '';

    // Afficher la première catégorie
    filterByCategory(categories[0].id, pillsEl.querySelector('.cat-pill'));
    document.getElementById('menu-content').style.display = '';
  } catch (err) {
    document.getElementById('menu-loading').innerHTML = `<p style="color:var(--error)">Erreur de chargement du menu</p>`;
  }
}

function filterByCategory(categoryId, clickedEl) {
  state.currentCategory = categoryId;

  // Update active pills
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.toggle('active', p.dataset.cat === categoryId));
  document.querySelectorAll('.sidebar-link[data-cat]').forEach(l => l.classList.toggle('active', l.dataset.cat === categoryId));

  const products = state.allProducts.filter(p => p._categoryId === categoryId);
  const categoryName = products[0]?._categoryName || '';
  document.getElementById('menu-section-title').textContent = categoryName;
  renderProducts(products);
}

function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  if (!products.length) {
    grid.innerHTML = '<p style="color:var(--text-light)">Aucun produit disponible</p>';
    return;
  }
  grid.innerHTML = products.map(p => `
    <div class="product-card" onclick="addToCart(${JSON.stringify(p).replace(/"/g, '&quot;')})">
      <img class="product-img" src="${p.image_url || 'https://via.placeholder.com/300x140?text=Produit'}"
           alt="${p.name}" onerror="this.src='https://via.placeholder.com/300x140?text=Produit'">
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        ${p.description ? `<div class="product-desc">${p.description}</div>` : ''}
        <div class="product-footer">
          <span class="product-price">${Number(p.price).toLocaleString('fr-FR')} FCFA</span>
          <button class="btn-add" onclick="event.stopPropagation();addToCart(${JSON.stringify(p).replace(/"/g, '&quot;')})">+</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ============================================
// CART
// ============================================

function addToCart(product) {
  const existing = state.cart.find(i => i.id === product.id);
  if (existing) existing.quantity++;
  else state.cart.push({ id: product.id, name: product.name, price: product.price, image: product.image_url, quantity: 1 });
  saveCart();
  updateCartBadge();
  showToast(`${product.name} ajouté`, 'success');
}

function saveCart() { localStorage.setItem('bizon_cart', JSON.stringify(state.cart)); }

function updateCartBadge() {
  const count = state.cart.reduce((s, i) => s + i.quantity, 0);
  document.getElementById('cart-count').textContent = count;
  document.getElementById('cart-fab-count').textContent = count;
  const fab = document.getElementById('cart-fab');
  fab.classList.toggle('hidden', count === 0);
}

function openCart() {
  renderCartPanel();
  document.getElementById('cart-sheet').classList.add('open');
}

function closeCart() { document.getElementById('cart-sheet').classList.remove('open'); }

function renderCartPanel() {
  const list = document.getElementById('cart-items-list');
  if (!state.cart.length) {
    list.innerHTML = '<div class="empty-cart-msg">Votre panier est vide</div>';
    document.getElementById('cart-total-amount').textContent = '0 FCFA';
    return;
  }
  list.innerHTML = state.cart.map((item, i) => `
    <div class="cart-item">
      <img class="cart-item-img" src="${item.image || 'https://via.placeholder.com/52'}" alt="${item.name}">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${Number(item.price).toLocaleString('fr-FR')} FCFA</div>
      </div>
      <div class="cart-qty">
        <button class="qty-btn" onclick="changeQty(${i}, -1)">−</button>
        <span>${item.quantity}</span>
        <button class="qty-btn" onclick="changeQty(${i}, 1)">+</button>
      </div>
    </div>
  `).join('');
  const total = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  document.getElementById('cart-total-amount').textContent = `${Number(total).toLocaleString('fr-FR')} FCFA`;
}

function changeQty(index, delta) {
  state.cart[index].quantity += delta;
  if (state.cart[index].quantity <= 0) state.cart.splice(index, 1);
  saveCart();
  updateCartBadge();
  renderCartPanel();
}

// ============================================
// AUTH CLIENT
// ============================================

async function login(identifier, password) {
  const isEmail = identifier.includes('@');
  const body = isEmail
    ? { email: identifier, password }
    : { phone: identifier, password };
  if (state.restaurantId) body.restaurantId = state.restaurantId;

  const data = await apiCall('/customers/login', { method: 'POST', body: JSON.stringify(body) }, false);

  state.token = data.token;
  state.customer = data.customer;
  localStorage.setItem('bizon_customer_token', data.token);
  renderAuthZone();
  return data;
}

async function register(formData) {
  const body = { ...formData };
  if (state.restaurantId) body.restaurantId = state.restaurantId;

  const data = await apiCall('/customers/register', { method: 'POST', body: JSON.stringify(body) }, false);
  state.token = data.token;
  state.customer = data.customer;
  localStorage.setItem('bizon_customer_token', data.token);
  renderAuthZone();
  return data;
}

function logout() {
  state.token = null;
  state.customer = null;
  localStorage.removeItem('bizon_customer_token');
  renderAuthZone();
  showSection('menu');
  showToast('Déconnecté', 'info');
}

async function loadCustomerProfile() {
  if (!state.token) return;
  try {
    const customer = await apiCall('/customers/me');
    state.customer = customer;
    renderAuthZone();
  } catch {
    state.token = null;
    localStorage.removeItem('bizon_customer_token');
    renderAuthZone();
  }
}

// ============================================
// ORDERS
// ============================================

async function loadOrders() {
  const list = document.getElementById('orders-list');
  try {
    const orders = await apiCall('/customers/me/orders');
    if (!orders.length) {
      list.innerHTML = '<div style="text-align:center;color:var(--text-light);padding:3rem">Vous n\'avez pas encore de commandes</div>';
      return;
    }
    const statusLabels = { confirmed: 'Confirmée', preparing: 'En préparation', ready: 'Prête', paid: 'Payée', cancelled: 'Annulée', draft: 'Brouillon' };
    list.innerHTML = orders.map(o => `
      <div class="order-history-item">
        <div class="oh-left">
          <h4>${o.order_number || o.id}</h4>
          <span>${new Date(o.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
        <div class="oh-right">
          <div class="oh-amount">${Number(o.total_amount).toLocaleString('fr-FR')} FCFA</div>
          <div class="oh-status status-${o.status}">${statusLabels[o.status] || o.status}</div>
        </div>
      </div>
    `).join('');
  } catch {
    list.innerHTML = '<div style="color:var(--error);text-align:center;padding:2rem">Erreur de chargement</div>';
  }
}

// ============================================
// PROFIL
// ============================================

function fillProfileForm() {
  if (!state.customer) return;
  document.getElementById('prof-firstname').value = state.customer.first_name || '';
  document.getElementById('prof-lastname').value = state.customer.last_name || '';
  document.getElementById('prof-phone').value = state.customer.phone || '';
  document.getElementById('prof-email').value = state.customer.email || '';
  document.getElementById('prof-address').value = state.customer.address || '';
}

// ============================================
// LOYALTY
// ============================================

function renderLoyalty() {
  if (!state.customer) return;
  document.getElementById('loyalty-pts').textContent = state.customer.loyalty_points || 0;
  document.getElementById('loyalty-name').textContent = `${state.customer.first_name} ${state.customer.last_name}`;
}

// ============================================
// TOAST
// ============================================

function showToast(msg, type = 'info', duration = 3000) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

// ============================================
// EVENT LISTENERS
// ============================================

document.getElementById('btn-cart-open').addEventListener('click', openCart);

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  try {
    await login(
      document.getElementById('login-identifier').value,
      document.getElementById('login-password').value
    );
    showToast('Connecté !', 'success');
    showSection('menu');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('form-register').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-register');
  btn.disabled = true;
  try {
    await register({
      first_name: document.getElementById('reg-firstname').value,
      last_name: document.getElementById('reg-lastname').value,
      phone: document.getElementById('reg-phone').value,
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-password').value
    });
    showToast('Compte créé ! Bienvenue 🎉', 'success');
    showSection('loyalty');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('form-profile').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-save-profile');
  btn.disabled = true;
  try {
    const updated = await apiCall('/customers/me', {
      method: 'PUT',
      body: JSON.stringify({
        first_name: document.getElementById('prof-firstname').value,
        last_name: document.getElementById('prof-lastname').value,
        phone: document.getElementById('prof-phone').value,
        email: document.getElementById('prof-email').value,
        address: document.getElementById('prof-address').value
      })
    });
    state.customer = updated.customer;
    renderAuthZone();
    showToast('Profil enregistré', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('btn-checkout').addEventListener('click', async () => {
  if (!state.token) {
    closeCart();
    showSection('login');
    showToast('Connectez-vous pour commander', 'info');
    return;
  }
  if (!state.cart.length) return;
  try {
    const orderData = {
      type: 'dine_in',
      table_number: 1,
      items: state.cart.map(i => ({ product_id: i.id, quantity: i.quantity, unit_price: i.price }))
    };
    await apiCall('/orders', { method: 'POST', body: JSON.stringify(orderData) });
    state.cart = [];
    saveCart();
    updateCartBadge();
    closeCart();
    showToast('Commande envoyée ! 🎉', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  updateCartBadge();
  renderAuthZone();

  // Charger profil client si token existant
  if (state.token) {
    await loadCustomerProfile();
  }

  // Charger le menu public
  await loadMenu();
});
