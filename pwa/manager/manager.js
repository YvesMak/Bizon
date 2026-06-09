// ============================================
// BIZON PWA - MANAGER/OWNER MODULE
// Tableau de bord, gestion menu/produits/équipe
// ============================================

const API_BASE_URL = '/api';

// ============================================
// STATE MANAGEMENT
// ============================================
const mgrState = {
    user: null,
    token: localStorage.getItem('bizon_token') || null,
    restaurantId: localStorage.getItem('bizon_restaurant_id') || null,
    isOwner: false,
    stats: null,
    orders: [],
    menus: [],
    products: [],
    categories: [],
    users: [],
    filters: { orderStatus: 'all' },
    editingItem: null,
    formType: null
};

// ============================================
// AUTH & ROLE CHECK
// ============================================

function checkManagerAuth() {
    if (!mgrState.token) {
        window.location.href = '../staff/login.html';
        return false;
    }

    try {
        const payload = JSON.parse(atob(mgrState.token.split('.')[1]));
        mgrState.user = payload;

        if (payload.role !== 'manager' && payload.role !== 'owner') {
            showToast('Accès refusé : rôle manager ou propriétaire requis', 'error');
            setTimeout(() => window.location.href = '../staff/login.html', 2000);
            return false;
        }

        mgrState.isOwner = payload.role === 'owner';

        // Update UI for role
        document.getElementById('role-badge').textContent =
            mgrState.isOwner ? 'PROPRIÉTAIRE' : 'MANAGER';
        document.getElementById('user-name').textContent =
            `${payload.firstName || ''} ${payload.lastName || ''}`.trim();

        // Show owner-only sections
        if (mgrState.isOwner) {
            document.querySelectorAll('.owner-only').forEach(el => {
                el.style.display = '';
            });
        }

        return true;
    } catch (error) {
        console.error('Token invalide:', error);
        localStorage.removeItem('bizon_token');
        window.location.href = '../staff/login.html';
        return false;
    }
}

// ============================================
// API CALLS
// ============================================

async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(mgrState.token && { 'Authorization': `Bearer ${mgrState.token}` })
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: { ...headers, ...options.headers }
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                showToast('Session expirée', 'error');
                setTimeout(() => {
                    localStorage.removeItem('bizon_token');
                    window.location.href = '../staff/login.html';
                }, 1500);
                return null;
            }
            if (response.status === 403) {
                showToast('Accès refusé : permissions insuffisantes', 'error');
                return null;
            }
            throw new Error(data.error || data.message || 'Une erreur est survenue');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ============================================
// UI UTILITIES
// ============================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
}

function navigateTo(page) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) link.classList.add('active');
    });

    showPage(page);

    switch (page) {
        case 'dashboard': loadDashboard(); break;
        case 'orders': loadOrders(); break;
        case 'menus': loadMenus(); break;
        case 'products': loadProducts(); break;
        case 'users': loadUsers(); break;
        case 'vouchers': loadVouchers(); break;
        case 'customers': loadCustomers(); break;
        case 'accounting': loadAccounting(); break;
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatAmount(amount) {
    return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function getStatusBadge(status) {
    const statusLabels = {
        draft: 'Brouillon', confirmed: 'Confirmée', preparing: 'En préparation',
        ready: 'Prête', paid: 'Payée', completed: 'Payée', cancelled: 'Annulée'
    };
    const displayStatus = status === 'completed' ? 'paid' : status;
    return `<span class="status-badge ${displayStatus}">${statusLabels[status] || status}</span>`;
}

function getRoleBadge(role) {
    const roleLabels = {
        owner: 'Propriétaire', manager: 'Manager', waiter: 'Serveur', cashier: 'Caissier'
    };
    return `<span class="role-label role-${role}">${roleLabels[role] || role}</span>`;
}

// ============================================
// MODAL - Confirmation
// ============================================

let modalCallback = null;

function showModal(title, message, callback) {
    modalCallback = callback;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal-confirm').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-confirm').classList.remove('active');
    modalCallback = null;
}

async function confirmModal() {
    if (modalCallback) await modalCallback();
    closeModal();
}

// ============================================
// MODAL - Formulaire
// ============================================

function showFormModal(title, bodyHtml) {
    document.getElementById('form-title').textContent = title;
    document.getElementById('form-body').innerHTML = bodyHtml;
    document.getElementById('modal-form').classList.add('active');
}

function closeFormModal() {
    document.getElementById('modal-form').classList.remove('active');
    mgrState.editingItem = null;
    mgrState.formType = null;
}

async function submitForm() {
    switch (mgrState.formType) {
        case 'menu': await saveMenu(); break;
        case 'category': await saveCategory(); break;
        case 'product': await saveProduct(); break;
        case 'user': await saveUser(); break;
        case 'stock': await saveStock(); break;
        case 'voucher': await saveVoucher(); break;
    }
}

// ============================================
// DASHBOARD
// ============================================

async function loadDashboard() {
    loadDeliverySettings();
    loadPaymentConfig();
    try {
        const stats = await apiCall('/restaurants/stats');
        if (!stats) return;

        mgrState.stats = stats;

        document.getElementById('stat-orders-total').textContent = stats.orders.total;
        document.getElementById('stat-orders-today').textContent = stats.orders.today;
        document.getElementById('stat-revenue-total').textContent = formatAmount(stats.revenue.total);
        document.getElementById('stat-revenue-today').textContent = formatAmount(stats.revenue.today);
        document.getElementById('stat-products-total').textContent = stats.products.total;
        document.getElementById('stat-products-low').textContent = stats.products.lowStock;
        document.getElementById('stat-users-active').textContent = stats.users.active;

        if (mgrState.isOwner) {
            loadSubscriptionLimits();
        }

        loadAnalytics();
    } catch (error) {
        showToast('Erreur chargement statistiques: ' + error.message, 'error');
    }
}

async function loadAnalytics() {
    try {
        const a = await apiCall('/analytics');
        if (!a) return;

        // CA 7 jours — barres CSS
        const max = Math.max(1, ...a.revenue7d.map(d => d.total));
        document.getElementById('revenue-chart').innerHTML = a.revenue7d.map(d => {
            const h = Math.max(2, Math.round((d.total / max) * 100));
            const label = new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short' });
            return `<div class="bar-col">
                <div class="bar-wrap"><div class="bar" style="height:${h}%" title="${formatAmount(d.total)}"></div></div>
                <span class="bar-label">${label}</span>
            </div>`;
        }).join('');

        // Top produits
        const tp = a.topProducts || [];
        document.getElementById('top-products').innerHTML = tp.length
            ? tp.map((p, i) => `
                <div class="tp-row">
                    <span class="tp-rank">${i + 1}</span>
                    <span class="tp-name">${escapeHtml(p.name)}</span>
                    <span class="tp-qty">${p.quantity} vendu${p.quantity > 1 ? 's' : ''}</span>
                </div>`).join('')
            : '<p class="analytics-empty">Aucune vente pour le moment</p>';

        // Codes promo
        document.getElementById('voucher-stats').innerHTML = `
            <div class="mini-row"><span>Commandes avec réduction</span><strong>${a.vouchers.orders_with_discount}</strong></div>
            <div class="mini-row"><span>Réductions accordées</span><strong>${formatAmount(a.vouchers.total_discount)}</strong></div>`;

        // Fidélité
        document.getElementById('loyalty-stats').innerHTML = `
            <div class="mini-row"><span>Membres actifs</span><strong>${a.loyalty.members}</strong></div>
            <div class="mini-row"><span>Points gagnés</span><strong>${a.loyalty.earned.toLocaleString('fr-FR')}</strong></div>
            <div class="mini-row"><span>Points échangés</span><strong>${a.loyalty.redeemed.toLocaleString('fr-FR')}</strong></div>`;
    } catch (error) {
        // Analytics non bloquant pour le dashboard
        console.error('Analytics:', error.message);
    }
}

async function loadSubscriptionLimits() {
    try {
        const data = await apiCall('/subscriptions/limits');
        if (!data) return;

        const container = document.getElementById('subscription-info');
        container.innerHTML = `
            <div class="info-row">
                <span class="label">Plan:</span>
                <span class="value">${data.plan || 'Gratuit'}</span>
            </div>
            <div class="info-row">
                <span class="label">Commandes:</span>
                <span class="value">${data.orders_used || 0} / ${data.orders_limit || '∞'}</span>
            </div>
            <div class="info-row">
                <span class="label">Utilisateurs:</span>
                <span class="value">${data.users_used || 0} / ${data.users_limit || '∞'}</span>
            </div>
        `;
    } catch (error) {
        document.getElementById('subscription-info').innerHTML =
            '<p style="color: var(--text-light);">Informations non disponibles</p>';
    }
}

// ============================================
// ORDERS
// ============================================

async function loadOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '<div class="loading">Chargement des commandes...</div>';

    try {
        let endpoint = '/orders';
        if (mgrState.filters.orderStatus !== 'all') {
            endpoint += `?status=${mgrState.filters.orderStatus}`;
        }

        const response = await apiCall(endpoint);
        if (!response) {
            throw new Error('Erreur lors du chargement');
        }

        mgrState.orders = response.orders || (Array.isArray(response) ? response : []);

        if (mgrState.orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <p>Aucune commande</p>
                </div>
            `;
            return;
        }

        container.innerHTML = mgrState.orders.map(order => `
            <div class="order-card" onclick="viewOrderDetail('${order.id}')">
                <div class="order-card-header">
                    <span class="order-number">${order.order_number || '#' + order.id}</span>
                    ${getStatusBadge(order.status)}
                </div>
                <div class="order-card-info">
                    <div class="info-item">
                        <strong>Table:</strong> ${order.table_number || 'N/A'}
                    </div>
                    ${order.customer_name ? `
                        <div class="info-item"><strong>Client:</strong> ${order.customer_name}</div>
                    ` : ''}
                    <div class="info-item">
                        <strong>Créée:</strong> ${formatDate(order.createdAt)}
                    </div>
                </div>
                <div class="order-card-footer">
                    <span class="order-amount">${formatAmount(order.total_amount)}</span>
                </div>
            </div>
        `).join('');

    } catch (error) {
        showToast(error.message, 'error');
        container.innerHTML = `<div class="error-message">${error.message}</div>`;
    }
}

function filterOrders(status) {
    mgrState.filters.orderStatus = status;
    document.querySelectorAll('#page-orders .filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.status === status) btn.classList.add('active');
    });
    loadOrders();
}

async function viewOrderDetail(orderId) {
    try {
        const response = await apiCall(`/orders/${orderId}`);
        if (!response) throw new Error('Commande introuvable');

        const order = response.order || response;
        document.getElementById('order-number').textContent = `#${order.id}`;
        document.getElementById('detail-table').textContent = order.table_number || 'N/A';
        document.getElementById('detail-customer').textContent = order.customer_name || 'Client anonyme';
        document.getElementById('detail-status').innerHTML = getStatusBadge(order.status);
        document.getElementById('detail-amount').textContent = formatAmount(order.total_amount);
        document.getElementById('detail-date').textContent = formatDate(order.createdAt);

        const itemsContainer = document.getElementById('detail-items');
        if (order.items && order.items.length > 0) {
            itemsContainer.innerHTML = order.items.map(item => `
                <div class="order-item">
                    <div class="item-info">
                        <div class="item-name">${item.product_name}</div>
                        <div class="item-details">${formatAmount(item.unit_price)} × ${item.quantity}</div>
                    </div>
                    <div class="item-total">${formatAmount(item.unit_price * item.quantity)}</div>
                </div>
            `).join('');
        } else {
            itemsContainer.innerHTML = '<p style="color: var(--text-light);">Pas de détail disponible</p>';
        }

        showPage('order-detail');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ============================================
// MENUS & CATEGORIES
// ============================================

async function loadMenus() {
    const container = document.getElementById('menus-list');
    container.innerHTML = '<div class="loading">Chargement des menus...</div>';

    try {
        const response = await apiCall('/menus');
        if (!response) throw new Error('Erreur chargement menus');

        const menus = response.menus || response;
        mgrState.menus = Array.isArray(menus) ? menus : [];

        if (mgrState.menus.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📖</div>
                    <p>Aucun menu créé</p>
                </div>
            `;
            return;
        }

        container.innerHTML = mgrState.menus.map(menu => `
            <div class="menu-card">
                <div class="menu-card-header">
                    <h3>${menu.name}</h3>
                    <div class="menu-actions">
                        <button class="btn-secondary btn-small" onclick="showMenuForm('${menu.id}')">Modifier</button>
                        <button class="btn-primary btn-small" onclick="showCategoryForm('${menu.id}')">+ Catégorie</button>
                    </div>
                </div>
                ${menu.description ? `<p class="menu-desc">${menu.description}</p>` : ''}
                <div class="categories-list">
                    ${(menu.categories || menu.Categories || []).map(cat => `
                        <div class="category-item">
                            <span class="category-name">${cat.name}</span>
                            <div class="category-actions">
                                <button class="btn-secondary btn-xs" onclick="showCategoryForm('${menu.id}', '${cat.id}')">Modifier</button>
                                <button class="btn-danger btn-xs" onclick="confirmDeleteCategory('${cat.id}')">Supprimer</button>
                            </div>
                        </div>
                    `).join('') || '<p class="empty-hint">Aucune catégorie</p>'}
                </div>
            </div>
        `).join('');

    } catch (error) {
        showToast(error.message, 'error');
        container.innerHTML = `<div class="error-message">${error.message}</div>`;
    }
}

function showMenuForm(menuId = null) {
    const menu = menuId ? mgrState.menus.find(m => m.id === menuId) : null;
    mgrState.editingItem = menu;
    mgrState.formType = 'menu';

    showFormModal(menu ? 'Modifier le menu' : 'Nouveau menu', `
        <div class="form-group">
            <label>Nom du menu *</label>
            <input type="text" id="form-menu-name" value="${menu ? menu.name : ''}" placeholder="Ex: Menu principal">
        </div>
        <div class="form-group">
            <label>Description</label>
            <input type="text" id="form-menu-desc" value="${menu ? (menu.description || '') : ''}" placeholder="Description optionnelle">
        </div>
    `);
}

async function saveMenu() {
    const name = document.getElementById('form-menu-name').value.trim();
    if (!name) { showToast('Le nom est requis', 'error'); return; }

    const data = {
        name,
        description: document.getElementById('form-menu-desc').value.trim()
    };

    try {
        if (mgrState.editingItem) {
            await apiCall(`/menus/${mgrState.editingItem.id}`, {
                method: 'PUT', body: JSON.stringify(data)
            });
            showToast('Menu mis à jour', 'success');
        } else {
            await apiCall('/menus', {
                method: 'POST', body: JSON.stringify(data)
            });
            showToast('Menu créé', 'success');
        }
        closeFormModal();
        loadMenus();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function showCategoryForm(menuId, categoryId = null) {
    const menu = mgrState.menus.find(m => m.id === menuId);
    const category = categoryId && menu ?
        (menu.categories || menu.Categories || []).find(c => c.id === categoryId) : null;

    mgrState.editingItem = category ? { ...category, menuId } : { menuId };
    mgrState.formType = 'category';

    showFormModal(category ? 'Modifier la catégorie' : 'Nouvelle catégorie', `
        <div class="form-group">
            <label>Nom de la catégorie *</label>
            <input type="text" id="form-cat-name" value="${category ? category.name : ''}" placeholder="Ex: Entrées">
        </div>
        <div class="form-group">
            <label>Description</label>
            <input type="text" id="form-cat-desc" value="${category ? (category.description || '') : ''}" placeholder="Description optionnelle">
        </div>
    `);
}

async function saveCategory() {
    const name = document.getElementById('form-cat-name').value.trim();
    if (!name) { showToast('Le nom est requis', 'error'); return; }

    const data = {
        name,
        description: document.getElementById('form-cat-desc').value.trim()
    };

    try {
        if (mgrState.editingItem && mgrState.editingItem.id) {
            await apiCall(`/menus/categories/${mgrState.editingItem.id}`, {
                method: 'PUT', body: JSON.stringify(data)
            });
            showToast('Catégorie mise à jour', 'success');
        } else {
            await apiCall(`/menus/${mgrState.editingItem.menuId}/categories`, {
                method: 'POST', body: JSON.stringify(data)
            });
            showToast('Catégorie créée', 'success');
        }
        closeFormModal();
        loadMenus();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function confirmDeleteCategory(categoryId) {
    showModal('Supprimer la catégorie', 'Êtes-vous sûr ? Les produits associés seront aussi supprimés.', async () => {
        try {
            await apiCall(`/menus/categories/${categoryId}`, { method: 'DELETE' });
            showToast('Catégorie supprimée', 'success');
            loadMenus();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
}

// ============================================
// PRODUCTS
// ============================================

async function loadProducts() {
    const container = document.getElementById('products-list');
    container.innerHTML = '<div class="loading">Chargement des produits...</div>';

    try {
        const products = await apiCall('/products');
        if (!products) throw new Error('Erreur chargement produits');

        mgrState.products = Array.isArray(products) ? products : [];

        if (mgrState.products.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🍽️</div>
                    <p>Aucun produit créé</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="products-table">
                <div class="table-header">
                    <span>Produit</span>
                    <span>Catégorie</span>
                    <span>Prix</span>
                    <span>Stock</span>
                    <span>Actions</span>
                </div>
                ${mgrState.products.map(product => `
                    <div class="table-row">
                        <span class="product-name-col">
                            ${product.image_url ? `<img class="product-thumb" src="${product.image_url}" alt="">` : ''}
                            ${product.name}
                            ${!product.is_available ? '<span class="badge-inactive">Inactif</span>' : ''}
                        </span>
                        <span>${product.category ? product.category.name : '<span class="cell-empty">Sans catégorie</span>'}</span>
                        <span class="price-col">${formatAmount(product.price)}</span>
                        <span class="stock-col ${product.track_stock && product.stock_quantity <= 5 ? 'stock-low' : ''}">
                            ${product.track_stock ? product.stock_quantity : '<span class="cell-empty">Non suivi</span>'}
                        </span>
                        <span class="actions-col">
                            <button class="btn-secondary btn-xs" onclick="showProductForm('${product.id}')">Modifier</button>
                            <button class="btn-secondary btn-xs" onclick="manageOptions('${product.id}', '${escapeHtml(product.name)}')">Options</button>
                            ${product.track_stock ? `<button class="btn-secondary btn-xs" onclick="showStockForm('${product.id}')">Stock</button>` : ''}
                            <button class="btn-danger btn-xs" onclick="confirmDeleteProduct('${product.id}')">Suppr.</button>
                        </span>
                    </div>
                `).join('')}
            </div>
        `;

    } catch (error) {
        showToast(error.message, 'error');
        container.innerHTML = `<div class="error-message">${error.message}</div>`;
    }
}

function showProductForm(productId = null) {
    const product = productId ? mgrState.products.find(p => p.id === productId) : null;
    mgrState.editingItem = product;
    mgrState.formType = 'product';

    // Build category options from menus
    let categoryOptions = '<option value="">-- Sélectionner --</option>';
    mgrState.menus.forEach(menu => {
        (menu.categories || menu.Categories || []).forEach(cat => {
            const selected = product && product.category_id === cat.id ? 'selected' : '';
            categoryOptions += `<option value="${cat.id}" ${selected}>${menu.name} > ${cat.name}</option>`;
        });
    });

    showFormModal(product ? 'Modifier le produit' : 'Nouveau produit', `
        <div class="form-group">
            <label>Photo du produit</label>
            <div class="img-upload">
                <div class="img-preview" id="form-prod-img-preview">
                    ${product && product.image_url ? `<img src="${product.image_url}" alt="">` : '<span>🍽️</span>'}
                </div>
                <label class="img-upload-btn">
                    Choisir une image
                    <input type="file" id="form-prod-img-file" accept="image/*" onchange="previewProductImage(this)" hidden>
                </label>
                <input type="hidden" id="form-prod-img-url" value="${product ? (product.image_url || '') : ''}">
            </div>
        </div>
        <div class="form-group">
            <label>Nom du produit *</label>
            <input type="text" id="form-prod-name" value="${product ? product.name : ''}" placeholder="Ex: Thiéboudienne">
        </div>
        <div class="form-group">
            <label>Description</label>
            <input type="text" id="form-prod-desc" value="${product ? (product.description || '') : ''}" placeholder="Description">
        </div>
        <div class="form-row-2">
            <div class="form-group">
                <label>Prix (FCFA) *</label>
                <input type="number" id="form-prod-price" value="${product ? product.price : ''}" min="0" placeholder="Ex: 3500">
            </div>
            <div class="form-group">
                <label>Catégorie</label>
                <select id="form-prod-category">${categoryOptions}</select>
            </div>
        </div>
        <div class="form-row-2">
            <div class="form-group">
                <label>Suivi stock</label>
                <select id="form-prod-track-stock">
                    <option value="true" ${!product || product.track_stock ? 'selected' : ''}>Oui</option>
                    <option value="false" ${product && !product.track_stock ? 'selected' : ''}>Non</option>
                </select>
            </div>
            <div class="form-group">
                <label>Stock initial</label>
                <input type="number" id="form-prod-stock" value="${product ? product.stock_quantity : 0}" min="0">
            </div>
        </div>
        <div class="form-group">
            <label>Disponible</label>
            <select id="form-prod-available">
                <option value="true" ${!product || product.is_available ? 'selected' : ''}>Oui</option>
                <option value="false" ${product && !product.is_available ? 'selected' : ''}>Non</option>
            </select>
        </div>
    `);

    // Load menus for category selection if not loaded
    if (mgrState.menus.length === 0) {
        apiCall('/menus').then(response => {
            const menus = response.menus || response;
            mgrState.menus = Array.isArray(menus) ? menus : [];
        });
    }
}

// Aperçu local de l'image sélectionnée
function previewProductImage(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('form-prod-img-preview').innerHTML = `<img src="${e.target.result}" alt="">`;
    };
    reader.readAsDataURL(file);
}

// Upload d'un fichier image → renvoie l'URL servie
async function uploadImage(file) {
    const fd = new FormData();
    fd.append('image', file);
    const response = await fetch(`${API_BASE_URL}/uploads/image`, {
        method: 'POST',
        headers: { ...(mgrState.token && { Authorization: `Bearer ${mgrState.token}` }) },
        body: fd
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Échec de l\'upload');
    return data.url;
}

async function saveProduct() {
    const name = document.getElementById('form-prod-name').value.trim();
    const price = document.getElementById('form-prod-price').value;

    if (!name) { showToast('Le nom est requis', 'error'); return; }
    if (!price || parseFloat(price) <= 0) { showToast('Le prix doit être supérieur à 0', 'error'); return; }

    // Image : upload si un nouveau fichier est sélectionné, sinon URL existante
    let imageUrl = document.getElementById('form-prod-img-url').value || null;
    const fileInput = document.getElementById('form-prod-img-file');
    if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
            imageUrl = await uploadImage(fileInput.files[0]);
        } catch (e) {
            showToast('Image : ' + e.message, 'error');
            return;
        }
    }

    const data = {
        name,
        description: document.getElementById('form-prod-desc').value.trim(),
        price: parseFloat(price),
        category_id: document.getElementById('form-prod-category').value || null,
        track_stock: document.getElementById('form-prod-track-stock').value === 'true',
        stock_quantity: parseInt(document.getElementById('form-prod-stock').value) || 0,
        is_available: document.getElementById('form-prod-available').value === 'true',
        image_url: imageUrl
    };

    try {
        if (mgrState.editingItem) {
            await apiCall(`/products/${mgrState.editingItem.id}`, {
                method: 'PUT', body: JSON.stringify(data)
            });
            showToast('Produit mis à jour', 'success');
        } else {
            await apiCall('/products', {
                method: 'POST', body: JSON.stringify(data)
            });
            showToast('Produit créé', 'success');
        }
        closeFormModal();
        loadProducts();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function showStockForm(productId) {
    const product = mgrState.products.find(p => p.id === productId);
    if (!product) return;

    mgrState.editingItem = product;
    mgrState.formType = 'stock';

    showFormModal(`Stock: ${product.name}`, `
        <p style="margin-bottom: 1rem; color: var(--text-light);">Stock actuel: <strong>${product.stock_quantity}</strong></p>
        <div class="form-row-2">
            <div class="form-group">
                <label>Opération</label>
                <select id="form-stock-operation">
                    <option value="add">Ajouter</option>
                    <option value="subtract">Retirer</option>
                </select>
            </div>
            <div class="form-group">
                <label>Quantité</label>
                <input type="number" id="form-stock-qty" min="1" value="1">
            </div>
        </div>
    `);
}

async function saveStock() {
    const quantity = parseInt(document.getElementById('form-stock-qty').value);
    const operation = document.getElementById('form-stock-operation').value;

    if (!quantity || quantity <= 0) { showToast('Quantité invalide', 'error'); return; }

    try {
        await apiCall(`/products/${mgrState.editingItem.id}/stock`, {
            method: 'PATCH',
            body: JSON.stringify({ quantity, operation })
        });
        showToast('Stock mis à jour', 'success');
        closeFormModal();
        loadProducts();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function confirmDeleteProduct(productId) {
    showModal('Supprimer le produit', 'Êtes-vous sûr de vouloir supprimer ce produit ?', async () => {
        try {
            await apiCall(`/products/${productId}`, { method: 'DELETE' });
            showToast('Produit supprimé', 'success');
            loadProducts();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
}

// ============================================
// USERS
// ============================================

async function loadUsers() {
    const container = document.getElementById('users-list');
    container.innerHTML = '<div class="loading">Chargement des utilisateurs...</div>';

    try {
        const users = await apiCall('/restaurants/users');
        if (!users) throw new Error('Erreur chargement utilisateurs');

        mgrState.users = Array.isArray(users) ? users : [];

        if (mgrState.users.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <p>Aucun utilisateur</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="users-grid">
                ${mgrState.users.map(user => `
                    <div class="user-card">
                        <div class="user-card-header">
                            <div class="user-avatar">${(user.first_name || user.firstName || '?')[0].toUpperCase()}</div>
                            <div class="user-info">
                                <div class="user-fullname">${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}</div>
                                <div class="user-email">${user.email}</div>
                            </div>
                        </div>
                        <div class="user-card-body">
                            ${getRoleBadge(user.role)}
                            <span class="user-status ${user.status === 'active' ? 'status-active' : 'status-inactive'}">
                                ${user.status === 'active' ? 'Actif' : 'Inactif'}
                            </span>
                        </div>
                        <div class="user-card-actions">
                            <button class="btn-secondary btn-xs" onclick="showUserForm('${user.id}')">Modifier</button>
                            ${mgrState.isOwner && user.role !== 'owner' ? `
                                <button class="btn-danger btn-xs" onclick="confirmDeleteUser('${user.id}')">Supprimer</button>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

    } catch (error) {
        showToast(error.message, 'error');
        container.innerHTML = `<div class="error-message">${error.message}</div>`;
    }
}

function showUserForm(userId = null) {
    const user = userId ? mgrState.users.find(u => u.id === userId) : null;
    mgrState.editingItem = user;
    mgrState.formType = 'user';

    const firstName = user ? (user.first_name || user.firstName || '') : '';
    const lastName = user ? (user.last_name || user.lastName || '') : '';

    showFormModal(user ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur', `
        <div class="form-row-2">
            <div class="form-group">
                <label>Prénom *</label>
                <input type="text" id="form-user-fname" value="${firstName}" placeholder="Prénom">
            </div>
            <div class="form-group">
                <label>Nom *</label>
                <input type="text" id="form-user-lname" value="${lastName}" placeholder="Nom">
            </div>
        </div>
        <div class="form-group">
            <label>Email *</label>
            <input type="email" id="form-user-email" value="${user ? user.email : ''}" placeholder="email@exemple.com">
        </div>
        <div class="form-group">
            <label>Téléphone</label>
            <input type="tel" id="form-user-phone" value="${user ? (user.phone || '') : ''}" placeholder="77 123 45 67">
        </div>
        <div class="form-group">
            <label>Rôle *</label>
            <select id="form-user-role">
                <option value="waiter" ${user && user.role === 'waiter' ? 'selected' : ''}>Serveur</option>
                <option value="cashier" ${user && user.role === 'cashier' ? 'selected' : ''}>Caissier</option>
                <option value="manager" ${user && user.role === 'manager' ? 'selected' : ''}>Manager</option>
            </select>
        </div>
        ${!user ? `
            <div class="form-group">
                <label>Mot de passe *</label>
                <input type="password" id="form-user-password" placeholder="Minimum 6 caractères">
            </div>
        ` : ''}
        ${user ? `
            <div class="form-group">
                <label>Statut</label>
                <select id="form-user-status">
                    <option value="active" ${user.status === 'active' ? 'selected' : ''}>Actif</option>
                    <option value="inactive" ${user.status !== 'active' ? 'selected' : ''}>Inactif</option>
                </select>
            </div>
        ` : ''}
    `);
}

async function saveUser() {
    const firstName = document.getElementById('form-user-fname').value.trim();
    const lastName = document.getElementById('form-user-lname').value.trim();
    const email = document.getElementById('form-user-email').value.trim();

    if (!firstName || !lastName) { showToast('Prénom et nom requis', 'error'); return; }
    if (!email) { showToast('Email requis', 'error'); return; }

    const data = {
        first_name: firstName,
        last_name: lastName,
        email,
        phone: document.getElementById('form-user-phone').value.trim(),
        role: document.getElementById('form-user-role').value
    };

    try {
        if (mgrState.editingItem) {
            const statusEl = document.getElementById('form-user-status');
            if (statusEl) data.status = statusEl.value;

            await apiCall(`/restaurants/users/${mgrState.editingItem.id}`, {
                method: 'PUT', body: JSON.stringify(data)
            });
            showToast('Utilisateur mis à jour', 'success');
        } else {
            const password = document.getElementById('form-user-password').value;
            if (!password || password.length < 6) {
                showToast('Le mot de passe doit contenir au moins 6 caractères', 'error');
                return;
            }
            data.password = password;

            await apiCall('/restaurants/users', {
                method: 'POST', body: JSON.stringify(data)
            });
            showToast('Utilisateur créé', 'success');
        }
        closeFormModal();
        loadUsers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function confirmDeleteUser(userId) {
    showModal('Supprimer l\'utilisateur', 'Êtes-vous sûr ? Cette action est irréversible.', async () => {
        try {
            await apiCall(`/restaurants/users/${userId}`, { method: 'DELETE' });
            showToast('Utilisateur supprimé', 'success');
            loadUsers();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
}

// ============================================
// CODES PROMO (VOUCHERS)
// ============================================

async function loadVouchers() {
    const container = document.getElementById('vouchers-list');
    container.innerHTML = '<div class="loading">Chargement des codes promo...</div>';

    try {
        const vouchers = await apiCall('/vouchers');
        mgrState.vouchers = Array.isArray(vouchers) ? vouchers : [];

        if (mgrState.vouchers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎟️</div>
                    <p>Aucun code promo créé</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="products-table vouchers-table">
                <div class="table-header">
                    <span>Code</span>
                    <span>Réduction</span>
                    <span>Min. / Limite</span>
                    <span>Utilisé</span>
                    <span>Statut</span>
                    <span>Actions</span>
                </div>
                ${mgrState.vouchers.map(v => {
                    const value = v.discount_type === 'percentage'
                        ? `${Math.round(v.discount_value)}%${v.max_discount ? ` (max ${formatAmount(v.max_discount)})` : ''}`
                        : formatAmount(v.discount_value);
                    const expired = v.expires_at && new Date(v.expires_at) < new Date();
                    const min = Number(v.min_order_amount) > 0 ? formatAmount(v.min_order_amount) : '—';
                    const uses = v.max_uses ? `${v.used_count}/${v.max_uses}` : `${v.used_count}`;
                    const statusLabel = !v.active ? 'Inactif' : (expired ? 'Expiré' : 'Actif');
                    const statusCls = !v.active || expired ? 'badge-inactive' : 'badge-active';
                    return `
                    <div class="table-row">
                        <span class="product-name-col"><strong>${escapeHtml(v.code)}</strong>${v.points_cost > 0 ? ` <span class="badge-active">🎁 ${v.points_cost} pts</span>` : ''}${v.description ? `<br><small style="color:var(--text-light)">${escapeHtml(v.description)}</small>` : ''}</span>
                        <span>${value}</span>
                        <span>min ${min}${v.max_uses ? ` · max ${v.max_uses}` : ''}</span>
                        <span>${uses}</span>
                        <span><span class="${statusCls}">${statusLabel}</span></span>
                        <span class="actions-col">
                            <button class="btn-secondary btn-xs" onclick="toggleVoucher('${v.id}', ${!v.active})">${v.active ? 'Désactiver' : 'Activer'}</button>
                        </span>
                    </div>`;
                }).join('')}
            </div>`;
    } catch (error) {
        showToast(error.message, 'error');
        container.innerHTML = `<div class="error-message">${error.message}</div>`;
    }
}

function showVoucherForm() {
    mgrState.editingItem = null;
    mgrState.formType = 'voucher';

    showFormModal('Nouveau code promo', `
        <div class="form-group">
            <label>Code *</label>
            <input type="text" id="form-voucher-code" placeholder="Ex: BIZON10" style="text-transform:uppercase">
        </div>
        <div class="form-group">
            <label>Description</label>
            <input type="text" id="form-voucher-desc" placeholder="Ex: 10% sur la commande">
        </div>
        <div class="form-row-2">
            <div class="form-group">
                <label>Type *</label>
                <select id="form-voucher-type" onchange="onVoucherTypeChange()">
                    <option value="percentage">Pourcentage (%)</option>
                    <option value="fixed">Montant fixe (FCFA)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Valeur *</label>
                <input type="number" id="form-voucher-value" min="0" placeholder="Ex: 10">
            </div>
        </div>
        <div class="form-row-2">
            <div class="form-group">
                <label>Réduction max (FCFA)</label>
                <input type="number" id="form-voucher-maxdiscount" min="0" placeholder="Optionnel (%)">
            </div>
            <div class="form-group">
                <label>Commande minimum (FCFA)</label>
                <input type="number" id="form-voucher-minorder" min="0" value="0">
            </div>
        </div>
        <div class="form-row-2">
            <div class="form-group">
                <label>Nb d'utilisations max</label>
                <input type="number" id="form-voucher-maxuses" min="1" placeholder="Illimité si vide">
            </div>
            <div class="form-group">
                <label>Date d'expiration</label>
                <input type="date" id="form-voucher-expires">
            </div>
        </div>
        <div class="form-group">
            <label>Coût en points (0 = code promo public · > 0 = récompense échangeable)</label>
            <input type="number" id="form-voucher-points" min="0" value="0">
        </div>
    `);
}

function onVoucherTypeChange() {
    const type = document.getElementById('form-voucher-type').value;
    const maxEl = document.getElementById('form-voucher-maxdiscount');
    // Le plafond ne s'applique qu'aux pourcentages
    maxEl.disabled = type === 'fixed';
    if (type === 'fixed') maxEl.value = '';
}

async function saveVoucher() {
    const code = document.getElementById('form-voucher-code').value.trim();
    const value = document.getElementById('form-voucher-value').value;
    if (!code) { showToast('Le code est requis', 'error'); return; }
    if (value === '' || parseFloat(value) < 0) { showToast('Valeur de réduction invalide', 'error'); return; }

    const type = document.getElementById('form-voucher-type').value;
    if (type === 'percentage' && parseFloat(value) > 100) {
        showToast('Un pourcentage ne peut dépasser 100', 'error'); return;
    }

    const maxDiscount = document.getElementById('form-voucher-maxdiscount').value;
    const maxUses = document.getElementById('form-voucher-maxuses').value;
    const expires = document.getElementById('form-voucher-expires').value;

    const data = {
        code,
        description: document.getElementById('form-voucher-desc').value.trim() || null,
        discount_type: type,
        discount_value: parseFloat(value),
        min_order_amount: parseFloat(document.getElementById('form-voucher-minorder').value) || 0,
        max_discount: type === 'percentage' && maxDiscount ? parseFloat(maxDiscount) : null,
        max_uses: maxUses ? parseInt(maxUses) : null,
        expires_at: expires || null,
        points_cost: parseInt(document.getElementById('form-voucher-points').value) || 0
    };

    try {
        await apiCall('/vouchers', { method: 'POST', body: JSON.stringify(data) });
        showToast('Code promo créé', 'success');
        closeFormModal();
        loadVouchers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function toggleVoucher(id, active) {
    try {
        await apiCall(`/vouchers/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) });
        showToast(active ? 'Code activé' : 'Code désactivé', 'success');
        loadVouchers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    if (!checkManagerAuth()) return;

    // Load dashboard by default
    loadDashboard();

    // Pre-load menus for product form categories
    apiCall('/menus').then(response => {
        if (response) {
            const menus = response.menus || response;
            mgrState.menus = Array.isArray(menus) ? menus : [];
        }
    }).catch(() => {});

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('bizon_token');
        localStorage.removeItem('bizon_restaurant_id');
        window.location.href = '../staff/login.html';
    });

    // Order filters
    document.querySelectorAll('#page-orders .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => filterOrders(btn.dataset.status));
    });

    // Auto-refresh dashboard 30s
    setInterval(() => {
        const activePage = document.querySelector('.page.active');
        if (activePage && activePage.id === 'page-dashboard') {
            loadDashboard();
        }
    }, 30000);
});

// ============================================
// CLIENTS (gestion par le manager)
// ============================================
let customersSearchTimer = null;
let customersSegment = '';

function fmtFcfa(n) { return `${Number(n || 0).toLocaleString('fr-FR')} FCFA`; }

function setCustomerSegment(seg) {
  customersSegment = seg;
  document.querySelectorAll('#customers-segments .filter-btn').forEach((b) => {
    b.classList.toggle('active', (b.dataset.seg || '') === seg);
  });
  loadCustomers(document.getElementById('customers-search').value);
}

async function loadCustomers(q) {
  const list = document.getElementById('customers-list');
  const statsEl = document.getElementById('customers-stats');
  if (!q) list.innerHTML = '<div class="loading">Chargement des clients...</div>';
  try {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (customersSegment) params.set('segment', customersSegment);
    const qs = params.toString();
    const data = await apiCall(`/restaurants/customers${qs ? `?${qs}` : ''}`);
    if (!data) return;
    mgrState.customers = data.customers || [];
    if (statsEl && data.stats) {
      statsEl.innerHTML = `
        <div class="cstat"><span class="cstat-v">${data.stats.total}</span><span class="cstat-k">Clients</span></div>
        <div class="cstat"><span class="cstat-v">${data.stats.new_this_week}</span><span class="cstat-k">Nouveaux (7j)</span></div>
        <div class="cstat"><span class="cstat-v">${data.stats.blocked}</span><span class="cstat-k">Bloqués</span></div>`;
    }
    renderCustomersList(mgrState.customers);
  } catch (e) {
    list.innerHTML = `<div class="empty-state"><p>Erreur de chargement</p></div>`;
  }
}

function searchCustomers(q) {
  clearTimeout(customersSearchTimer);
  customersSearchTimer = setTimeout(() => loadCustomers(q), 300);
}

function renderCustomersList(customers) {
  const list = document.getElementById('customers-list');
  if (!customers.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👤</div><p>Aucun client</p></div>`;
    return;
  }
  list.innerHTML = `
    <table class="cust-table">
      <thead><tr>
        <th>Client</th><th>Téléphone</th><th>Commandes</th><th>Total</th>
        <th>Points</th><th>Dernière visite</th><th>Statut</th><th></th>
      </tr></thead>
      <tbody>
        ${customers.map(c => `
          <tr class="${c.status === 'blocked' ? 'cust-blocked' : ''}">
            <td data-label="Client">
              <strong>${escapeHtml(c.first_name)} ${escapeHtml(c.last_name)}</strong>
              ${c.email ? `<br><small style="color:var(--text-light)">${escapeHtml(c.email)}</small>` : ''}
            </td>
            <td data-label="Téléphone">${escapeHtml(c.phone || '—')}</td>
            <td data-label="Commandes">${c.orders_count}</td>
            <td data-label="Total">${fmtFcfa(c.total_spent)}</td>
            <td data-label="Points">${c.loyalty_points || 0}</td>
            <td data-label="Dernière visite">${c.last_order_at ? formatDate(c.last_order_at) : '—'}</td>
            <td data-label="Statut"><span class="user-status ${c.status === 'active' ? 'status-active' : 'status-inactive'}">${c.status === 'active' ? 'Actif' : 'Bloqué'}</span></td>
            <td class="cust-actions">
              <button class="btn-secondary btn-xs" onclick="viewCustomerDetail('${c.id}')">Détail</button>
              <button class="btn-secondary btn-xs" onclick="resetCustomerPwd('${c.id}')">Reset MDP</button>
              <button class="btn-secondary btn-xs" onclick="toggleCustomerBlock('${c.id}','${c.status}')">${c.status === 'active' ? 'Bloquer' : 'Réactiver'}</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

async function viewCustomerDetail(id) {
  try {
    const data = await apiCall(`/restaurants/customers/${id}`);
    if (!data) return;
    const c = data.customer;
    const orders = data.orders || [];
    const ordersHtml = orders.length ? orders.map(o => `
      <div class="cust-order-row">
        <span>${escapeHtml(o.order_number || o.id)}</span>
        <span>${formatDate(o.createdAt || o.created_at)}</span>
        <span class="oh-status">${escapeHtml(o.status)}</span>
        <span>${fmtFcfa(o.total_amount)}</span>
      </div>`).join('') : '<p style="color:var(--text-light)">Aucune commande</p>';
    showFormModal(`${escapeHtml(c.first_name)} ${escapeHtml(c.last_name)}`, `
      <div class="cust-detail">
        <p><strong>Téléphone :</strong> ${escapeHtml(c.phone || '—')}</p>
        <p><strong>Email :</strong> ${escapeHtml(c.email || '—')}</p>
        <p><strong>Adresse :</strong> ${escapeHtml(c.address || '—')}</p>
        <p><strong>Statut :</strong> ${c.status === 'active' ? 'Actif' : 'Bloqué'}</p>

        <div class="loyalty-box">
          <div class="loyalty-balance">Points fidélité : <strong id="loy-balance">${c.loyalty_points || 0}</strong></div>
          <div class="loyalty-adjust">
            <input type="number" id="loy-points" placeholder="+50 ou -20" step="1">
            <input type="text" id="loy-reason" placeholder="Motif (facultatif)">
            <button class="btn-primary btn-xs" onclick="adjustLoyalty('${c.id}')">Appliquer</button>
          </div>
        </div>

        <h4 style="margin:1rem 0 .5rem">Dernières commandes</h4>
        ${ordersHtml}
      </div>`);
  } catch (e) { showToast(e.message, 'error'); }
}

async function resetCustomerPwd(id) {
  showModal('Réinitialiser le mot de passe', 'Générer un nouveau mot de passe temporaire pour ce client ?', async () => {
    try {
      const r = await apiCall(`/restaurants/customers/${id}/reset-password`, { method: 'POST' });
      if (!r) return;
      showFormModal('Mot de passe temporaire', `
        <p>Communiquez ce mot de passe au client :</p>
        <div class="temp-pass">${escapeHtml(r.tempPassword)}</div>
        <p style="color:var(--text-light);font-size:.85rem">Il pourra le changer depuis son profil après connexion.</p>`);
    } catch (e) { showToast(e.message, 'error'); }
  });
}

async function toggleCustomerBlock(id, status) {
  const next = status === 'active' ? 'blocked' : 'active';
  try {
    const r = await apiCall(`/restaurants/customers/${id}/status`, {
      method: 'PATCH', body: JSON.stringify({ status: next })
    });
    if (!r) return;
    showToast(next === 'blocked' ? 'Client bloqué' : 'Client réactivé', 'success');
    loadCustomers(document.getElementById('customers-search').value);
  } catch (e) { showToast(e.message, 'error'); }
}

async function adjustLoyalty(id) {
  const pts = parseInt(document.getElementById('loy-points').value, 10);
  const reason = document.getElementById('loy-reason').value.trim();
  if (!Number.isInteger(pts) || pts === 0) { showToast('Entrez un nombre de points (+/-)', 'error'); return; }
  try {
    const r = await apiCall(`/restaurants/customers/${id}/loyalty`, {
      method: 'POST', body: JSON.stringify({ points: pts, reason })
    });
    if (!r) return;
    document.getElementById('loy-balance').textContent = r.balance;
    document.getElementById('loy-points').value = '';
    document.getElementById('loy-reason').value = '';
    showToast(`Points mis à jour (${r.applied >= 0 ? '+' : ''}${r.applied})`, 'success');
    loadCustomers(document.getElementById('customers-search').value);
  } catch (e) { showToast(e.message, 'error'); }
}

async function exportCustomersCsv() {
  try {
    const params = new URLSearchParams();
    const q = document.getElementById('customers-search')?.value;
    if (q) params.set('q', q);
    if (customersSegment) params.set('segment', customersSegment);
    const qs = params.toString();
    const res = await fetch(`${API_BASE_URL}/restaurants/customers/export${qs ? `?${qs}` : ''}`, {
      headers: { ...(mgrState.token && { Authorization: `Bearer ${mgrState.token}` }) }
    });
    if (!res.ok) { showToast('Export impossible', 'error'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients-bizon-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast('Export téléchargé', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

// ============================================
// RÉGLAGES LIVRAISON
// ============================================
async function loadDeliverySettings() {
    try {
        const resto = await apiCall('/restaurants');
        if (!resto) return;
        const s = resto.settings || {};
        const feeEl = document.getElementById('set-delivery-fee');
        const minEl = document.getElementById('set-min-order');
        if (feeEl) feeEl.value = s.delivery_fee || 0;
        if (minEl) minEl.value = s.min_delivery_order || 0;
    } catch (e) { /* silencieux */ }
}

async function saveDeliverySettings() {
    const fee = parseInt(document.getElementById('set-delivery-fee').value, 10) || 0;
    const min = parseInt(document.getElementById('set-min-order').value, 10) || 0;
    try {
        const r = await apiCall('/restaurants', {
            method: 'PUT',
            body: JSON.stringify({ settings: { delivery_fee: fee, min_delivery_order: min } })
        });
        if (!r) return;
        showToast('Réglages livraison enregistrés', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

// ============================================
// OPTIONS / VARIANTES PRODUIT
// ============================================
async function manageOptions(productId, productName) {
    try {
        const groups = await apiCall(`/products/${productId}/option-groups`);
        renderOptionsModal(productId, productName, groups || []);
    } catch (e) { showToast(e.message, 'error'); }
}

function renderOptionsModal(productId, productName, groups) {
    const groupsHtml = groups.length ? groups.map(g => `
        <div class="opt-mgr-group">
            <div class="opt-mgr-group-head">
                <strong>${escapeHtml(g.name)}</strong>
                <span class="opt-mgr-tag">${g.type === 'single' ? 'Choix unique' : 'Choix multiple'}${g.required ? ' · obligatoire' : ''}</span>
                <button class="btn-danger btn-xs" onclick="deleteOptionGroupMgr('${productId}','${productName.replace(/'/g, "")}','${g.id}')">Suppr.</button>
            </div>
            <div class="opt-mgr-items">
                ${(g.options || []).map(o => `
                    <div class="opt-mgr-item">
                        <span>${escapeHtml(o.name)}${Number(o.price_delta) ? ` (+${Number(o.price_delta).toLocaleString('fr-FR')} FCFA)` : ''}</span>
                        <button class="btn-danger btn-xs" onclick="deleteOptionItem('${productId}','${productName.replace(/'/g, "")}','${o.id}')">×</button>
                    </div>`).join('') || '<span style="color:var(--text-light);font-size:.85rem">Aucune option</span>'}
            </div>
            <div class="opt-mgr-addrow">
                <input type="text" id="opt-name-${g.id}" placeholder="Nom (ex. Grande)">
                <input type="number" id="opt-delta-${g.id}" placeholder="+ prix" step="50" style="width:90px">
                <button class="btn-secondary btn-xs" onclick="addOptionItem('${productId}','${productName.replace(/'/g, "")}','${g.id}')">+ Option</button>
            </div>
        </div>`).join('') : '<p style="color:var(--text-light)">Aucun groupe d\'options.</p>';

    showFormModal(`Options — ${productName}`, `
        <div class="opt-mgr">
            ${groupsHtml}
            <div class="opt-mgr-newgroup">
                <h4>Nouveau groupe</h4>
                <input type="text" id="newgrp-name" placeholder="Nom du groupe (ex. Taille)">
                <select id="newgrp-type">
                    <option value="single">Choix unique</option>
                    <option value="multiple">Choix multiple</option>
                </select>
                <label class="opt-mgr-check"><input type="checkbox" id="newgrp-required"> Obligatoire</label>
                <button class="btn-primary btn-xs" onclick="addOptionGroup('${productId}','${productName.replace(/'/g, "")}')">+ Groupe</button>
            </div>
        </div>`);
}

async function addOptionGroup(productId, productName) {
    const name = document.getElementById('newgrp-name').value.trim();
    if (!name) { showToast('Nom du groupe requis', 'error'); return; }
    try {
        await apiCall(`/products/${productId}/option-groups`, {
            method: 'POST',
            body: JSON.stringify({
                name,
                type: document.getElementById('newgrp-type').value,
                required: document.getElementById('newgrp-required').checked
            })
        });
        manageOptions(productId, productName);
    } catch (e) { showToast(e.message, 'error'); }
}

async function deleteOptionGroupMgr(productId, productName, groupId) {
    try {
        await apiCall(`/products/option-groups/${groupId}`, { method: 'DELETE' });
        manageOptions(productId, productName);
    } catch (e) { showToast(e.message, 'error'); }
}

async function addOptionItem(productId, productName, groupId) {
    const name = document.getElementById(`opt-name-${groupId}`).value.trim();
    if (!name) { showToast('Nom de l\'option requis', 'error'); return; }
    const delta = parseInt(document.getElementById(`opt-delta-${groupId}`).value, 10) || 0;
    try {
        await apiCall(`/products/option-groups/${groupId}/options`, {
            method: 'POST', body: JSON.stringify({ name, price_delta: delta })
        });
        manageOptions(productId, productName);
    } catch (e) { showToast(e.message, 'error'); }
}

async function deleteOptionItem(productId, productName, optionId) {
    try {
        await apiCall(`/products/product-options/${optionId}`, { method: 'DELETE' });
        manageOptions(productId, productName);
    } catch (e) { showToast(e.message, 'error'); }
}

// ============================================
// COMPTE D'ENCAISSEMENT (CAMPAY) PAR RESTAURANT
// ============================================
async function loadPaymentConfig() {
    try {
        const cfg = await apiCall('/restaurants/payment-config');
        if (!cfg) return;
        const status = document.getElementById('pay-status');
        const envSel = document.getElementById('pay-env');
        const userInput = document.getElementById('pay-username');
        if (envSel && cfg.env) envSel.value = cfg.env;
        if (userInput && cfg.configured) userInput.value = cfg.username_masked || '';
        if (status) {
            status.textContent = cfg.configured
                ? `✓ Configuré (${cfg.env === 'prod' ? 'production' : 'démo'})`
                : '⚠ Non configuré — les paiements iront sur le compte global';
            status.className = 'pay-status ' + (cfg.configured ? 'ok' : 'warn');
        }
    } catch (e) { /* silencieux */ }
}

async function savePaymentConfig() {
    const username = document.getElementById('pay-username').value.trim();
    const password = document.getElementById('pay-password').value;
    const webhook_key = document.getElementById('pay-webhook').value;
    const env = document.getElementById('pay-env').value;
    if (!username || username.includes('••')) {
        showToast('Saisis l\'identifiant Campay du restaurant', 'error');
        return;
    }
    try {
        const r = await apiCall('/restaurants/payment-config', {
            method: 'PUT',
            body: JSON.stringify({ username, password, webhook_key, env })
        });
        if (!r) return;
        document.getElementById('pay-password').value = '';
        document.getElementById('pay-webhook').value = '';
        showToast('Compte d\'encaissement enregistré', 'success');
        loadPaymentConfig();
    } catch (e) { showToast(e.message, 'error'); }
}

// ============================================
// COMPTABILITÉ
// ============================================
const acctState = { from: null, to: null };

function ymd(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function setAcctRange(days) {
    const to = new Date();
    const from = new Date(); from.setDate(from.getDate() - (days - 1));
    acctState.from = ymd(from); acctState.to = ymd(to);
    document.querySelectorAll('#acct-ranges .filter-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.range) === days));
    document.getElementById('acct-from').value = acctState.from;
    document.getElementById('acct-to').value = acctState.to;
    loadAccounting();
}

function applyAcctDates() {
    const from = document.getElementById('acct-from').value;
    const to = document.getElementById('acct-to').value;
    if (!from || !to) { showToast('Choisis une période', 'error'); return; }
    acctState.from = from; acctState.to = to;
    document.querySelectorAll('#acct-ranges .filter-btn').forEach(b => b.classList.remove('active'));
    loadAccounting();
}

async function loadAccounting() {
    // Période par défaut : 30 jours
    if (!acctState.from) {
        const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 29);
        acctState.from = ymd(from); acctState.to = ymd(to);
        document.getElementById('acct-from').value = acctState.from;
        document.getElementById('acct-to').value = acctState.to;
    }
    const qs = `?from=${acctState.from}&to=${acctState.to}`;
    try {
        const rep = await apiCall('/payments/accounting' + qs);
        if (!rep) return;
        renderAcctKpis(rep);
        renderAcctDaily(rep);
        renderAcctMethods(rep);
    } catch (e) { showToast(e.message, 'error'); }

    // Vue consolidée (owner uniquement)
    if (mgrState.isOwner) {
        try {
            const cons = await apiCall('/payments/accounting/consolidated' + qs);
            if (cons) renderAcctConsolidated(cons);
        } catch (e) { /* manager : 403 ignoré */ }
    }
}

function renderAcctKpis(rep) {
    const cards = [
        { icon: '💰', value: formatAmount(rep.total), label: 'Encaissé' },
        { icon: '✅', value: formatAmount(rep.net), label: 'Net (après remboursements)' },
        { icon: '↩️', value: formatAmount(rep.refunds_total), label: `Remboursements (${rep.refunds_count})` },
        { icon: '🧾', value: rep.count, label: 'Paiements' }
    ];
    document.getElementById('acct-kpis').innerHTML = cards.map(c => `
        <div class="stat-card">
            <div class="stat-icon">${c.icon}</div>
            <div class="stat-info">
                <div class="stat-value">${c.value}</div>
                <div class="stat-label">${c.label}</div>
            </div>
        </div>`).join('');
}

function renderAcctDaily(rep) {
    const el = document.getElementById('acct-daily');
    if (!rep.daily.length) { el.innerHTML = '<p class="acct-empty">Aucun encaissement sur la période.</p>'; return; }
    const max = Math.max(1, ...rep.daily.map(d => d.total));
    el.innerHTML = rep.daily.map(d => {
        const h = Math.max(2, Math.round((d.total / max) * 100));
        const label = new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        return `<div class="bar-col">
            <div class="bar-wrap"><div class="bar" style="height:${h}%" title="${formatAmount(d.total)}"></div></div>
            <span class="bar-label">${label}</span>
        </div>`;
    }).join('');
}

function renderAcctMethods(rep) {
    const labels = { mobile_money: 'Mobile Money', cash: 'Espèces', card: 'Carte' };
    const el = document.getElementById('acct-methods');
    if (!rep.by_method.length) { el.innerHTML = '<p class="acct-empty">—</p>'; return; }
    el.innerHTML = rep.by_method.map(m => `
        <div class="acct-method-row">
            <span>${labels[m.method] || m.method} <small>(${m.count})</small></span>
            <strong>${formatAmount(m.total)}</strong>
        </div>`).join('');
}

function renderAcctConsolidated(cons) {
    document.getElementById('acct-consolidated-section').style.display = '';
    const rows = cons.restaurants.map(r => `
        <div class="table-row">
            <span class="product-name-col">${escapeHtml(r.name)}</span>
            <span>${r.count}</span>
            <span>${formatAmount(r.refunds_total)}</span>
            <span class="price-col">${formatAmount(r.net)}</span>
        </div>`).join('');
    document.getElementById('acct-consolidated').innerHTML = `
        <div class="products-table">
            <div class="table-header acct-cons-row">
                <span>Restaurant</span><span>Paiements</span><span>Remb.</span><span>Net</span>
            </div>
            ${rows}
            <div class="table-row acct-cons-total">
                <span class="product-name-col">Total groupe</span>
                <span>${cons.count}</span>
                <span>${formatAmount(cons.refunds_total)}</span>
                <span class="price-col">${formatAmount(cons.net)}</span>
            </div>
        </div>`;
}
