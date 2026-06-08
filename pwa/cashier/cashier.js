// ============================================
// BIZON PWA - CASHIER MODULE
// Espace caissier pour encaissement et factures
// ============================================

const API_BASE_URL = '/api';

// ============================================
// STATE MANAGEMENT
// ============================================
const cashierState = {
    user: null,
    token: localStorage.getItem('bizon_token') || null,
    restaurantId: localStorage.getItem('bizon_restaurant_id') || null,
    orders: [],
    invoices: [],
    filters: { status: 'ready' },
    currentOrder: null,
    currentPayment: null,
    selectedMethod: 'cash'
};

// ============================================
// AUTH & ROLE CHECK
// ============================================

function checkCashierAuth() {
    if (!cashierState.token) {
        window.location.href = '../staff/login.html';
        return false;
    }

    try {
        const payload = JSON.parse(atob(cashierState.token.split('.')[1]));
        cashierState.user = payload;

        if (payload.role !== 'cashier') {
            showToast('Accès refusé : rôle caissier requis', 'error');
            setTimeout(() => window.location.href = '../staff/login.html', 2000);
            return false;
        }

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

async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(cashierState.token && { 'Authorization': `Bearer ${cashierState.token}` })
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
// API FUNCTIONS
// ============================================

async function getOrders(status = null) {
    let endpoint = '/orders';
    if (status && status !== 'all') {
        endpoint += `?status=${status}`;
    }
    return await apiCall(endpoint);
}

async function getOrderDetail(orderId) {
    return await apiCall(`/orders/${orderId}`);
}

async function createPayment(data) {
    return await apiCall('/payments', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function verifyPayment(paymentId, transactionCode) {
    return await apiCall(`/payments/${paymentId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ transaction_code: transactionCode })
    });
}

async function getPaymentsByOrder(orderId) {
    return await apiCall(`/payments/order/${orderId}`);
}

async function getInvoices() {
    return await apiCall('/invoices');
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
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(`page-${pageId}`).classList.add('active');
}

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

function formatAmount(amount) {
    return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

function getStatusBadge(status) {
    const statusLabels = {
        draft: 'Brouillon',
        confirmed: 'Confirmée',
        preparing: 'En préparation',
        ready: 'Prête',
        paid: 'Payée',
        completed: 'Payée',
        cancelled: 'Annulée'
    };
    const displayStatus = status === 'completed' ? 'paid' : status;
    return `<span class="status-badge ${displayStatus}">${statusLabels[status] || status}</span>`;
}

function navigateTo(page) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) link.classList.add('active');
    });

    showPage(page);

    if (page === 'orders') loadOrders();
    if (page === 'invoices') loadInvoices();
    if (page === 'report') loadReport();
}

function backToOrders() {
    navigateTo('orders');
}

// ============================================
// MODAL
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
    if (modalCallback) {
        await modalCallback();
    }
    closeModal();
}

// ============================================
// ORDERS LIST PAGE
// ============================================

async function loadOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '<div class="loading">Chargement des commandes...</div>';

    try {
        const response = await getOrders(cashierState.filters.status);

        if (!response) {
            throw new Error('Erreur lors du chargement des commandes');
        }

        cashierState.orders = response.orders || (Array.isArray(response) ? response : []);

        if (cashierState.orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💰</div>
                    <p>Aucune commande ${cashierState.filters.status === 'ready' ? 'à encaisser' : ''}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = cashierState.orders.map(order => `
            <div class="order-card ${order.status === 'ready' ? 'order-card-ready' : ''}" onclick="startPayment('${order.id}')">
                <div class="order-card-header">
                    <span class="order-number">${order.order_number || '#' + order.id}</span>
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
                        <strong>Créée:</strong> ${formatDate(order.createdAt)}
                    </div>
                </div>
                <div class="order-card-footer">
                    <span class="order-amount">${formatAmount(order.total_amount)}</span>
                    ${order.status === 'ready' ? `
                        <button class="btn-primary btn-small" onclick="event.stopPropagation(); startPayment('${order.id}')">
                            Encaisser
                        </button>
                    ` : `
                        <span class="paid-label">Encaissée</span>
                    `}
                </div>
            </div>
        `).join('');

    } catch (error) {
        showToast(error.message, 'error');
        container.innerHTML = `<div class="error-message">${error.message}</div>`;
    }
}

function filterOrders(status) {
    cashierState.filters.status = status;

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.status === status) {
            btn.classList.add('active');
        }
    });

    loadOrders();
}

// ============================================
// PAYMENT PAGE
// ============================================

async function startPayment(orderId) {
    try {
        const response = await getOrderDetail(orderId);

        if (!response) {
            throw new Error('Commande introuvable');
        }

        const order = response.order || response;

        // Si commande déjà payée, juste afficher les détails
        if (order.status === 'paid' || order.status === 'completed') {
            showToast('Cette commande est déjà payée', 'info');
            return;
        }

        cashierState.currentOrder = order;
        cashierState.selectedMethod = 'cash';

        // Remplir les infos
        document.getElementById('payment-order-number').textContent = order.order_number || `#${order.id}`;
        document.getElementById('pay-table').textContent = order.table_number || 'N/A';
        document.getElementById('pay-customer').textContent = order.customer_name || 'Client anonyme';
        document.getElementById('pay-total').textContent = formatAmount(order.total_amount);

        // Items
        const itemsContainer = document.getElementById('pay-items');
        if (order.items && order.items.length > 0) {
            itemsContainer.innerHTML = order.items.map(item => `
                <div class="recap-item">
                    <span class="recap-item-name">${item.product_name} × ${item.quantity}</span>
                    <span class="recap-item-total">${formatAmount(item.unit_price * item.quantity)}</span>
                </div>
            `).join('');
        } else {
            itemsContainer.innerHTML = '<p>Détails non disponibles</p>';
        }

        // Reset form
        selectMethod('cash');
        document.getElementById('phone-number').value = '';
        stopCashierCampayWait();

        showPage('payment');

    } catch (error) {
        showToast(error.message, 'error');
    }
}

function selectMethod(method) {
    cashierState.selectedMethod = method;

    document.querySelectorAll('.method-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.method === method) btn.classList.add('active');
    });

    const mobileFields = document.getElementById('mobile-money-fields');
    mobileFields.style.display = method === 'mobile_money' ? 'block' : 'none';
    const wait = document.getElementById('cashier-momo-wait');
    if (wait && method !== 'mobile_money') wait.style.display = 'none';
}

let cashierPollTimer = null;

async function submitPayment() {
    const order = cashierState.currentOrder;
    if (!order) return;
    const method = cashierState.selectedMethod;
    const submitBtn = document.getElementById('btn-submit-payment');

    // --- Mobile Money via Campay (push USSD sur le téléphone du client) ---
    if (method === 'mobile_money') {
        const phone = document.getElementById('phone-number').value.trim();
        if (!phone) { showToast('Saisissez le numéro Mobile Money du client', 'error'); return; }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Envoi de la demande…';
        try {
            const res = await apiCall('/payments/campay/initiate', {
                method: 'POST',
                body: JSON.stringify({ order_id: order.id, phone })
            });
            if (!res || !res.payment_id) throw new Error('Échec de l\'initiation');
            startCashierCampayWait(res.payment_id);
        } catch (error) {
            showToast(error.message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Valider le paiement';
        }
        return;
    }

    // --- Espèces ---
    submitBtn.disabled = true;
    submitBtn.textContent = 'Traitement…';
    try {
        const result = await createPayment({ order_id: order.id, amount: parseFloat(order.total_amount), method: 'cash' });
        if (!result || !result.payment) throw new Error('Erreur lors du paiement');
        showToast('Paiement espèces enregistré ✅', 'success');
        setTimeout(backToOrders, 1200);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Valider le paiement';
    }
}

function startCashierCampayWait(paymentId) {
    const wait = document.getElementById('cashier-momo-wait');
    const statusEl = document.getElementById('cashier-momo-status');
    if (wait) wait.style.display = 'flex';
    if (statusEl) statusEl.textContent = 'En attente de la validation du client…';

    const deadline = Date.now() + 150000; // 2,5 min
    const poll = async () => {
        if (Date.now() > deadline) { stopCashierCampayWait(); finishCashierMomo('timeout'); return; }
        try {
            const r = await apiCall(`/payments/${paymentId}/campay-status`);
            if (r && r.status === 'completed') { stopCashierCampayWait(); finishCashierMomo('completed'); }
            else if (r && r.status === 'failed') { stopCashierCampayWait(); finishCashierMomo('failed'); }
        } catch (e) { /* on réessaie au prochain tick */ }
    };
    cashierPollTimer = setInterval(poll, 4000);
    poll();
}

function stopCashierCampayWait() {
    if (cashierPollTimer) { clearInterval(cashierPollTimer); cashierPollTimer = null; }
    const wait = document.getElementById('cashier-momo-wait');
    if (wait) wait.style.display = 'none';
    const submitBtn = document.getElementById('btn-submit-payment');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Valider le paiement'; }
}

function finishCashierMomo(outcome) {
    if (outcome === 'completed') {
        showToast('Paiement Mobile Money confirmé ✅', 'success');
        setTimeout(backToOrders, 1200);
    } else if (outcome === 'failed') {
        showToast('Paiement échoué ou refusé', 'error');
    } else {
        showToast('Délai dépassé. Réessayez ou encaissez en espèces.', 'error');
    }
}

// ============================================
// RAPPORT DE CAISSE (Z)
// ============================================
const METHOD_LABELS = { cash: '💵 Espèces', mobile_money: '📱 Mobile Money', card: '💳 Carte' };

async function loadReport() {
    const container = document.getElementById('report-content');
    const dateInput = document.getElementById('report-date');
    if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
    container.innerHTML = '<div class="loading">Chargement du rapport...</div>';
    try {
        const date = dateInput ? dateInput.value : '';
        const data = await apiCall(`/payments/report${date ? `?date=${date}` : ''}`);
        if (!data) return;
        const rows = (data.by_method || []).map(r => `
            <div class="report-row">
                <span>${METHOD_LABELS[r.method] || r.method}</span>
                <span>${r.count} paiement(s)</span>
                <span class="report-amount">${formatAmount(r.total)}</span>
            </div>`).join('') || '<p style="color:var(--text-light)">Aucun encaissement ce jour.</p>';
        container.innerHTML = `
            <div class="report-card">
                <div class="report-total">
                    <span>Total encaissé</span>
                    <span class="report-grand">${formatAmount(data.total)}</span>
                </div>
                <div class="report-count">${data.count} paiement(s) le ${data.date}</div>
                <div class="report-breakdown">${rows}</div>
            </div>`;
    } catch (e) {
        container.innerHTML = '<p style="color:var(--error)">Erreur de chargement</p>';
    }
}

// ============================================
// VERIFY PAGE
// ============================================

function showVerifyPage(payment, order) {
    document.getElementById('verify-order-number').textContent = order.order_number || `#${order.id}`;
    document.getElementById('verify-amount').textContent = formatAmount(payment.amount);
    document.getElementById('verify-provider').textContent = payment.provider || 'Mobile Money';
    document.getElementById('verify-phone').textContent = payment.phone_number || 'N/A';
    document.getElementById('verify-transaction-code').value = '';
    showPage('verify');
}

async function executeVerify() {
    const payment = cashierState.currentPayment;
    if (!payment) return;

    const txCode = document.getElementById('verify-transaction-code').value.trim();

    if (!txCode || txCode.length < 6) {
        showToast('Le code de transaction doit contenir au moins 6 caractères', 'error');
        return;
    }

    const verifyBtn = document.getElementById('btn-verify-payment');
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Vérification en cours...';

    try {
        const result = await verifyPayment(payment.id, txCode);

        if (!result || !result.payment) {
            throw new Error('Erreur lors de la vérification');
        }

        showToast('Paiement vérifié avec succès', 'success');
        setTimeout(() => {
            backToOrders();
        }, 1500);

    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Vérifier le paiement';
    }
}

// ============================================
// INVOICES PAGE
// ============================================

async function loadInvoices() {
    const container = document.getElementById('invoices-list');
    container.innerHTML = '<div class="loading">Chargement des factures...</div>';

    try {
        const invoices = await getInvoices();

        if (!invoices || invoices.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📄</div>
                    <p>Aucune facture disponible</p>
                </div>
            `;
            return;
        }

        cashierState.invoices = invoices;

        container.innerHTML = invoices.map(invoice => `
            <div class="invoice-card">
                <div class="invoice-header">
                    <span class="invoice-number">${invoice.invoice_number || 'Facture #' + invoice.id}</span>
                    <span class="invoice-date">${formatDate(invoice.issued_at || invoice.createdAt)}</span>
                </div>
                <div class="invoice-info">
                    <div class="info-item">
                        <strong>Commande:</strong> ${invoice.order?.order_number || '#' + invoice.order_id}
                    </div>
                    <div class="info-item">
                        <strong>Client:</strong> ${invoice.customer_name || 'N/A'}
                    </div>
                    <div class="info-item">
                        <strong>Montant:</strong> ${formatAmount(invoice.total_amount || 0)}
                    </div>
                </div>
                <div class="invoice-actions">
                    <button class="btn-primary btn-small" onclick="downloadInvoice('${invoice.id}')">
                        Télécharger PDF
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        showToast(error.message, 'error');
        container.innerHTML = `<div class="error-message">${error.message}</div>`;
    }
}

async function downloadInvoice(invoiceId) {
    try {
        const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}/pdf`, {
            headers: { 'Authorization': `Bearer ${cashierState.token}` }
        });

        if (!response.ok) {
            throw new Error('Erreur lors du téléchargement');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facture-${invoiceId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        showToast('Facture téléchargée', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    if (!checkCashierAuth()) return;

    loadOrders();

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('bizon_token');
        localStorage.removeItem('bizon_restaurant_id');
        window.location.href = '../staff/login.html';
    });

    // Filtres
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => filterOrders(btn.dataset.status));
    });

    // Paiement
    document.getElementById('btn-submit-payment').addEventListener('click', submitPayment);

    // Vérification
    document.getElementById('btn-verify-payment').addEventListener('click', executeVerify);

    // Modal
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-confirm-btn').addEventListener('click', confirmModal);

    // Auto-refresh 30s
    setInterval(() => {
        const activePage = document.querySelector('.page.active');
        if (activePage && activePage.id === 'page-orders') {
            loadOrders();
        }
    }, 30000);
});
