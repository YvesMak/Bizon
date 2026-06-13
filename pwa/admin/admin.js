/* Back-office plateforme Bizon — super-administrateur */
const API = '/api/admin';
const TYPE_LABELS = { dine_in: 'Sur place', takeaway: 'À emporter', delivery: 'Livraison' };

const state = {
  token: localStorage.getItem('bizon_admin_token') || null,
  owners: [],
  restaurants: [],
  subscriptions: [],
  dashboard: null
};

const PLAN_LABELS = { trial: 'Essai', basic: 'Basic', premium: 'Premium', enterprise: 'Enterprise' };
const PLAN_PRICE = { trial: 'Gratuit', basic: '5 000 FCFA/mois', premium: '15 000 FCFA/mois', enterprise: 'Sur devis' };

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
function skeletons(n = 3) {
  return Array.from({ length: n }, () => (
    '<div class="skeleton-card"><div class="sk title"></div>'
    + '<div class="sk line w60"></div><div class="sk line w30"></div></div>'
  )).join('');
}
function emptyState(emoji, title, msg, ctaLabel, ctaFn) {
  return `<div class="empty"><div class="emoji" aria-hidden="true">${emoji}</div>`
    + `<h3>${esc(title)}</h3><p>${esc(msg)}</p>`
    + `<button class="btn btn-primary" onclick="${ctaFn}">${esc(ctaLabel)}</button></div>`;
}

/* ---------- Auth ---------- */
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    const r = await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Identifiants invalides');
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
    await Promise.all([loadDashboard(), loadOwners(), loadRestaurants(), loadSubscriptions()]);
  } catch (err) {
    toast(err.message, true);
  }
}

/* ---------- Navigation (barre latérale) ---------- */
const SECTIONS = ['dashboard', 'owners', 'restaurants', 'subscriptions'];
const SECTION_TITLES = {
  dashboard: "Vue d'ensemble", owners: 'Propriétaires', restaurants: 'Restaurants', subscriptions: 'Abonnements'
};
function switchTab(section) {
  document.querySelectorAll('.nav-item').forEach((n) => {
    const on = n.dataset.section === section;
    n.classList.toggle('active', on);
    if (on) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current');
  });
  SECTIONS.forEach((s) => {
    document.getElementById(`tab-${s}`).classList.toggle('hidden', s !== section);
  });
  document.getElementById('section-title').textContent = SECTION_TITLES[section] || '';
  applySearch();
  toggleSidebar(false);
}

function toggleSidebar(force) {
  const open = force === undefined ? !document.body.classList.contains('sidebar-open') : force;
  document.body.classList.toggle('sidebar-open', open);
}

/* ---------- Recherche globale ---------- */
let searchQuery = '';
function onSearch(q) { searchQuery = (q || '').trim().toLowerCase(); applySearch(); }
function applySearch() {
  const active = document.querySelector('.tab-panel:not(.hidden)');
  if (!active) return;
  const cards = active.querySelectorAll('.card[data-search]');
  let visible = 0;
  cards.forEach((c) => {
    const match = !searchQuery || c.dataset.search.includes(searchQuery);
    c.classList.toggle('hidden', !match);
    if (match) visible += 1;
  });
  const list = active.querySelector('.cards');
  if (!list || !cards.length) return;
  let empty = list.querySelector('.search-empty');
  if (searchQuery && !visible) {
    if (!empty) {
      empty = document.createElement('p');
      empty.className = 'muted search-empty';
      list.appendChild(empty);
    }
    empty.textContent = `Aucun résultat pour « ${searchQuery} ».`;
    empty.classList.remove('hidden');
  } else if (empty) {
    empty.classList.add('hidden');
  }
}

/* ---------- Vue d'ensemble (KPIs + graphiques) ---------- */
function fmtNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

async function loadDashboard() {
  const d = await api('/dashboard');
  state.dashboard = d;
  document.getElementById('kpi-grid').innerHTML = `
    <div class="kpi"><div class="kpi-v">${fmtNum(d.mrr)}</div><div class="kpi-k">MRR estimé (FCFA)</div></div>
    <div class="kpi accent"><div class="kpi-v">${d.subscriptions.paying}</div><div class="kpi-k">Abonnés payants</div></div>
    <div class="kpi"><div class="kpi-v">${d.totals.restaurants}</div><div class="kpi-k">Restaurants</div></div>
    <div class="kpi"><div class="kpi-v">${d.totals.owners}</div><div class="kpi-k">Propriétaires</div></div>
    <div class="kpi"><div class="kpi-v">${d.subscriptions.trials}</div><div class="kpi-k">Essais en cours</div></div>
    <div class="kpi"><div class="kpi-v ${d.subscriptions.expiringSoon ? 'warn' : ''}">${d.subscriptions.expiringSoon}</div><div class="kpi-k">Expirent sous 3 j</div></div>
  `;
  renderPlansChart(d.planDistribution);
  renderStatusChart(d.statusDistribution);
  renderSignupsChart(d.signupsByWeek);
}

const PLAN_COLORS = { trial: '#B9B2A8', basic: '#1A73C7', premium: '#C62828', enterprise: '#1F1B16' };
function renderPlansChart(dist) {
  const el = document.getElementById('chart-plans');
  const entries = Object.entries(dist).filter(([, v]) => v > 0);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  if (!total) { el.innerHTML = '<p class="muted">Aucune donnée.</p>'; return; }
  const r = 52; const cx = 60; const cy = 60; const circ = 2 * Math.PI * r;
  let acc = 0;
  const segs = entries.map(([k, v]) => {
    const frac = v / total;
    const s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${PLAN_COLORS[k] || '#999'}" stroke-width="16" stroke-dasharray="${frac * circ} ${circ}" stroke-dashoffset="${-acc * circ}" transform="rotate(-90 ${cx} ${cy})"/>`;
    acc += frac;
    return s;
  }).join('');
  const legend = entries.map(([k, v]) => `<li><span class="dot" style="background:${PLAN_COLORS[k] || '#999'}"></span>${PLAN_LABELS[k] || k} <strong>${v}</strong></li>`).join('');
  el.innerHTML = `<div class="donut-wrap">
    <svg viewBox="0 0 120 120" class="donut" role="img" aria-label="Répartition des plans">${segs}
      <text x="60" y="58" text-anchor="middle" class="donut-c">${total}</text>
      <text x="60" y="75" text-anchor="middle" class="donut-l">total</text></svg>
    <ul class="legend">${legend}</ul></div>`;
}

const STATUS_COLORS = { active: '#2E7D32', suspended: '#C62828', closed: '#B9B2A8' };
const STATUS_NAMES = { active: 'Actifs', suspended: 'Suspendus', closed: 'Fermés' };
function renderStatusChart(dist) {
  const el = document.getElementById('chart-status');
  const entries = Object.entries(dist);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  el.innerHTML = `<div class="bars">${entries.map(([k, v]) => `
    <div class="bar-row">
      <span class="bar-label">${STATUS_NAMES[k] || k}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(v / max) * 100}%;background:${STATUS_COLORS[k]}"></div></div>
      <span class="bar-val">${v}</span>
    </div>`).join('')}</div>`;
}

function renderSignupsChart(weeks) {
  const el = document.getElementById('chart-signups');
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const W = 560; const H = 170; const pad = 26; const n = weeks.length;
  const gap = (W - pad * 2) / n;
  const bw = gap * 0.55;
  const bars = weeks.map((w, i) => {
    const h = (w.count / max) * (H - pad * 2);
    const x = pad + i * gap + (gap - bw) / 2;
    const y = H - pad - h;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="var(--red)"/>
      <text x="${(x + bw / 2).toFixed(1)}" y="${H - pad + 15}" text-anchor="middle" class="axis-l">${esc(w.label)}</text>
      ${w.count ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" class="bar-c">${w.count}</text>` : ''}`;
  }).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" class="signups" role="img" aria-label="Inscriptions par semaine">
    <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="var(--line)"/>${bars}</svg>`;
}

/* ---------- Menu overflow (⋯) ---------- */
function closeAllMenus() {
  document.querySelectorAll('.menu-pop').forEach((p) => p.classList.add('hidden'));
  document.querySelectorAll('.menu-btn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  document.querySelectorAll('.card.menu-open').forEach((c) => c.classList.remove('menu-open'));
}
function toggleMenu(e, btn) {
  e.stopPropagation();
  const pop = btn.nextElementSibling;
  const isOpen = !pop.classList.contains('hidden');
  closeAllMenus();
  if (!isOpen) {
    pop.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
    btn.closest('.card')?.classList.add('menu-open'); // surélève la carte porteuse
  }
}

function menu(items) {
  // items : [{ label, fn, danger }] — rendu d'un menu overflow
  const inner = items.map((it) => (
    `<button class="${it.danger ? 'danger' : ''}" onclick="${it.fn}">${esc(it.label)}</button>`
  )).join('');
  return `<div class="menu-wrap">
      <button class="menu-btn" aria-haspopup="true" aria-expanded="false" aria-label="Plus d'actions" onclick="toggleMenu(event,this)">⋯</button>
      <div class="menu-pop hidden" role="menu">${inner}</div>
    </div>`;
}

/* ---------- Owners ---------- */
async function loadOwners() {
  const list = document.getElementById('owners-list');
  list.innerHTML = skeletons(2);
  state.owners = await api('/owners');
  if (!state.owners.length) {
    list.innerHTML = emptyState('👤', 'Aucun propriétaire', 'Créez un propriétaire pour démarrer.', '+ Nouveau propriétaire', 'openOwnerModal()');
    return;
  }
  list.innerHTML = state.owners.map((o) => {
    const restos = (o.ownedRestaurants || []).map((r) => `<span class="resto-mini">• ${esc(r.name)}</span>`).join(' ');
    const search = esc(`${o.first_name} ${o.last_name} ${o.email} ${o.phone || ''} ${(o.ownedRestaurants || []).map((r) => r.name).join(' ')}`.toLowerCase());
    return `
      <div class="card" data-search="${search}">
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
          <button class="btn btn-ghost btn-sm" onclick="openQuotaModal('${o.id}')">Modifier le quota</button>
          ${menu([{
    label: o.status === 'active' ? 'Désactiver le propriétaire' : 'Réactiver le propriétaire',
    fn: `confirmToggleOwner('${o.id}','${o.status}')`,
    danger: o.status === 'active'
  }])}
        </div>
      </div>`;
  }).join('');
}

function openOwnerModal() {
  document.getElementById('owner-form').reset();
  document.getElementById('owner-error').textContent = '';
  document.querySelectorAll('#o-service-types input').forEach((c) => { c.checked = true; });
  openModal('owner-modal');
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
    await Promise.all([loadOwners(), loadRestaurants(), loadDashboard()]);
  } catch (e2) {
    err.textContent = e2.message;
  }
});

/* Quota — modale (remplace le prompt) */
let quotaOwnerId = null;
function openQuotaModal(ownerId) {
  const o = state.owners.find((x) => x.id === ownerId);
  quotaOwnerId = ownerId;
  document.getElementById('quota-modal-sub').textContent = o ? `${o.first_name} ${o.last_name}` : '';
  document.getElementById('q-value').value = (o && o.max_restaurants) || 1;
  document.getElementById('quota-error').textContent = '';
  openModal('quota-modal');
}
document.getElementById('quota-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('quota-error');
  err.textContent = '';
  const n = parseInt(document.getElementById('q-value').value, 10);
  if (!Number.isInteger(n) || n < 1) { err.textContent = 'Quota invalide (minimum 1).'; return; }
  try {
    await api(`/owners/${quotaOwnerId}`, { method: 'PATCH', body: JSON.stringify({ max_restaurants: n }) });
    closeModal('quota-modal');
    toast('Quota mis à jour');
    loadOwners();
  } catch (e2) { err.textContent = e2.message; }
});

function confirmToggleOwner(ownerId, status) {
  const o = state.owners.find((x) => x.id === ownerId);
  const next = status === 'active' ? 'inactive' : 'active';
  const off = next === 'inactive';
  confirmDialog({
    title: off ? 'Désactiver le propriétaire ?' : 'Réactiver le propriétaire ?',
    message: `${o ? o.first_name + ' ' + o.last_name : 'Ce compte'} ${off ? 'ne pourra plus se connecter.' : 'pourra de nouveau se connecter.'}`,
    confirmLabel: off ? 'Désactiver' : 'Réactiver',
    danger: off,
    onConfirm: async () => {
      try {
        await api(`/owners/${ownerId}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
        toast('Statut mis à jour');
        loadOwners();
      } catch (e) { toast(e.message, true); }
    }
  });
}

/* ---------- Restaurants ---------- */
async function loadRestaurants() {
  const list = document.getElementById('restaurants-list');
  list.innerHTML = skeletons(2);
  state.restaurants = await api('/restaurants');
  const origin = location.origin;
  if (!state.restaurants.length) {
    list.innerHTML = emptyState('🍽️', 'Aucun restaurant', 'Ajoutez un restaurant et rattachez-le à un propriétaire.', '+ Nouveau restaurant', 'openRestaurantModal()');
    return;
  }
  list.innerHTML = state.restaurants.map((r) => {
    const types = (r.settings && r.settings.service_types) || ['dine_in', 'takeaway', 'delivery'];
    const chips = types.map((t) => `<span class="chip">${TYPE_LABELS[t] || t}</span>`).join('');
    const owner = r.owner ? `${esc(r.owner.first_name)} ${esc(r.owner.last_name)}` : '<span class="muted">Sans propriétaire</span>';
    const clientLink = r.custom_domain ? `https://${esc(r.custom_domain)}` : `${origin}/?r=${esc(r.slug)}`;
    const domainRow = r.custom_domain
      ? `<span class="chip">🌐 ${esc(r.custom_domain)}</span>`
      : '<span class="muted" style="font-size:12px">Aucun domaine personnalisé</span>';
    const overflow = [];
    if (r.custom_domain) overflow.push({ label: 'Vérifier le domaine', fn: `verifyDomain('${r.id}')` });
    overflow.push({
      label: r.status === 'active' ? 'Suspendre le restaurant' : 'Réactiver le restaurant',
      fn: `confirmToggleRestaurant('${r.id}','${r.status}')`,
      danger: r.status === 'active'
    });
    const search = esc(`${r.name} ${r.slug} ${r.custom_domain || ''} ${r.owner ? r.owner.first_name + ' ' + r.owner.last_name + ' ' + r.owner.email : ''}`.toLowerCase());
    return `
      <div class="card" data-search="${search}">
        <div class="card-row">
          <div>
            <h3>${esc(r.name)}</h3>
            <div class="sub">${owner}${r.address ? ' · ' + esc(r.address) : ''}</div>
          </div>
          <span class="badge ${r.status}">${r.status === 'active' ? 'Actif' : (r.status === 'suspended' ? 'Suspendu' : 'Fermé')}</span>
        </div>

        <div class="link-box">
          <span class="link-label">Lien client</span>
          <a class="link-url" href="${clientLink}" target="_blank" rel="noopener">${esc(clientLink)}</a>
          <button class="btn btn-ghost btn-sm" onclick="copyLink('${clientLink.replace(/'/g, "\\'")}')">Copier</button>
        </div>
        <div class="sub" style="margin-top:8px">Slug : <code>${esc(r.slug)}</code> &nbsp;·&nbsp; ${domainRow} <span id="dstatus-${r.id}" class="domain-status"></span></div>

        <div class="chips">${chips}</div>
        <div class="card-actions">
          <button class="btn btn-ghost btn-sm" onclick="openDomainModal('${r.id}')">Domaine personnalisé</button>
          <button class="btn btn-ghost btn-sm" onclick="openServiceModal('${r.id}')">Modes de service</button>
          ${menu(overflow)}
        </div>
      </div>`;
  }).join('');
}

function openRestaurantModal() {
  document.getElementById('restaurant-form').reset();
  document.getElementById('restaurant-error').textContent = '';
  document.querySelectorAll('#r-service-types input').forEach((c) => { c.checked = true; });
  const sel = document.getElementById('r-owner');
  sel.innerHTML = state.owners.map((o) => `<option value="${o.id}">${esc(o.first_name)} ${esc(o.last_name)} (${esc(o.email)})</option>`).join('');
  if (!state.owners.length) { sel.innerHTML = '<option value="">Créez d\'abord un propriétaire</option>'; }
  openModal('restaurant-modal');
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
    await Promise.all([loadRestaurants(), loadOwners(), loadDashboard()]);
  } catch (e2) {
    err.textContent = e2.message;
  }
});

/* Modes de service — modale (remplace le prompt) */
let serviceRestaurantId = null;
function openServiceModal(restaurantId) {
  const r = state.restaurants.find((x) => x.id === restaurantId);
  serviceRestaurantId = restaurantId;
  document.getElementById('service-modal-sub').textContent = r ? r.name : '';
  const current = (r && r.settings && r.settings.service_types) || ['dine_in', 'takeaway', 'delivery'];
  document.querySelectorAll('#s-service-types input').forEach((c) => { c.checked = current.includes(c.value); });
  document.getElementById('service-error').textContent = '';
  openModal('service-modal');
}
document.getElementById('service-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('service-error');
  err.textContent = '';
  const types = getChecked('s-service-types');
  if (!types.length) { err.textContent = 'Au moins un mode de service est requis.'; return; }
  try {
    await api(`/restaurants/${serviceRestaurantId}`, { method: 'PATCH', body: JSON.stringify({ service_types: types }) });
    closeModal('service-modal');
    toast('Modes de service mis à jour');
    loadRestaurants();
  } catch (e2) { err.textContent = e2.message; }
});

function confirmToggleRestaurant(restaurantId, status) {
  const r = state.restaurants.find((x) => x.id === restaurantId);
  const next = status === 'active' ? 'suspended' : 'active';
  const off = next === 'suspended';
  confirmDialog({
    title: off ? 'Suspendre le restaurant ?' : 'Réactiver le restaurant ?',
    message: `« ${r ? r.name : ''} » ${off ? 'ne sera plus accessible aux clients.' : 'redeviendra accessible aux clients.'}`,
    confirmLabel: off ? 'Suspendre' : 'Réactiver',
    danger: off,
    onConfirm: async () => {
      try {
        await api(`/restaurants/${restaurantId}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
        toast('Statut mis à jour');
        await Promise.all([loadRestaurants(), loadDashboard()]);
      } catch (e) { toast(e.message, true); }
    }
  });
}

function copyLink(url) {
  navigator.clipboard.writeText(url)
    .then(() => toast('Lien copié'))
    .catch(() => toast('Copie impossible', true));
}

/* ---------- Domaine personnalisé — modale (remplace le prompt) ---------- */
let domainRestaurantId = null;
function appHost() { return location.host; }

function openDomainModal(restaurantId) {
  const r = state.restaurants.find((x) => x.id === restaurantId);
  domainRestaurantId = restaurantId;
  document.getElementById('domain-modal-sub').textContent = r ? r.name : '';
  document.getElementById('d-domain').value = (r && r.custom_domain) || '';
  document.getElementById('d-cname').textContent = appHost();
  document.getElementById('domain-error').textContent = '';
  document.getElementById('d-verify-status').innerHTML = '';
  const hasDomain = !!(r && r.custom_domain);
  document.getElementById('d-remove-btn').style.display = hasDomain ? '' : 'none';
  document.getElementById('d-verify-btn').style.display = hasDomain ? '' : 'none';
  openModal('domain-modal');
}
function copyCname() {
  navigator.clipboard.writeText(appHost())
    .then(() => toast('CNAME copié'))
    .catch(() => toast('Copie impossible', true));
}
document.getElementById('domain-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('domain-error');
  err.textContent = '';
  try {
    await api(`/restaurants/${domainRestaurantId}`, {
      method: 'PATCH',
      body: JSON.stringify({ custom_domain: document.getElementById('d-domain').value.trim() })
    });
    closeModal('domain-modal');
    toast('Domaine enregistré');
    loadRestaurants();
  } catch (e2) { err.textContent = e2.message; }
});
async function removeDomain() {
  try {
    await api(`/restaurants/${domainRestaurantId}`, { method: 'PATCH', body: JSON.stringify({ custom_domain: '' }) });
    closeModal('domain-modal');
    toast('Domaine retiré');
    loadRestaurants();
  } catch (e) { document.getElementById('domain-error').textContent = e.message; }
}
async function verifyDomainInModal() {
  const el = document.getElementById('d-verify-status');
  el.innerHTML = '<span class="domain-badge muted">⏳ Vérification…</span>';
  try {
    const res = await api(`/restaurants/${domainRestaurantId}/verify-domain`);
    const s = DOMAIN_STATUS[res.status] || DOMAIN_STATUS.unreachable;
    el.innerHTML = `<span class="domain-badge ${s.cls}" title="${esc(s.msg)}">${s.icon} ${s.label}</span>`;
  } catch (e) {
    el.innerHTML = '';
    document.getElementById('domain-error').textContent = e.message;
  }
}

// Présentation des statuts renvoyés par /verify-domain.
const DOMAIN_STATUS = {
  active: { cls: 'ok', icon: '✅', label: 'Actif', msg: 'Le domaine pointe bien vers ce restaurant.' },
  wrong_restaurant: { cls: 'err', icon: '❌', label: 'Mauvais restaurant', msg: 'Le domaine répond mais sert un AUTRE restaurant.' },
  unresolved: { cls: 'warn', icon: '⚠️', label: 'Non résolu', msg: 'Joignable, mais aucun restaurant n’est résolu pour ce domaine.' },
  unreachable: { cls: 'warn', icon: '⏳', label: 'Injoignable', msg: 'DNS non encore propagé, TLS absent, ou domaine non ajouté chez l’hébergeur (Render → Custom Domains).' },
  no_domain: { cls: 'muted', icon: '–', label: 'Aucun domaine', msg: 'Aucun domaine personnalisé configuré.' }
};

// Vérif depuis le menu d'une carte : badge inline sur la carte.
async function verifyDomain(restaurantId) {
  const el = document.getElementById(`dstatus-${restaurantId}`);
  if (el) el.innerHTML = '<span class="domain-badge muted">⏳ Vérification…</span>';
  try {
    const res = await api(`/restaurants/${restaurantId}/verify-domain`);
    const s = DOMAIN_STATUS[res.status] || DOMAIN_STATUS.unreachable;
    if (el) el.innerHTML = `<span class="domain-badge ${s.cls}" title="${esc(s.msg)}">${s.icon} ${s.label}</span>`;
    toast(`${s.icon} ${s.label} — ${s.msg}`, res.status !== 'active');
  } catch (e) {
    if (el) el.innerHTML = '';
    toast(e.message, true);
  }
}

/* ---------- Confirmation générique ---------- */
function confirmDialog({ title, message, confirmLabel = 'Confirmer', danger = true, onConfirm }) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = message;
  const ok = document.getElementById('confirm-ok');
  ok.textContent = confirmLabel;
  ok.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
  const handler = async () => {
    ok.removeEventListener('click', handler);
    closeModal('confirm-modal');
    await onConfirm();
  };
  ok.addEventListener('click', handler);
  openModal('confirm-modal');
}

/* ---------- Abonnements ---------- */
function subBadgeClass(s) {
  if (s.status === 'cancelled') return 'closed';
  if (s.isExpired) return 'suspended';
  if (s.plan !== 'trial') return 'active';
  return 'trial';
}
// Statut effectif : un abonnement « actif » mais dont l'échéance est passée
// est affiché « Expiré » (cohérence avec le compteur de jours).
function subStatusLabel(s) {
  if (s.status === 'cancelled') return 'Annulé';
  if (s.status === 'suspended') return 'Suspendu';
  if (s.isExpired) return 'Expiré';
  return 'Actif';
}
function daysLabel(s) {
  if (s.status === 'cancelled') return 'Annulé';
  if (s.isExpired) return `Expiré depuis ${Math.abs(s.daysRemaining)} j`;
  if (s.daysRemaining <= 3) return `Expire dans ${s.daysRemaining} j`;
  return `${s.daysRemaining} j restants`;
}
function daysClass(s) {
  if (s.isExpired || s.status === 'cancelled') return 'days-bad';
  if (s.daysRemaining <= 3) return 'days-warn';
  return 'days-ok';
}

async function loadSubscriptions() {
  const list = document.getElementById('subscriptions-list');
  list.innerHTML = skeletons(3);
  state.subscriptions = await api('/subscriptions');
  renderSubSummary();
  if (!state.subscriptions.length) {
    document.getElementById('sub-summary').innerHTML = '';
    list.innerHTML = '<p class="muted">Aucun abonnement.</p>';
    return;
  }
  list.innerHTML = state.subscriptions.map((s) => {
    const restoName = s.restaurant ? esc(s.restaurant.name) : '<span class="muted">Restaurant supprimé</span>';
    const owner = s.owner ? `${esc(s.owner.name)} · ${esc(s.owner.email)}` : '<span class="muted">Sans propriétaire</span>';
    const end = new Date(s.end_date).toLocaleDateString('fr-FR');
    const search = esc(`${s.restaurant ? s.restaurant.name : ''} ${s.owner ? s.owner.name + ' ' + s.owner.email : ''} ${s.plan}`.toLowerCase());
    return `
      <div class="card" data-search="${search}">
        <div class="card-row">
          <div>
            <h3>${restoName}</h3>
            <div class="sub">${owner}</div>
          </div>
          <span class="plan-badge plan-${s.plan}">${PLAN_LABELS[s.plan] || s.plan}</span>
        </div>
        <div class="sub-meta">
          <span class="badge ${subBadgeClass(s)}">${subStatusLabel(s)}</span>
          <span class="days ${daysClass(s)}">${daysLabel(s)}</span>
          <span class="muted" style="font-size:13px">Échéance : ${end} · ${esc(PLAN_PRICE[s.plan] || '')}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-ghost btn-sm" onclick="openSubModal('${s.restaurant_id}')">Gérer l'abonnement</button>
        </div>
      </div>`;
  }).join('');
}

function renderSubSummary() {
  const subs = state.subscriptions;
  const trials = subs.filter((s) => s.plan === 'trial' && !s.isExpired && s.status !== 'cancelled').length;
  const expiringSoon = subs.filter((s) => !s.isExpired && s.status === 'active' && s.daysRemaining <= 3).length;
  const paying = subs.filter((s) => s.plan !== 'trial' && s.status === 'active' && !s.isExpired).length;
  const expired = subs.filter((s) => s.isExpired).length;
  document.getElementById('sub-summary').innerHTML = `
    <div class="stat-card"><div class="v">${paying}</div><div class="k">Abonnés payants</div></div>
    <div class="stat-card accent"><div class="v">${trials}</div><div class="k">Essais en cours</div></div>
    <div class="stat-card"><div class="v">${expiringSoon}</div><div class="k">Expirent sous 3 j</div></div>
    <div class="stat-card"><div class="v">${expired}</div><div class="k">Expirés</div></div>
  `;
}

let subRestaurantId = null;
function openSubModal(restaurantId) {
  const s = state.subscriptions.find((x) => x.restaurant_id === restaurantId);
  subRestaurantId = restaurantId;
  document.getElementById('sub-modal-sub').textContent = s && s.restaurant ? s.restaurant.name : '';
  document.getElementById('sub-plan').value = (s && s.plan) || 'trial';
  document.getElementById('sub-status').value = (s && s.status) || 'active';
  document.getElementById('sub-extend').value = '';
  document.getElementById('sub-error').textContent = '';
  openModal('sub-modal');
}
document.getElementById('sub-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('sub-error');
  err.textContent = '';
  const body = {
    plan: document.getElementById('sub-plan').value,
    status: document.getElementById('sub-status').value
  };
  const extend = document.getElementById('sub-extend').value.trim();
  if (extend !== '') body.extend_days = parseInt(extend, 10);
  try {
    await api(`/subscriptions/${subRestaurantId}`, { method: 'PATCH', body: JSON.stringify(body) });
    closeModal('sub-modal');
    toast('Abonnement mis à jour');
    loadSubscriptions();
  } catch (e2) { err.textContent = e2.message; }
});

/* ---------- Modal infra (focus-trap, Échap, restauration du focus) ---------- */
let modalOpener = null;
function openModal(id) {
  closeAllMenus();
  modalOpener = document.activeElement;
  const m = document.getElementById(id);
  m.classList.remove('hidden');
  const focusable = m.querySelector('input:not([type=hidden]), select, textarea, button');
  if (focusable) setTimeout(() => focusable.focus(), 40);
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  if (modalOpener && typeof modalOpener.focus === 'function') modalOpener.focus();
  modalOpener = null;
}

// Échap ferme la modale du dessus ; Tab reste piégé à l'intérieur.
document.addEventListener('keydown', (e) => {
  const open = [...document.querySelectorAll('.modal:not(.hidden)')].pop();
  if (!open) return;
  if (e.key === 'Escape') { closeModal(open.id); return; }
  if (e.key !== 'Tab') return;
  const f = [...open.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea')]
    .filter((el) => el.offsetParent !== null && el.style.display !== 'none');
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

// Clic sur le fond ferme la modale ; clic ailleurs ferme les menus overflow.
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) { closeModal(e.target.id); return; }
  // Ferme les menus overflow sauf si on (re)clique le bouton bascule lui-même.
  if (!e.target.closest('.menu-btn')) closeAllMenus();
});

/* ---------- Init ---------- */
if (state.token) boot();
