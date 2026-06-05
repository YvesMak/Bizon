/* Back-office plateforme Bizon — super-administrateur */
const API = '/api/admin';
const TYPE_LABELS = { dine_in: 'Sur place', takeaway: 'À emporter', delivery: 'Livraison' };

const state = {
  token: localStorage.getItem('bizon_admin_token') || null,
  owners: [],
  restaurants: []
};

/* ---------- Helpers ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
function toast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  setTimeout(() => t.classList.add('hidden'), 2600);
}
async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token && { Authorization: `Bearer ${state.token}` }),
      ...(options.headers || {})
    }
  });
  let body = null;
  try { body = await res.json(); } catch { /* no body */ }
  if (res.status === 401) { logout(); throw new Error('Session expirée'); }
  if (!res.ok) throw new Error((body && body.error) || 'Erreur serveur');
  return body;
}
function getChecked(containerId) {
  return [...document.querySelectorAll(`#${containerId} input:checked`)].map((c) => c.value);
}

/* ---------- Auth ---------- */
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    const data = await (await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
      })
    }).then(async (r) => {
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || 'Identifiants invalides');
      return { json: () => b };
    })).json();
    state.token = data.token;
    localStorage.setItem('bizon_admin_token', data.token);
    boot();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

function logout() {
  state.token = null;
  localStorage.removeItem('bizon_admin_token');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

/* ---------- Boot ---------- */
async function boot() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  try {
    const me = await api('/me');
    document.getElementById('admin-name').textContent = me.admin.name;
    await Promise.all([loadStats(), loadOwners(), loadRestaurants()]);
  } catch (err) {
    toast(err.message, true);
  }
}

/* ---------- Stats ---------- */
async function loadStats() {
  const s = await api('/stats');
  const byStatus = s.restaurantsByStatus || {};
  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="v">${s.restaurants}</div><div class="k">Restaurants</div></div>
    <div class="stat-card accent"><div class="v">${s.owners}</div><div class="k">Propriétaires</div></div>
    <div class="stat-card"><div class="v">${s.orders}</div><div class="k">Commandes totales</div></div>
    <div class="stat-card"><div class="v">${byStatus.active || 0}</div><div class="k">Restaurants actifs</div></div>
    <div class="stat-card"><div class="v">${byStatus.suspended || 0}</div><div class="k">Suspendus</div></div>
  `;
}

/* ---------- Tabs ---------- */
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('tab-owners').classList.toggle('hidden', tab !== 'owners');
  document.getElementById('tab-restaurants').classList.toggle('hidden', tab !== 'restaurants');
}

/* ---------- Owners ---------- */
async function loadOwners() {
  state.owners = await api('/owners');
  const html = state.owners.map((o) => {
    const restos = (o.ownedRestaurants || []).map((r) => `<span class="resto-mini">• ${esc(r.name)}</span>`).join(' ');
    return `
      <div class="card">
        <div class="card-row">
          <div>
            <h3>${esc(o.first_name)} ${esc(o.last_name)}</h3>
            <div class="sub">${esc(o.email)}${o.phone ? ' · ' + esc(o.phone) : ''}</div>
          </div>
          <span class="badge ${o.status === 'active' ? 'active' : 'suspended'}">${o.status === 'active' ? 'Actif' : 'Inactif'}</span>
        </div>
        <div class="sub" style="margin-top:8px">Quota : <strong>${o.max_restaurants}</strong> restaurant(s) · Possède ${(o.ownedRestaurants || []).length}</div>
        <div class="chips">${restos || '<span class="resto-mini">Aucun restaurant lié</span>'}</div>
        <div class="card-actions">
          <button class="btn btn-ghost btn-sm" onclick="editQuota('${o.id}', ${o.max_restaurants})">Modifier le quota</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleOwner('${o.id}', '${o.status}')">${o.status === 'active' ? 'Désactiver' : 'Réactiver'}</button>
        </div>
      </div>`;
  }).join('');
  document.getElementById('owners-list').innerHTML = html || '<p class="muted">Aucun propriétaire.</p>';
}

function openOwnerModal() {
  document.getElementById('owner-form').reset();
  document.getElementById('owner-error').textContent = '';
  document.querySelectorAll('#o-service-types input').forEach((c) => { c.checked = true; });
  document.getElementById('owner-modal').classList.remove('hidden');
}

document.getElementById('owner-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('owner-error');
  err.textContent = '';
  try {
    await api('/owners', {
      method: 'POST',
      body: JSON.stringify({
        first_name: document.getElementById('o-first').value,
        last_name: document.getElementById('o-last').value,
        email: document.getElementById('o-email').value,
        password: document.getElementById('o-password').value,
        phone: document.getElementById('o-phone').value,
        restaurant_name: document.getElementById('o-resto').value,
        max_restaurants: parseInt(document.getElementById('o-quota').value, 10) || 1,
        service_types: getChecked('o-service-types')
      })
    });
    closeModal('owner-modal');
    toast('Propriétaire créé');
    await Promise.all([loadOwners(), loadRestaurants(), loadStats()]);
  } catch (e2) {
    err.textContent = e2.message;
  }
});

async function editQuota(ownerId, current) {
  const val = prompt('Nouveau quota de restaurants :', current);
  if (val == null) return;
  const n = parseInt(val, 10);
  if (!Number.isInteger(n) || n < 1) return toast('Quota invalide', true);
  try {
    await api(`/owners/${ownerId}`, { method: 'PATCH', body: JSON.stringify({ max_restaurants: n }) });
    toast('Quota mis à jour');
    loadOwners();
  } catch (e) { toast(e.message, true); }
}

async function toggleOwner(ownerId, status) {
  const next = status === 'active' ? 'inactive' : 'active';
  try {
    await api(`/owners/${ownerId}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
    toast('Statut mis à jour');
    loadOwners();
  } catch (e) { toast(e.message, true); }
}

/* ---------- Restaurants ---------- */
async function loadRestaurants() {
  state.restaurants = await api('/restaurants');
  const html = state.restaurants.map((r) => {
    const types = (r.settings && r.settings.service_types) || ['dine_in', 'takeaway', 'delivery'];
    const chips = types.map((t) => `<span class="chip">${TYPE_LABELS[t] || t}</span>`).join('');
    const owner = r.owner ? `${esc(r.owner.first_name)} ${esc(r.owner.last_name)}` : '<span class="muted">Sans propriétaire</span>';
    return `
      <div class="card">
        <div class="card-row">
          <div>
            <h3>${esc(r.name)}</h3>
            <div class="sub">${owner}${r.address ? ' · ' + esc(r.address) : ''}</div>
          </div>
          <span class="badge ${r.status}">${r.status === 'active' ? 'Actif' : (r.status === 'suspended' ? 'Suspendu' : 'Fermé')}</span>
        </div>
        <div class="chips">${chips}</div>
        <div class="card-actions">
          <button class="btn btn-ghost btn-sm" onclick="editServiceTypes('${r.id}')">Modes de service</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleRestaurant('${r.id}', '${r.status}')">${r.status === 'active' ? 'Suspendre' : 'Réactiver'}</button>
        </div>
      </div>`;
  }).join('');
  document.getElementById('restaurants-list').innerHTML = html || '<p class="muted">Aucun restaurant.</p>';
}

function openRestaurantModal() {
  document.getElementById('restaurant-form').reset();
  document.getElementById('restaurant-error').textContent = '';
  document.querySelectorAll('#r-service-types input').forEach((c) => { c.checked = true; });
  const sel = document.getElementById('r-owner');
  sel.innerHTML = state.owners.map((o) => `<option value="${o.id}">${esc(o.first_name)} ${esc(o.last_name)} (${esc(o.email)})</option>`).join('');
  if (!state.owners.length) { sel.innerHTML = '<option value="">Créez d\'abord un propriétaire</option>'; }
  document.getElementById('restaurant-modal').classList.remove('hidden');
}

document.getElementById('restaurant-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('restaurant-error');
  err.textContent = '';
  try {
    await api('/restaurants', {
      method: 'POST',
      body: JSON.stringify({
        owner_id: document.getElementById('r-owner').value,
        name: document.getElementById('r-name').value,
        address: document.getElementById('r-address').value,
        phone: document.getElementById('r-phone').value,
        service_types: getChecked('r-service-types')
      })
    });
    closeModal('restaurant-modal');
    toast('Restaurant créé');
    await Promise.all([loadRestaurants(), loadOwners(), loadStats()]);
  } catch (e2) {
    err.textContent = e2.message;
  }
});

async function editServiceTypes(restaurantId) {
  const r = state.restaurants.find((x) => x.id === restaurantId);
  const current = (r && r.settings && r.settings.service_types) || ['dine_in', 'takeaway', 'delivery'];
  const input = prompt(
    'Modes proposés (séparés par des virgules) parmi : dine_in, takeaway, delivery',
    current.join(',')
  );
  if (input == null) return;
  const types = input.split(',').map((s) => s.trim()).filter((s) => ['dine_in', 'takeaway', 'delivery'].includes(s));
  if (!types.length) return toast('Au moins un mode valide requis', true);
  try {
    await api(`/restaurants/${restaurantId}`, { method: 'PATCH', body: JSON.stringify({ service_types: types }) });
    toast('Modes de service mis à jour');
    loadRestaurants();
  } catch (e) { toast(e.message, true); }
}

async function toggleRestaurant(restaurantId, status) {
  const next = status === 'active' ? 'suspended' : 'active';
  try {
    await api(`/restaurants/${restaurantId}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
    toast('Statut mis à jour');
    loadRestaurants();
  } catch (e) { toast(e.message, true); }
}

/* ---------- Modal utils ---------- */
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) e.target.classList.add('hidden');
});

/* ---------- Init ---------- */
if (state.token) boot();
