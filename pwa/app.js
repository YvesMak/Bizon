// ============================================
// BIZON PWA - Frontend Application
// ============================================

const API_BASE_URL = 'http://localhost:3000/api';

// State Management
const state = {
    user: null,
    token: localStorage.getItem('bizon_token') || null,
    restaurantId: localStorage.getItem('bizon_restaurant_id') || null,
    cart: JSON.parse(localStorage.getItem('bizon_cart') || '[]'),
    products: [],
    currentCategory: 'boissons-gazeuses',
    menus: []
};

// ============================================
// API CALLS
// ============================================

async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(state.token && { 'Authorization': `Bearer ${state.token}` })
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: { ...headers, ...options.headers }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || 'Une erreur est survenue');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Auth
async function register(formData) {
    const data = await apiCall('/onboarding/quick-start', {
        method: 'POST',
        body: JSON.stringify({
            restaurantName: formData.restaurantName,
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            password: formData.password,
            template: formData.template
        })
    });
    return data;
}

async function login(email, password) {
    const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    return data;
}

// Products
async function getMenus() {
    return await apiCall('/menus');
}

async function getProducts() {
    return await apiCall('/products');
}

// Orders
async function createOrder(orderData) {
    return await apiCall('/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
    });
}

// ============================================
// UI FUNCTIONS
// ============================================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(`page-${pageId}`).classList.add('active');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function updateCartUI() {
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cart-count').textContent = count;
    localStorage.setItem('bizon_cart', JSON.stringify(state.cart));
}

function addToCart(product) {
    const existingItem = state.cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        state.cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image_url,
            quantity: 1
        });
    }
    
    updateCartUI();
    showToast(`${product.name} ajouté au panier`, 'success');
}

function renderProducts(products, categoryFilter = null) {
    const grid = document.getElementById('products-grid');
    
    let filteredProducts = products;
    if (categoryFilter) {
        filteredProducts = products.filter(p => {
            const categoryName = p.Category?.name?.toLowerCase() || '';
            return categoryName.includes(categoryFilter);
        });
    }

    if (filteredProducts.length === 0) {
        grid.innerHTML = '<div class="loading">Aucun produit dans cette catégorie</div>';
        return;
    }

    grid.innerHTML = filteredProducts.map(product => `
        <div class="product-card" onclick="addToCart(${JSON.stringify(product).replace(/"/g, '&quot;')})">
            <img src="${product.image_url || 'https://via.placeholder.com/80'}" 
                 alt="${product.name}" 
                 class="product-image"
                 onerror="this.src='https://via.placeholder.com/80'">
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                ${product.description ? `<div class="product-description">${product.description}</div>` : ''}
                <div class="product-price">${product.price.toLocaleString()} FCFA</div>
                ${product.track_stock ? `<div class="product-stock">Stock: ${product.stock_quantity}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function renderCart() {
    const itemsContainer = document.getElementById('cart-items');
    const summary = document.getElementById('cart-summary');

    if (state.cart.length === 0) {
        itemsContainer.innerHTML = '<p class="empty-cart">Votre panier est vide</p>';
        summary.style.display = 'none';
        return;
    }

    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.18;
    const total = subtotal + tax;

    itemsContainer.innerHTML = state.cart.map((item, index) => `
        <div class="cart-item">
            <img src="${item.image || 'https://via.placeholder.com/60'}" 
                 alt="${item.name}" 
                 class="cart-item-image">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">${item.price.toLocaleString()} FCFA</div>
            </div>
            <div class="cart-item-quantity">
                <button class="qty-btn" onclick="updateQuantity(${index}, -1)">-</button>
                <span class="qty-value">${item.quantity}</span>
                <button class="qty-btn" onclick="updateQuantity(${index}, 1)">+</button>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart(${index})">🗑️</button>
        </div>
    `).join('');

    document.getElementById('cart-subtotal').textContent = `${subtotal.toLocaleString()} FCFA`;
    document.getElementById('cart-tax').textContent = `${tax.toLocaleString()} FCFA`;
    document.getElementById('cart-total').textContent = `${total.toLocaleString()} FCFA`;
    
    summary.style.display = 'block';
}

function updateQuantity(index, delta) {
    state.cart[index].quantity += delta;
    if (state.cart[index].quantity <= 0) {
        state.cart.splice(index, 1);
    }
    updateCartUI();
    renderCart();
}

function removeFromCart(index) {
    state.cart.splice(index, 1);
    updateCartUI();
    renderCart();
}

// ============================================
// LOAD DATA
// ============================================

async function loadProducts() {
    try {
        if (!state.token) {
            document.getElementById('products-grid').innerHTML = 
                '<div class="error-message">Veuillez vous connecter pour voir les produits</div>';
            return;
        }

        state.products = await getProducts();
        renderProducts(state.products, state.currentCategory);
    } catch (error) {
        showToast(error.message, 'error');
        document.getElementById('products-grid').innerHTML = 
            `<div class="error-message">${error.message}</div>`;
    }
}

// ============================================
// EVENT HANDLERS
// ============================================

// Header Actions
document.getElementById('btn-connexion').addEventListener('click', () => {
    showPage('login');
});

document.getElementById('btn-inscription').addEventListener('click', () => {
    showPage('register');
});

document.getElementById('btn-cart').addEventListener('click', () => {
    renderCart();
    showPage('cart');
});

// Form Links
document.getElementById('link-to-register').addEventListener('click', (e) => {
    e.preventDefault();
    showPage('register');
});

document.getElementById('link-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    showPage('login');
});

// Login Form
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const data = await login(email, password);
        state.token = data.token;
        state.user = data.user;
        state.restaurantId = data.user.restaurant_id;
        
        localStorage.setItem('bizon_token', data.token);
        localStorage.setItem('bizon_restaurant_id', data.user.restaurant_id);
        
        showToast('Connexion réussie !', 'success');
        
        // Redirection selon le rôle
        if (data.user.role === 'waiter') {
            // Redirection vers l'espace serveur
            setTimeout(() => {
                window.location.href = 'waiter/waiter.html';
            }, 1000);
            return;
        }
        
        // Comportement normal pour client/owner/manager/cashier
        showPage('menu');
        await loadProducts();
    } catch (error) {
        showToast(error.message, 'error');
    }
});

// Register Form
document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        restaurantName: document.getElementById('register-restaurant').value,
        firstName: document.getElementById('register-firstname').value,
        lastName: document.getElementById('register-lastname').value,
        email: document.getElementById('register-email').value,
        phone: document.getElementById('register-phone').value,
        password: document.getElementById('register-password').value,
        template: document.getElementById('register-template').value
    };

    try {
        const data = await register(formData);
        state.token = data.token;
        state.user = data.user;
        state.restaurantId = data.restaurant.id;
        
        localStorage.setItem('bizon_token', data.token);
        localStorage.setItem('bizon_restaurant_id', data.restaurant.id);
        
        showToast('Restaurant créé avec succès !', 'success');
        showPage('menu');
        await loadProducts();
    } catch (error) {
        showToast(error.message, 'error');
    }
});

// Sidebar Category Navigation
document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        const category = link.dataset.category;
        state.currentCategory = category;
        
        document.getElementById('category-title').textContent = link.textContent;
        renderProducts(state.products, category);
    });
});

// Checkout
document.getElementById('btn-checkout').addEventListener('click', async () => {
    if (!state.token) {
        showToast('Veuillez vous connecter', 'error');
        showPage('login');
        return;
    }

    if (state.cart.length === 0) {
        showToast('Votre panier est vide', 'error');
        return;
    }

    try {
        const orderData = {
            customer_id: null, // Optional
            type: 'dine_in',
            table_number: Math.floor(Math.random() * 20) + 1,
            items: state.cart.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                unit_price: item.price
            })),
            notes: 'Commande depuis PWA'
        };

        const order = await createOrder(orderData);
        
        state.cart = [];
        updateCartUI();
        
        showToast('Commande créée avec succès !', 'success');
        showPage('menu');
    } catch (error) {
        showToast(error.message, 'error');
    }
});

// Logo click - return to menu
document.querySelector('.logo-circle').addEventListener('click', () => {
    showPage('menu');
    if (state.token) {
        loadProducts();
    }
});

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    updateCartUI();
    
    if (state.token) {
        loadProducts();
    } else {
        showPage('login');
    }
});
