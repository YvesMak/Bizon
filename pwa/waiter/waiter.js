// ============================================
// BIZON PWA - WAITER MODULE
// Espace serveur pour gestion des commandes
// ============================================

const API_BASE_URL = '/api';

// ============================================
// STATE MANAGEMENT
// ============================================
const waiterState = {
    user: null,
    token: localStorage.getItem('bizon_token') || null,
    restaurantId: localStorage.getItem('bizon_restaurant_id') || null,
    orders: [],
    products: [],
    categories: [],
    currentOrder: {
        tableNumber: null,
        customerName: '',
        items: []
    },
    filters: {
        status: 'all'
    },
    currentOrderDetail: null
};

// ============================================
// AUTH & ROLE CHECK
// ============================================

/**
 * Vérifie que l'utilisateur est authentifié et a le rôle 'waiter'
 * Redirige vers login si non authentifié
 */
function checkWaiterAuth() {
    if (!waiterState.token) {
        window.location.href = '../staff/login.html';
        return false;
    }

    // Décoder le JWT pour vérifier le rôle
    try {
        const payload = JSON.parse(atob(waiterState.token.split('.')[1]));
        waiterState.user = payload;

        if (payload.role !== 'waiter') {
            showToast('Accès refusé : rôle serveur requis', 'error');
            setTimeout(() => window.location.href = '../staff/login.html', 2000);
            return false;
        }

        // Afficher le nom de l'utilisateur
        document.getElementById('user-name').textContent = 
            `${payload.firstName || ''} ${payload.lastName || ''}`.trim();

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

/**
 * Appel API générique avec gestion d'erreurs
 */
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(waiterState.token && { 'Authorization': `Bearer ${waiterState.token}` })
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: { ...headers, ...options.headers }
        });

        const data = await response.json();

        if (!response.ok) {
            // Gestion erreurs spécifiques
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

/**
 * Récupère les commandes du serveur
 * Filtre par statuts: confirmed, preparing, ready
 */
async function getOrders(status = null) {
    let endpoint = '/orders?role=waiter';
    
    if (status && status !== 'all') {
        endpoint += `&status=${status}`;
    } else {
        endpoint += '&status=confirmed,preparing,ready';
    }

    return await apiCall(endpoint);
}

/**
 * Récupère les détails d'une commande
 */
async function getOrderDetail(orderId) {
    return await apiCall(`/orders/${orderId}`);
}

/**
 * Crée une nouvelle commande
 */
async function createOrder(orderData) {
    return await apiCall('/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
    });
}

/**
 * Annule une commande (si status = confirmed)
 */
async function cancelOrder(orderId) {
    return await apiCall(`/orders/${orderId}/cancel`, {
        method: 'PATCH'
    });
}

/**
 * Récupère tous les produits
 */
async function getProducts() {
    return await apiCall('/products');
}

/**
 * Récupère les catégories
 */
async function getCategories() {
    return await apiCall('/menus');
}

// ============================================
// UI UTILITIES
// ============================================

/**
 * Affiche un toast de notification
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), duration);
}

/**
 * Navigue entre les pages
 */
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(`page-${pageId}`).classList.add('active');
}

/**
 * Formate les dates
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Formate les montants
 */
function formatAmount(amount) {
    return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

/**
 * Génère le badge de statut
 */
function getStatusBadge(status) {
    const statusLabels = {
        draft: 'Brouillon',
        confirmed: 'Confirmée',
        preparing: 'En préparation',
        ready: 'Prête',
        paid: 'Payée',
        cancelled: 'Annulée'
    };
    return `<span class="status-badge ${status}">${statusLabels[status] || status}</span>`;
}

// ============================================
// ORDERS LIST PAGE
// ============================================

/**
 * Charge et affiche la liste des commandes
 */
async function loadOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '<div class="loading">Chargement des commandes...</div>';

    try {
        const response = await getOrders(waiterState.filters.status);

        if (!response) {
            throw new Error('Erreur lors du chargement des commandes');
        }

        // L'API peut retourner un tableau direct ou un objet { orders: [] }
        waiterState.orders = Array.isArray(response) ? response : (response.orders || []);

        if (waiterState.orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <p>Aucune commande en cours</p>
                </div>
            `;
            return;
        }

        container.innerHTML = waiterState.orders.map(order => `
            <div class="order-card" onclick="viewOrderDetail('${order.id}')">
                <div class="order-card-header">
                    <span class="order-number">#${order.order_number || order.id}</span>
                    ${getStatusBadge(order.status)}
                </div>
                <div class="order-card-info">
                    <div class="info-item">
                        <strong>Table:</strong> ${order.table_number || 'N/A'}
                    </div>
                    ${order.customer_name ? `
                        <div class="info-item">
                            <strong>Client:</strong> ${order.customer_name}
                        </div>
                    ` : ''}
                    <div class="info-item">
                        <strong>Créée:</strong> ${formatDate(order.createdAt || order.created_at)}
                    </div>
                </div>
                <div class="order-card-footer">
                    <span class="order-amount">${formatAmount(order.total_amount)}</span>
                    ${order.status === 'confirmed' ? `
                        <button class="btn-secondary btn-small" onclick="event.stopPropagation(); confirmCancelOrder('${order.id}')">
                            Annuler
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');

    } catch (error) {
        showToast(error.message, 'error');
        container.innerHTML = `
            <div class="error-message">
                ${error.message}
            </div>
        `;
    }
}

/**
 * Filtre les commandes par statut
 */
function filterOrders(status) {
    waiterState.filters.status = status;
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.status === status) {
            btn.classList.add('active');
        }
    });

    loadOrders();
}

// ============================================
// NEW ORDER PAGE
// ============================================

/**
 * Initialise la page nouvelle commande
 */
async function initNewOrderPage() {
    showPage('new-order');
    
    // Reset form
    document.getElementById('table-number').value = '';
    document.getElementById('customer-name').value = '';
    waiterState.currentOrder = {
        tableNumber: null,
        customerName: '',
        items: []
    };
    updateOrderSummary();

    // Charger les produits
    await loadProductsForOrder();
}

/**
 * Charge les produits pour la sélection
 */
async function loadProductsForOrder() {
    const container = document.getElementById('new-order-products');
    container.innerHTML = '<div class="loading">Chargement des produits...</div>';

    try {
        waiterState.products = await getProducts();

        if (!waiterState.products || waiterState.products.length === 0) {
            container.innerHTML = '<div class="empty-state">Aucun produit disponible</div>';
            return;
        }

        // Charger les catégories
        const menus = await getCategories();
        if (menus && menus.menus) {
            renderCategories(menus.menus);
        }

        renderProducts();

    } catch (error) {
        showToast(error.message, 'error');
        container.innerHTML = `<div class="error-message">${error.message}</div>`;
    }
}

/**
 * Affiche les onglets de catégories
 */
function renderCategories(menus) {
    const container = document.getElementById('categories-tabs');
    
    const categories = new Set(['all']);
    menus.forEach(menu => {
        if (menu.Categories) {
            menu.Categories.forEach(cat => categories.add(cat.name));
        }
    });

    container.innerHTML = Array.from(categories).map(cat => `
        <button class="category-tab ${cat === 'all' ? 'active' : ''}" 
                onclick="filterProductsByCategory('${cat}')">
            ${cat === 'all' ? 'Tous' : cat}
        </button>
    `).join('');
}

/**
 * Affiche les produits
 */
function renderProducts(category = 'all') {
    const container = document.getElementById('new-order-products');
    
    let filteredProducts = waiterState.products;
    if (category !== 'all') {
        filteredProducts = waiterState.products.filter(p => 
            p.Category && p.Category.name === category
        );
    }

    container.innerHTML = filteredProducts.map(product => {
        const itemInCart = waiterState.currentOrder.items.find(i => i.product_id === product.id);
        const isSelected = !!itemInCart;

        return `
            <div class="product-item ${isSelected ? 'selected' : ''}"
                 onclick="toggleProductSelection('${product.id}')">
                <div class="product-name">${product.name}</div>
                <div class="product-price">${formatAmount(product.price)}</div>
                ${isSelected ? `<div class="product-qty">Qté: ${itemInCart.quantity}</div>` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Filtre produits par catégorie
 */
function filterProductsByCategory(category) {
    // Update active tab
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent.trim() === (category === 'all' ? 'Tous' : category)) {
            tab.classList.add('active');
        }
    });

    renderProducts(category);
}

/**
 * Toggle sélection d'un produit
 */
function toggleProductSelection(productId) {
    const product = waiterState.products.find(p => p.id === productId);
    if (!product) return;

    const existingIndex = waiterState.currentOrder.items.findIndex(i => i.product_id === productId);

    if (existingIndex >= 0) {
        // Incrémenter quantité
        waiterState.currentOrder.items[existingIndex].quantity++;
    } else {
        // Ajouter nouveau produit
        waiterState.currentOrder.items.push({
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit_price: product.price
        });
    }

    updateOrderSummary();
    
    // Re-render pour afficher le badge "selected"
    const activeTab = document.querySelector('.category-tab.active');
    const category = activeTab ? 
        (activeTab.textContent.trim() === 'Tous' ? 'all' : activeTab.textContent.trim()) : 
        'all';
    renderProducts(category);
}

/**
 * Met à jour le récapitulatif de commande
 */
function updateOrderSummary() {
    const itemsContainer = document.getElementById('summary-items');
    const totalContainer = document.getElementById('total-amount');
    const submitBtn = document.getElementById('btn-send-to-kitchen');

    if (waiterState.currentOrder.items.length === 0) {
        itemsContainer.innerHTML = '<p class="empty-cart">Aucun produit sélectionné</p>';
        totalContainer.textContent = '0 FCFA';
        submitBtn.disabled = true;
        return;
    }

    // Calculer total
    const total = waiterState.currentOrder.items.reduce((sum, item) => {
        return sum + (item.unit_price * item.quantity);
    }, 0);

    // Afficher items
    itemsContainer.innerHTML = waiterState.currentOrder.items.map((item, index) => `
        <div class="summary-item">
            <div class="summary-item-info">
                <div class="summary-item-name">${item.product_name}</div>
                <div class="summary-item-price">${formatAmount(item.unit_price)} × ${item.quantity}</div>
            </div>
            <div class="summary-item-qty">
                <button class="qty-btn" onclick="updateItemQuantity(${index}, -1)">-</button>
                <span class="qty-value">${item.quantity}</span>
                <button class="qty-btn" onclick="updateItemQuantity(${index}, 1)">+</button>
            </div>
        </div>
    `).join('');

    totalContainer.textContent = formatAmount(total);
    submitBtn.disabled = false;
}

/**
 * Modifie la quantité d'un item
 */
function updateItemQuantity(index, delta) {
    waiterState.currentOrder.items[index].quantity += delta;

    if (waiterState.currentOrder.items[index].quantity <= 0) {
        waiterState.currentOrder.items.splice(index, 1);
    }

    updateOrderSummary();
    
    // Re-render products pour mettre à jour les badges
    const activeTab = document.querySelector('.category-tab.active');
    const category = activeTab ? 
        (activeTab.textContent.trim() === 'Tous' ? 'all' : activeTab.textContent.trim()) : 
        'all';
    renderProducts(category);
}

/**
 * =================================================================
 * RÈGLE MÉTIER CRITIQUE : FLUX SERVEUR SIMPLIFIÉ
 * =================================================================
 * Le serveur ne gère QUE le cycle: création → confirmation → suivi
 * 
 * 1. Création: draft (backend)
 * 2. Envoi cuisine: confirmed (déclenche décrémentation stock)
 * 3. Suivi: preparing/ready (lecture seule)
 * 
 * Le serveur NE VOIT JAMAIS les commandes paid ou cancelled dans sa liste
 */

/**
 * Envoie la commande en cuisine
 * RÈGLE: Crée en draft puis confirme immédiatement
 */
async function sendToKitchen() {
    // Validation
    const tableNumber = document.getElementById('table-number').value;
    const customerName = document.getElementById('customer-name').value;

    // 🔒 RÈGLE MÉTIER: Table OU nom client obligatoire
    if (!tableNumber && !customerName) {
        showToast('Le numéro de table ou le nom du client est obligatoire', 'error');
        document.getElementById('table-number').focus();
        return;
    }

    if (waiterState.currentOrder.items.length === 0) {
        showToast('Veuillez sélectionner au moins un produit', 'error');
        return;
    }

    // Préparer les données
    const orderData = {
        type: 'dine_in',
        table_number: tableNumber || null,
        customer_name: customerName || null,
        items: waiterState.currentOrder.items.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price
        })),
        notes: `Serveur: ${waiterState.user.firstName || ''} ${waiterState.user.lastName || ''}`
    };

    try {
        const submitBtn = document.getElementById('btn-send-to-kitchen');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Envoi en cours...';

        // 1. Créer commande (status = draft)
        const createResult = await createOrder(orderData);

        if (!createResult || !createResult.order) {
            throw new Error('Erreur lors de la création de la commande');
        }

        const orderId = createResult.order.id;

        // 2. Confirmer immédiatement (déclenche décrémentation stock)
        await updateOrderStatus(orderId, 'confirmed');

        showToast('Commande envoyée en cuisine avec succès', 'success');
        
        // Reset formulaire
        waiterState.currentOrder = { tableNumber: null, customerName: '', items: [] };
        document.getElementById('table-number').value = '';
        document.getElementById('customer-name').value = '';
        
        // Retour à la liste après 1.5s
        setTimeout(() => {
            showPage('orders');
            loadOrders();
        }, 1500);

    } catch (error) {
        showToast(error.message, 'error');
        const submitBtn = document.getElementById('btn-send-to-kitchen');
        submitBtn.disabled = false;
        submitBtn.textContent = '🍳 Envoyer en cuisine';
    }
}

/**
 * Met à jour le statut d'une commande
 */
async function updateOrderStatus(orderId, newStatus) {
    return await apiCall(`/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
    });
}

// ============================================
// ORDER DETAIL PAGE
// ============================================

/**
 * Affiche le détail d'une commande
 */
async function viewOrderDetail(orderId) {
    showPage('order-detail');

    const container = document.getElementById('order-number');
    container.textContent = `#${orderId}`;

    try {
        const response = await getOrderDetail(orderId);

        if (!response) {
            throw new Error('Commande introuvable');
        }

        const order = response.order || response;
        waiterState.currentOrderDetail = order;
        renderOrderDetail(order);

    } catch (error) {
        showToast(error.message, 'error');
        showPage('orders');
    }
}

/**
 * Affiche les détails de la commande
 */
function renderOrderDetail(order) {
    // Informations générales
    document.getElementById('detail-table').textContent = order.table_number || 'N/A';
    document.getElementById('detail-customer').textContent = order.customer_name || 'Client anonyme';
    document.getElementById('detail-status').innerHTML = getStatusBadge(order.status);
    document.getElementById('detail-amount').textContent = formatAmount(order.total_amount);
    document.getElementById('detail-date').textContent = formatDate(order.createdAt || order.created_at);

    // Items
    const itemsContainer = document.getElementById('detail-items');
    itemsContainer.innerHTML = order.items.map(item => `
        <div class="order-item">
            <div class="item-info">
                <div class="item-name">${item.product_name}</div>
                <div class="item-details">
                    ${formatAmount(item.unit_price)} × ${item.quantity}
                </div>
            </div>
            <div class="item-total">${formatAmount(item.unit_price * item.quantity)}</div>
        </div>
    `).join('');

    // Actions selon statut
    const actionsContainer = document.getElementById('detail-actions');
    
    if (order.status === 'confirmed') {
        actionsContainer.innerHTML = `
            <button class="btn-secondary" onclick="confirmCancelOrder('${order.id}')">
                ❌ Annuler la commande
            </button>
        `;
    } else {
        actionsContainer.innerHTML = `
            <p style="text-align: center; color: var(--text-light);">
                Cette commande ne peut plus être modifiée (statut: ${order.status})
            </p>
        `;
    }
}

/**
 * Confirmation d'annulation de commande
 */
function confirmCancelOrder(orderId) {
    showModal(
        'Annuler la commande',
        'Êtes-vous sûr de vouloir annuler cette commande ? Cette action est irréversible.',
        async () => {
            await executeCancelOrder(orderId);
        }
    );
}

/**
 * Exécute l'annulation
 */
async function executeCancelOrder(orderId) {
    try {
        const result = await cancelOrder(orderId);

        if (result && result.order) {
            showToast('Commande annulée avec succès', 'success');
            
            // Retour à la liste
            setTimeout(() => {
                showPage('orders');
                loadOrders();
            }, 1500);
        }

    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ============================================
// MODAL
// ============================================

let modalCallback = null;

/**
 * Affiche une modal de confirmation
 */
function showModal(title, message, callback) {
    modalCallback = callback;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal-confirm').classList.add('active');
}

/**
 * Ferme la modal
 */
function closeModal() {
    document.getElementById('modal-confirm').classList.remove('active');
    modalCallback = null;
}

/**
 * Confirme l'action de la modal
 */
async function confirmModal() {
    if (modalCallback) {
        await modalCallback();
    }
    closeModal();
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Vérification auth au chargement
    if (!checkWaiterAuth()) {
        return;
    }

    // Charger les commandes par défaut
    loadOrders();

    // Déconnexion
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('bizon_token');
        localStorage.removeItem('bizon_restaurant_id');
        window.location.href = '../staff/login.html';
    });

    // Navigation
    document.getElementById('btn-new-order').addEventListener('click', initNewOrderPage);
    document.getElementById('btn-back-from-new').addEventListener('click', () => {
        showPage('orders');
        loadOrders();
    });
    document.getElementById('btn-back-from-detail').addEventListener('click', () => {
        showPage('orders');
        loadOrders();
    });

    // Filtres
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filterOrders(btn.dataset.status);
        });
    });

    // Envoi commande
    document.getElementById('btn-send-to-kitchen').addEventListener('click', sendToKitchen);

    // Modal
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-confirm-btn').addEventListener('click', confirmModal);

    // Connexion SSE pour les notifications temps réel
    initSSE();
});

// ============================================
// SSE — TEMPS RÉEL
// ============================================

let sseSource = null;

function initSSE() {
    if (!waiterState.token) return;

    const url = `${API_BASE_URL}/orders/stream?token=${encodeURIComponent(waiterState.token)}`;
    sseSource = new EventSource(url);

    sseSource.addEventListener('order_status_changed', (e) => {
        const data = JSON.parse(e.data);
        handleOrderStatusChange(data);
    });

    sseSource.onerror = () => {
        if (sseSource.readyState === EventSource.CLOSED) {
            startFallbackPolling();
        }
    };
}

function handleOrderStatusChange(data) {
    const { orderNumber, status, tableNumber } = data;

    if (status === 'ready') {
        showToast(`🍽️ Commande ${orderNumber} — Table ${tableNumber} est prête !`, 'success', 6000);
    } else if (status === 'preparing') {
        showToast(`👨‍🍳 Commande ${orderNumber} — Table ${tableNumber} en préparation`, 'info', 4000);
    }

    const activePage = document.querySelector('.page.active');
    if (activePage && activePage.id === 'page-orders') {
        loadOrders();
    }
}

let fallbackInterval = null;

function startFallbackPolling() {
    if (fallbackInterval) return;
    fallbackInterval = setInterval(() => {
        const activePage = document.querySelector('.page.active');
        if (activePage && activePage.id === 'page-orders') {
            loadOrders();
        }
    }, 30000);
}
