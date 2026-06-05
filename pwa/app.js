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
  cart: JSON.parse(localStorage.getItem('bizon_cart') || '[]'),
  orderType: 'dine_in',
  appliedVoucher: null
};

// ============================================
// NAVIGATION
// ============================================

function showSection(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');

  // Sync nav links (desktop)
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const navMap = { menu: 'nav-menu', orders: 'nav-orders', loyalty: 'nav-loyalty' };
  if (navMap[name]) document.getElementById(navMap[name])?.classList.add('active');

  // Sync bottom nav (mobile)
  document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
  const bnavMap = {
    menu: 'bnav-menu', orders: 'bnav-orders', loyalty: 'bnav-loyalty',
    login: 'bnav-profile', register: 'bnav-profile', profile: 'bnav-profile'
  };
  if (bnavMap[name]) document.getElementById(bnavMap[name])?.classList.add('active');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

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
    const initials = ((state.customer.first_name || '?')[0] + (state.customer.last_name || '')[0]).toUpperCase();
    zone.innerHTML = `
      <button class="header-user-btn" onclick="showSection('profile')">
        <span class="header-user-avatar">${initials}</span>
        ${state.customer.first_name}
      </button>
    `;
    // Mettre à jour le label du tab profil (mobile)
    const profileLabel = document.getElementById('bnav-profile-label');
    if (profileLabel) profileLabel.textContent = 'Profil';
  } else {
    zone.innerHTML = `
      <button class="btn-secondary" onclick="showSection('login')">Connexion</button>
      <button class="btn-primary" onclick="showSection('register')">S'inscrire</button>
    `;
    const profileLabel = document.getElementById('bnav-profile-label');
    if (profileLabel) profileLabel.textContent = 'Connexion';
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

    // Stocker restaurant_id + afficher le nom du restaurant dans le header
    if (data.restaurant) {
      state.restaurantId = data.restaurant.id;
      const nameEl = document.querySelector('.logo-name');
      if (nameEl && data.restaurant.name) {
        nameEl.textContent = data.restaurant.name;
        document.title = `${data.restaurant.name} — Menu & Fidélité`;
      }
    }

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

    // Tuiles catégories
    const pillsEl = document.getElementById('category-pills');
    pillsEl.innerHTML = categories.map((cat, i) => `
      <button class="cat-tile ${i === 0 ? 'active' : ''}" data-cat="${cat.id}" onclick="filterByCategory('${cat.id}', this)">
        <span class="cat-tile-img">${cat.image_url ? `<img src="${cat.image_url}" alt="" onerror="this.replaceWith('${categoryEmoji(cat.name)}')">` : categoryEmoji(cat.name)}</span>
        <span class="cat-tile-name">${cat.name}</span>
      </button>
    `).join('');

    // Sidebar catégories (desktop)
    const sidebarEl = document.getElementById('sidebar-categories');
    if (sidebarEl) {
      sidebarEl.innerHTML = categories.map((cat, i) => `
        <a class="cat-sidebar-link ${i === 0 ? 'active' : ''}" data-cat="${cat.id}" onclick="filterByCategory('${cat.id}', this)">
          ${cat.name}
        </a>
      `).join('');
    }
    const sidebarCats = document.getElementById('sidebar-cats');
    if (sidebarCats) sidebarCats.style.display = '';

    // Afficher la première catégorie
    filterByCategory(categories[0].id, pillsEl.querySelector('.cat-pill'));
    document.getElementById('menu-content').style.display = '';
  } catch (err) {
    document.getElementById('menu-loading').innerHTML = `<p style="color:var(--error)">Erreur de chargement du menu</p>`;
  }
}

// Emoji de catégorie (selon le nom) — accent visuel quand pas d'image
function categoryEmoji(name) {
  const n = (name || '').toLowerCase();
  const map = [
    [/(entrée|salade|starter)/, '🥗'], [/(plat|main|riz|poulet|viande|boeuf|burger)/, '🍛'],
    [/(dessert|gâteau|gateau|patiss|sucr)/, '🍰'], [/(boisson|jus|drink|soda|café|cafe|thé|the)/, '🥤'],
    [/(pizza)/, '🍕'], [/(poisson|sea|fish)/, '🐟'], [/(grill|brochette|bbq)/, '🍢'],
    [/(petit|déj|dej|breakfast)/, '🥐'], [/(snack|frite)/, '🍟'], [/(soupe|soup)/, '🍲']
  ];
  for (const [re, emo] of map) if (re.test(n)) return emo;
  return '🍽️';
}

function filterByCategory(categoryId, clickedEl) {
  state.currentCategory = categoryId;

  // Update active tiles
  document.querySelectorAll('.cat-tile').forEach(p => p.classList.toggle('active', p.dataset.cat === categoryId));
  document.querySelectorAll('.cat-sidebar-link[data-cat]').forEach(l => l.classList.toggle('active', l.dataset.cat === categoryId));

  const products = state.allProducts.filter(p => p._categoryId === categoryId);
  const categoryName = products[0]?._categoryName || '';
  document.getElementById('menu-section-title').textContent = categoryName;
  renderProducts(products);
}

function productCardHTML(p) {
  const pData = JSON.stringify(p).replace(/"/g, '&quot;');
  const imgHtml = p.image_url
    ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy" onerror="this.style.display='none'">`
    : '';
  return `
    <div class="product-card" onclick="addToCart(${pData})" role="button" tabindex="0">
      <div class="product-img-wrap">
        ${imgHtml}
        ${!p.image_url ? '<span class="product-img-placeholder">🍽️</span>' : ''}
      </div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        ${p.description ? `<div class="product-desc">${p.description}</div>` : '<div class="product-desc"></div>'}
        <div class="product-footer">
          <span class="product-price">${Number(p.price).toLocaleString('fr-FR')} FCFA</span>
          <button class="btn-add" onclick="event.stopPropagation();addToCart(${pData})" aria-label="Ajouter ${p.name}">+</button>
        </div>
      </div>
    </div>`;
}

function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  if (!products.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);padding:1rem 0">Aucun produit disponible dans cette catégorie</p>';
    return;
  }
  grid.innerHTML = products.map(productCardHTML).join('');
}

// Recherche transversale (tous les produits chargés)
function searchProducts(query) {
  const q = (query || '').trim().toLowerCase();
  const pills = document.getElementById('category-pills');
  const title = document.getElementById('menu-section-title');
  const grid = document.getElementById('products-grid');
  const banner = document.getElementById('promo-banner');
  const results = document.getElementById('search-results');

  const setMenuView = (show) => {
    [pills, title, grid].forEach(el => { if (el) el.style.display = show ? '' : 'none'; });
    if (banner) banner.style.display = show ? '' : 'none';
  };

  if (!q) {
    setMenuView(true);
    results.style.display = 'none';
    results.innerHTML = '';
    return;
  }

  setMenuView(false);
  results.style.display = '';
  const matches = state.allProducts.filter(p =>
    p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
  );
  if (!matches.length) {
    results.innerHTML = `
      <div class="empty-state-c">
        <span class="empty-icon">🔍</span>
        <h3>Aucun résultat</h3>
        <p>Aucun plat ne correspond à « ${query.trim()} ».</p>
      </div>`;
    return;
  }
  results.innerHTML = `
    <div class="menu-section-title">${matches.length} résultat${matches.length > 1 ? 's' : ''}</div>
    <div class="products-grid">${matches.map(productCardHTML).join('')}</div>`;
}

// ============================================
// CART
// ============================================

function addToCart(product) {
  const existing = state.cart.find(i => i.id === product.id);
  if (existing) existing.quantity++;
  else state.cart.push({ id: product.id, name: product.name, price: product.price, image: product.image_url, quantity: 1 });
  resetVoucher();
  saveCart();
  updateCartBadge();
  showToast(`${product.name} ajouté`, 'success');
}

function saveCart() { localStorage.setItem('bizon_cart', JSON.stringify(state.cart)); }

function updateCartBadge() {
  const count = state.cart.reduce((s, i) => s + i.quantity, 0);
  // Header cart button badge
  const cartCount = document.getElementById('cart-count');
  if (cartCount) {
    cartCount.textContent = count;
    cartCount.classList.toggle('visible', count > 0);
  }
  // FAB badge
  const fabCount = document.getElementById('cart-fab-count');
  if (fabCount) fabCount.textContent = count;
  // FAB visibility
  const fab = document.getElementById('cart-fab');
  if (fab) fab.classList.toggle('hidden', count === 0);
}

function openCart() {
  renderCartPanel();
  document.getElementById('cart-sheet').classList.add('open');
}

function closeCart() { document.getElementById('cart-sheet').classList.remove('open'); }

function renderCartPanel() {
  const list = document.getElementById('cart-items-list');
  if (!state.cart.length) {
    list.innerHTML = '<div class="empty-cart-msg"><span>🛒</span>Votre panier est vide</div>';
    document.getElementById('cart-total-amount').textContent = '0 FCFA';
    state.appliedVoucher = null;
    document.getElementById('cart-discount-row').style.display = 'none';
    renderVoucherApplied();
    return;
  }
  renderVoucherApplied();
  list.innerHTML = state.cart.map((item, i) => `
    <div class="cart-item">
      <div class="cart-item-img" style="display:flex;align-items:center;justify-content:center;background:var(--bg-subtle);border-radius:10px;overflow:hidden;width:52px;height:52px;flex-shrink:0">
        ${item.image
          ? `<img src="${item.image}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<span style=font-size:1.5rem>🍽️</span>'">`
          : '<span style="font-size:1.5rem">🍽️</span>'}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${Number(item.price).toLocaleString('fr-FR')} FCFA × ${item.quantity}</div>
      </div>
      <div class="cart-qty">
        <button class="qty-btn" onclick="changeQty(${i}, -1)" aria-label="Diminuer">−</button>
        <span style="font-weight:700;min-width:20px;text-align:center">${item.quantity}</span>
        <button class="qty-btn" onclick="changeQty(${i}, 1)" aria-label="Augmenter">+</button>
      </div>
    </div>
  `).join('');
  const fmt = (n) => `${Number(Math.round(n)).toLocaleString('fr-FR')} FCFA`;

  const subtotal = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = Math.min(state.appliedVoucher ? state.appliedVoucher.discount : 0, subtotal);
  const total = subtotal - discount; // pas de TVA ajoutée

  document.getElementById('cart-subtotal-amount').textContent = fmt(subtotal);
  document.getElementById('cart-total-amount').textContent = fmt(total);

  const discountRow = document.getElementById('cart-discount-row');
  if (discount > 0) {
    discountRow.style.display = '';
    document.getElementById('cart-discount-amount').textContent = `-${fmt(discount)}`;
  } else {
    discountRow.style.display = 'none';
  }
}

async function applyVoucher() {
  const input = document.getElementById('voucher-code-input');
  const code = input.value.trim();
  if (!code) return;
  if (!state.token) {
    showToast('Connectez-vous pour utiliser un code promo', 'info');
    closeCart();
    showSection('login');
    return;
  }
  const subtotal = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const btn = document.getElementById('btn-apply-voucher');
  btn.disabled = true;
  try {
    const res = await apiCall('/customers/validate-voucher', {
      method: 'POST', body: JSON.stringify({ code, subtotal })
    });
    state.appliedVoucher = { code: res.code, discount: res.discount };
    input.value = '';
    renderVoucherApplied();
    renderCartPanel();
    showToast(`Code ${res.code} appliqué 🎉`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// Affiche/masque la puce "code appliqué" et la ligne de saisie.
function renderVoucherApplied() {
  const chip = document.getElementById('voucher-applied');
  const row = document.querySelector('.voucher-row');
  if (!chip) return;
  if (state.appliedVoucher) {
    chip.style.display = 'flex';
    chip.innerHTML = `<span>✓ <strong>${state.appliedVoucher.code}</strong> &nbsp;·&nbsp; −${Number(state.appliedVoucher.discount).toLocaleString('fr-FR')} FCFA</span><button onclick="removeVoucher()" aria-label="Retirer le code">✕</button>`;
    if (row) row.style.display = 'none';
  } else {
    chip.style.display = 'none';
    chip.innerHTML = '';
    if (row) row.style.display = 'flex';
  }
}

function removeVoucher() {
  state.appliedVoucher = null;
  renderVoucherApplied();
  renderCartPanel();
}

// Le code promo dépend du sous-total : on le réinitialise à chaque changement de panier.
function resetVoucher() {
  state.appliedVoucher = null;
  renderVoucherApplied();
}

function changeQty(index, delta) {
  state.cart[index].quantity += delta;
  if (state.cart[index].quantity <= 0) state.cart.splice(index, 1);
  resetVoucher();
  saveCart();
  updateCartBadge();
  renderCartPanel();
}

function selectOrderType(type, btn) {
  state.orderType = type;
  document.querySelectorAll('.otype').forEach(b => b.classList.toggle('active', b === btn));
  // Champ conditionnel : table (sur place) / adresse (livraison)
  const tableInput = document.getElementById('order-table');
  const addressInput = document.getElementById('order-address');
  tableInput.style.display = type === 'dine_in' ? '' : 'none';
  addressInput.style.display = type === 'delivery' ? '' : 'none';
  // Pré-remplir l'adresse depuis le profil si disponible
  if (type === 'delivery' && !addressInput.value && state.customer?.address) {
    addressInput.value = state.customer.address;
  }
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
  showToast('Vous êtes déconnecté', 'info');
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
      list.innerHTML = `
        <div class="empty-state-c">
          <span class="empty-icon">🧾</span>
          <h3>Aucune commande</h3>
          <p>Vos commandes apparaîtront ici une fois passées.</p>
          <button class="btn-primary-full" style="max-width:240px" onclick="showSection('menu')">Découvrir le menu</button>
        </div>`;
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

async function renderLoyalty() {
  if (!state.customer) return;
  document.getElementById('loyalty-name').textContent = `${state.customer.first_name} ${state.customer.last_name}`;
  const ptsEl = document.getElementById('loyalty-pts');
  const histEl = document.getElementById('loyalty-history');

  renderRewards();

  try {
    const data = await apiCall('/customers/me/loyalty');
    ptsEl.textContent = data.points || 0;
    // garder le solde à jour localement
    if (state.customer) state.customer.loyalty_points = data.points || 0;

    const txns = data.transactions || [];
    if (!txns.length) {
      histEl.innerHTML = `<div class="lh-empty"><span>✨</span>Aucun point pour le moment.<br>Passez une commande pour en gagner !</div>`;
      return;
    }
    const typeLabel = { earn: 'Points gagnés', redeem: 'Points utilisés', adjust: 'Ajustement' };
    histEl.innerHTML = txns.map(t => {
      const date = new Date(t.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      const sign = t.points > 0 ? '+' : '';
      const cls = t.points >= 0 ? 'earn' : 'redeem';
      return `
        <div class="lh-item">
          <div class="lh-left">
            <h4>${t.description || typeLabel[t.type] || 'Mouvement'}</h4>
            <span>${date}</span>
          </div>
          <div class="lh-points ${cls}">${sign}${t.points} pts</div>
        </div>`;
    }).join('');
  } catch {
    ptsEl.textContent = state.customer.loyalty_points || 0;
    histEl.innerHTML = `<div class="lh-empty">Impossible de charger l'historique.</div>`;
  }
}

function voucherLabel(v) {
  return v.discount_type === 'percentage'
    ? `${Math.round(v.discount_value)}% de réduction`
    : `${Number(v.discount_value).toLocaleString('fr-FR')} FCFA de réduction`;
}

async function renderRewards() {
  const availEl = document.getElementById('rewards-available');
  const myWrap = document.getElementById('my-vouchers-wrap');
  const myEl = document.getElementById('my-vouchers');
  try {
    const data = await apiCall('/customers/me/rewards');
    const points = data.points || 0;

    // Récompenses échangeables
    if (!data.available || !data.available.length) {
      availEl.innerHTML = `<div class="lh-empty" style="padding:1.5rem 0"><span>🎁</span>Aucune récompense disponible pour le moment.</div>`;
    } else {
      availEl.innerHTML = data.available.map(r => {
        const affordable = points >= r.points_cost;
        return `
          <div class="reward-item">
            <div class="reward-info">
              <h4>${voucherLabel(r)}</h4>
              <span>${r.description || r.code}${Number(r.min_order_amount) > 0 ? ` · dès ${Number(r.min_order_amount).toLocaleString('fr-FR')} FCFA` : ''}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <span class="reward-cost">${r.points_cost} pts</span>
              <button class="btn-redeem" ${affordable ? '' : 'disabled'} onclick="redeemReward('${r.id}')">
                ${affordable ? 'Échanger' : 'Trop peu'}
              </button>
            </div>
          </div>`;
      }).join('');
    }

    // Mes bons personnels
    const mine = data.myVouchers || [];
    if (!mine.length) {
      myWrap.style.display = 'none';
    } else {
      myWrap.style.display = '';
      myEl.innerHTML = mine.map(v => {
        const used = v.used_count >= (v.max_uses || 1);
        return `
          <div class="voucher-item ${used ? 'used' : ''}">
            <div>
              <div class="voucher-code-tag">${v.code}</div>
              <small>${voucherLabel(v)}</small>
            </div>
            ${used ? '<span class="voucher-used-badge">Utilisé</span>'
                   : '<span class="reward-cost">Disponible</span>'}
          </div>`;
      }).join('');
    }
  } catch {
    availEl.innerHTML = `<div class="lh-empty">Impossible de charger les récompenses.</div>`;
  }
}

async function redeemReward(rewardId) {
  try {
    const res = await apiCall('/customers/me/redeem', {
      method: 'POST', body: JSON.stringify({ reward_id: rewardId })
    });
    showToast(`Bon obtenu : ${res.voucher.code} 🎉`, 'success', 5000);
    // Rafraîchir le solde + listes
    await loadCustomerProfile();
    renderLoyalty();
  } catch (err) {
    showToast(err.message, 'error');
  }
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

  // Construire le corps selon le type de commande
  const body = {
    type: state.orderType,
    items: state.cart.map(i => ({ product_id: i.id, quantity: i.quantity }))
  };
  if (state.appliedVoucher) body.voucher_code = state.appliedVoucher.code;
  if (state.orderType === 'dine_in') {
    const table = document.getElementById('order-table').value.trim();
    if (!table) { showToast('Indiquez le numéro de table', 'error'); return; }
    body.table_number = table;
  } else if (state.orderType === 'delivery') {
    const address = document.getElementById('order-address').value.trim();
    if (!address) { showToast('Indiquez l\'adresse de livraison', 'error'); return; }
    body.delivery_address = address;
  }

  const btn = document.getElementById('btn-checkout');
  btn.disabled = true;
  btn.textContent = 'Redirection vers le paiement…';
  try {
    const { payment } = await apiCall('/customers/orders', {
      method: 'POST', body: JSON.stringify(body)
    });
    // Vider le panier puis rediriger vers la page de paiement Flutterwave
    state.cart = [];
    resetVoucher();
    saveCart();
    updateCartBadge();
    if (payment?.link) {
      window.location.href = payment.link;
    } else {
      closeCart();
      showToast('Commande créée, mais le paiement n\'a pas pu démarrer.', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Commander & payer';
  }
});

// ============================================
// INIT
// ============================================

// ============================================
// ONBOARDING (1ère visite)
// ============================================

const ONBOARDING_SLIDES = [
  { emoji: '🍽️', title: 'Le menu à portée de main', text: 'Parcourez les plats du restaurant et composez votre commande en quelques taps.' },
  { emoji: '🛵', title: 'Sur place, à emporter ou livré', text: 'Choisissez votre mode de commande et payez en ligne, en toute sécurité.' },
  { emoji: '🎁', title: 'Gagnez des récompenses', text: 'Cumulez des points à chaque commande et échangez-les contre des bons de réduction.' }
];
let onbIndex = 0;

function renderOnboarding() {
  const s = ONBOARDING_SLIDES[onbIndex];
  const emojiEl = document.getElementById('onb-emoji');
  emojiEl.textContent = s.emoji;
  // relancer l'animation
  emojiEl.style.animation = 'none'; void emojiEl.offsetWidth; emojiEl.style.animation = '';
  document.getElementById('onb-title').textContent = s.title;
  document.getElementById('onb-text').textContent = s.text;
  document.getElementById('onb-dots').innerHTML = ONBOARDING_SLIDES
    .map((_, i) => `<span class="dot ${i === onbIndex ? 'active' : ''}"></span>`).join('');
  const last = onbIndex === ONBOARDING_SLIDES.length - 1;
  document.getElementById('onb-next').textContent = last ? 'Commencer' : 'Suivant';
  document.getElementById('onb-skip').style.visibility = last ? 'hidden' : 'visible';
}

function nextOnboarding() {
  if (onbIndex < ONBOARDING_SLIDES.length - 1) { onbIndex++; renderOnboarding(); }
  else finishOnboarding();
}

function finishOnboarding() {
  localStorage.setItem('bizon_onboarded', '1');
  const el = document.getElementById('onboarding');
  el.style.transition = 'opacity 0.3s'; el.style.opacity = '0';
  setTimeout(() => { el.style.display = 'none'; }, 300);
}

function maybeShowOnboarding() {
  if (localStorage.getItem('bizon_onboarded')) return;
  onbIndex = 0;
  renderOnboarding();
  document.getElementById('onboarding').style.display = 'flex';
}

// ============================================
// CARROUSEL DE BANNIÈRES
// ============================================

function initPromoCarousel() {
  const carousel = document.getElementById('promo-carousel');
  const dotsEl = document.getElementById('promo-dots');
  if (!carousel || !dotsEl) return;
  const slides = carousel.children.length;

  dotsEl.innerHTML = Array.from({ length: slides }, (_, i) =>
    `<span class="dot ${i === 0 ? 'active' : ''}" onclick="scrollPromo(${i})"></span>`).join('');

  const update = () => {
    const idx = Math.round(carousel.scrollLeft / carousel.clientWidth);
    [...dotsEl.children].forEach((d, i) => d.classList.toggle('active', i === idx));
  };
  carousel.addEventListener('scroll', () => requestAnimationFrame(update));

  window.scrollPromo = (i) => carousel.scrollTo({ left: i * carousel.clientWidth, behavior: 'smooth' });

  // Auto-défilement (uniquement quand la page menu est visible)
  setInterval(() => {
    const onMenu = document.getElementById('page-menu')?.classList.contains('active');
    const visible = document.getElementById('promo-banner')?.style.display !== 'none';
    if (!onMenu || !visible || carousel.clientWidth === 0) return;
    const next = (Math.round(carousel.scrollLeft / carousel.clientWidth) + 1) % slides;
    carousel.scrollTo({ left: next * carousel.clientWidth, behavior: 'smooth' });
  }, 5000);
}

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  maybeShowOnboarding();
  updateCartBadge();
  renderAuthZone();

  // Charger profil client si token existant
  if (state.token) {
    await loadCustomerProfile();
  }

  // Charger le menu public
  await loadMenu();

  // Carrousel de bannières
  initPromoCarousel();
});
