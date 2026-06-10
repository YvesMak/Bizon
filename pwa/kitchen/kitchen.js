// ============================================
// BIZON PWA — ÉCRAN CUISINE (KDS)
// Affiche en temps réel les commandes à préparer.
// ============================================
const API_BASE_URL = '/api';

const kds = {
  token: localStorage.getItem('bizon_token') || null,
  user: null,
  orders: [],
  dismissed: new Set(),       // commandes « prêtes » retirées de l'écran
  knownIds: new Set(),        // pour détecter les nouvelles commandes (son)
  sound: localStorage.getItem('kds_sound') !== 'off',
  sse: null,
  firstLoad: true
};

// ---- Auth ----
function checkAuth() {
  if (!kds.token) { window.location.href = '../staff/login.html'; return false; }
  try {
    const payload = JSON.parse(atob(kds.token.split('.')[1]));
    kds.user = payload;
    // L'écran cuisine convient aux rôles voyant les statuts de préparation.
    if (!['waiter', 'manager', 'owner', 'cashier'].includes(payload.role)) {
      window.location.href = '../staff/login.html';
      return false;
    }
    return true;
  } catch {
    localStorage.removeItem('bizon_token');
    window.location.href = '../staff/login.html';
    return false;
  }
}

// ---- API ----
async function apiCall(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${kds.token}` };
  const res = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers: { ...headers, ...options.headers } });
  if (res.status === 401) { localStorage.removeItem('bizon_token'); window.location.href = '../staff/login.html'; return null; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Erreur');
  return data;
}

// ---- Chargement ----
async function loadOrders() {
  try {
    const orders = await apiCall('/orders?status=confirmed,preparing,ready');
    if (!orders) return;
    const list = Array.isArray(orders) ? orders : (orders.orders || []);

    // Détecter les nouvelles commandes « à préparer » → son + flash
    const incoming = list.filter(o => o.status === 'confirmed' && !kds.knownIds.has(o.id));
    if (!kds.firstLoad && incoming.length && kds.sound) beep();
    list.forEach(o => kds.knownIds.add(o.id));

    kds.orders = list;
    kds.firstLoad = false;
    render();
  } catch (e) { showToast(e.message); }
}

// ---- Rendu ----
const TYPE_BADGE = {
  dine_in: (o) => `🍽️ Table ${o.table_number || '—'}`,
  takeaway: () => '🥡 À emporter',
  delivery: () => '🛵 Livraison'
};

function elapsedInfo(createdAt) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  const cls = mins >= 20 ? 'late' : (mins >= 10 ? 'warn' : 'ok');
  const label = mins < 1 ? "à l'instant" : (mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`);
  return { cls, label };
}

function itemsHtml(items) {
  if (!items || !items.length) return '';
  return items.map(it => {
    const opts = Array.isArray(it.options) && it.options.length
      ? `<span class="kds-item-opts">${it.options.map(o => esc(o.name)).join(', ')}</span>` : '';
    const notes = it.notes ? `<span class="kds-item-note">📝 ${esc(it.notes)}</span>` : '';
    return `<li class="kds-item">
        <span class="kds-qty">${it.quantity}×</span>
        <span class="kds-item-main">${esc(it.product_name)}${opts}${notes}</span>
      </li>`;
  }).join('');
}

function cardHtml(o) {
  const t = elapsedInfo(o.created_at || o.createdAt);
  const badge = (TYPE_BADGE[o.type] || (() => o.type))(o);
  let action = '';
  if (o.status === 'confirmed') action = `<button class="kds-action start" onclick="advance('${o.id}','preparing')">▶ Commencer</button>`;
  else if (o.status === 'preparing') action = `<button class="kds-action ready" onclick="advance('${o.id}','ready')">✓ Prête</button>`;
  else if (o.status === 'ready') action = `<button class="kds-action clear" onclick="dismiss('${o.id}')">Retirer</button>`;
  return `<article class="kds-card ${o.status} t-${t.cls}" data-id="${o.id}">
      <div class="kds-card-top">
        <span class="kds-order-no">${esc(o.order_number || '')}</span>
        <span class="kds-timer ${t.cls}">${t.label}</span>
      </div>
      <div class="kds-badge">${badge}</div>
      <ul class="kds-items">${itemsHtml(o.items)}</ul>
      ${o.notes ? `<div class="kds-order-note">📝 ${esc(o.notes)}</div>` : ''}
      ${action}
    </article>`;
}

function render() {
  const cols = { confirmed: [], preparing: [], ready: [] };
  for (const o of kds.orders) {
    if (o.status === 'ready' && kds.dismissed.has(o.id)) continue;
    if (cols[o.status]) cols[o.status].push(o);
  }
  for (const status of Object.keys(cols)) {
    const body = document.getElementById(`col-${status}`);
    const arr = cols[status];
    document.getElementById(`count-${status}`).textContent = arr.length;
    body.innerHTML = arr.length
      ? arr.map(cardHtml).join('')
      : '<div class="kds-empty">—</div>';
  }
}

// ---- Actions ----
async function advance(orderId, toStatus) {
  // Optimiste : mettre à jour localement, puis confirmer côté serveur.
  const o = kds.orders.find(x => x.id === orderId);
  if (o) { o.status = toStatus; render(); }
  try {
    await apiCall(`/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status: toStatus }) });
  } catch (e) { showToast(e.message); loadOrders(); }
}

function dismiss(orderId) {
  kds.dismissed.add(orderId);
  render();
}

// ---- Temps réel (SSE) ----
function connectSSE() {
  if (kds.sse) kds.sse.close();
  const url = `${API_BASE_URL}/orders/stream?token=${encodeURIComponent(kds.token)}`;
  kds.sse = new EventSource(url);
  const onEvent = () => loadOrders();
  kds.sse.addEventListener('order_status_changed', onEvent);
  kds.sse.addEventListener('order_created', onEvent);
  kds.sse.onerror = () => {
    setLive(false);
    if (kds.sse.readyState === EventSource.CLOSED) setTimeout(connectSSE, 3000);
  };
  kds.sse.onopen = () => setLive(true);
}

function setLive(on) {
  const el = document.getElementById('kds-live');
  el.classList.toggle('off', !on);
  el.textContent = on ? '● en direct' : '○ reconnexion…';
}

// ---- Son ----
let audioCtx = null;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
    o.start(); o.stop(audioCtx.currentTime + 0.36);
  } catch { /* silencieux */ }
}

function toggleSound() {
  kds.sound = !kds.sound;
  localStorage.setItem('kds_sound', kds.sound ? 'on' : 'off');
  document.getElementById('kds-sound').classList.toggle('off', !kds.sound);
  if (kds.sound) beep();
}

// ---- Utils ----
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('kds-toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;
  document.getElementById('kds-resto').textContent = `${kds.user.firstName || ''} ${kds.user.lastName || ''}`.trim() || 'Cuisine';
  document.getElementById('kds-sound').classList.toggle('off', !kds.sound);
  document.getElementById('kds-logout').addEventListener('click', () => {
    localStorage.removeItem('bizon_token'); window.location.href = '../staff/login.html';
  });
  loadOrders();
  connectSSE();
  // Filet de sécurité : recharger périodiquement + rafraîchir les minuteurs.
  setInterval(loadOrders, 20000);
  setInterval(render, 30000);
});
