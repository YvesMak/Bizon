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
    }
}

// ============================================
// DASHBOARD
// ============================================

async function loadDashboard() {
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
    } catch (error) {
        showToast('Erreur chargement statistiques: ' + error.message, 'error');
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
                            ${product.name}
                            ${!product.is_available ? '<span class="badge-inactive">Inactif</span>' : ''}
                        </span>
                        <span>${product.Category ? product.Category.name : '-'}</span>
                        <span class="price-col">${formatAmount(product.price)}</span>
                        <span class="stock-col ${product.track_stock && product.stock_quantity <= 5 ? 'stock-low' : ''}">
                            ${product.track_stock ? product.stock_quantity : 'N/A'}
                        </span>
                        <span class="actions-col">
                            <button class="btn-secondary btn-xs" onclick="showProductForm('${product.id}')">Modifier</button>
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

async function saveProduct() {
    const name = document.getElementById('form-prod-name').value.trim();
    const price = document.getElementById('form-prod-price').value;

    if (!name) { showToast('Le nom est requis', 'error'); return; }
    if (!price || parseFloat(price) <= 0) { showToast('Le prix doit être supérieur à 0', 'error'); return; }

    const data = {
        name,
        description: document.getElementById('form-prod-desc').value.trim(),
        price: parseFloat(price),
        category_id: document.getElementById('form-prod-category').value || null,
        track_stock: document.getElementById('form-prod-track-stock').value === 'true',
        stock_quantity: parseInt(document.getElementById('form-prod-stock').value) || 0,
        is_available: document.getElementById('form-prod-available').value === 'true'
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
