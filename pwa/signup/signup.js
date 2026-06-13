// Page d'inscription publique Bizon (propriétaires de restaurant).
const API = '/api';
const state = { plans: [], cadence: 'monthly', selectedPlan: 'premium', token: null, phone: '' };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function toast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  setTimeout(() => t.classList.add('hidden'), 2800);
}

/* ---------- Plans ---------- */
async function loadPlans() {
  try {
    const data = await (await fetch(`${API}/public/plans`)).json();
    state.plans = data.plans || [];
    renderPlans();
  } catch {
    document.getElementById('plans').innerHTML = '<p class="muted">Impossible de charger les tarifs.</p>';
  }
}

function renderPlans() {
  const yearly = state.cadence === 'yearly';
  document.getElementById('plans').innerHTML = state.plans.map((p) => {
    const priceBlock = p.custom
      ? '<div class="plan-price custom"><span class="amount">Sur devis</span></div><div class="plan-cycle">Tarif adapté à vos établissements</div>'
      : `<div class="plan-price"><span class="amount">${fmt(yearly ? p.yearly : p.monthly)}</span><span class="unit">FCFA${yearly ? '/an' : '/mois'}</span></div>`
        + `<div class="plan-cycle">${yearly ? `soit ${fmt(Math.round(p.yearly / 12))} FCFA/mois` : 'facturé mensuellement'}</div>`;
    const cta = p.custom
      ? `<button class="btn btn-ghost btn-block" onclick="openSignup('${p.id}')">Demander un devis</button>`
      : `<button class="btn ${p.popular ? 'btn-primary' : 'btn-ghost'} btn-block" onclick="openSignup('${p.id}')">Choisir ${esc(p.name)}</button>`;
    return `
      <div class="plan ${p.popular ? 'popular' : ''}">
        ${p.popular ? '<span class="plan-tag">★ Le plus choisi</span>' : ''}
        <div class="plan-name">${esc(p.name)}</div>
        <div class="plan-tagline">${esc(p.tagline)}</div>
        ${priceBlock}
        <ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        ${cta}
      </div>`;
  }).join('');
}

function setCadence(c) {
  state.cadence = c;
  document.getElementById('t-monthly').classList.toggle('active', c === 'monthly');
  document.getElementById('t-yearly').classList.toggle('active', c === 'yearly');
  renderPlans();
}

/* ---------- Modale d'inscription ---------- */
function planById(id) { return state.plans.find((p) => p.id === id); }

function openSignup(planId) {
  state.selectedPlan = planId || 'premium';
  const p = planById(state.selectedPlan);
  const line = p
    ? (p.custom
      ? `Plan ${p.name} — notre équipe vous contactera. Essai gratuit de 14 jours inclus.`
      : `Plan ${p.name} — essai gratuit de 14 jours, sans carte bancaire.`)
    : 'Essai gratuit de 14 jours — sans carte bancaire.';
  document.getElementById('signup-plan-line').textContent = line;
  document.getElementById('signup-error').textContent = '';
  showPanel('signup-form');
  openModal('signup-modal');
}
function closeSignup() { closeModal('signup-modal'); }

// Affiche un seul panneau de la modale (formulaire → succès → paiement → activé).
function showPanel(id) {
  ['signup-form', 'signup-success', 'signup-pay', 'signup-activated'].forEach((p) => {
    document.getElementById(p).classList.toggle('hidden', p !== id);
  });
}

document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('signup-error');
  err.textContent = '';
  const btn = document.getElementById('su-submit');
  const payload = {
    name: document.getElementById('su-resto').value.trim(),
    firstName: document.getElementById('su-first').value.trim(),
    lastName: document.getElementById('su-last').value.trim(),
    email: document.getElementById('su-email').value.trim(),
    phone: document.getElementById('su-phone').value.trim(),
    password: document.getElementById('su-password').value
  };
  if (!payload.name || !payload.firstName || !payload.email || !payload.phone || !payload.password) {
    err.textContent = 'Merci de remplir les champs obligatoires.';
    return;
  }
  if (payload.password.length < 6) {
    err.textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Création…';
  try {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Inscription impossible');
    state.token = data.token;
    state.phone = payload.phone;
    showSuccess();
  } catch (e2) {
    err.textContent = e2.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Créer mon compte gratuit';
  }
});

function showSuccess() {
  const p = planById(state.selectedPlan);
  const payable = p && !p.custom;
  document.getElementById('success-plan-line').innerHTML = payable
    ? `Plan choisi : <strong>${esc(p.name)}</strong> — ${fmt(p.monthly)} FCFA/mois après l'essai`
    : 'Notre équipe vous contactera pour votre devis.';
  // Enterprise / pas de token : pas d'activation self-serve.
  document.getElementById('activate-btn').classList.toggle('hidden', !payable || !state.token);
  showPanel('signup-success');
  toast('Compte créé 🎉');
}

/* ---------- Paiement (activation) ---------- */
function showPay() {
  const p = planById(state.selectedPlan);
  if (!p || p.custom) return;
  const yearly = state.cadence === 'yearly';
  document.getElementById('pay-plan-name').textContent = p.name;
  document.getElementById('pay-amount-line').textContent =
    `${fmt(yearly ? p.yearly : p.monthly)} FCFA / ${yearly ? 'an' : 'mois'}`;
  document.getElementById('pay-phone').value = state.phone || '';
  document.getElementById('pay-error').textContent = '';
  document.getElementById('pay-pending').classList.add('hidden');
  document.getElementById('pay-submit').disabled = false;
  showPanel('signup-pay');
}

async function startPay() {
  const err = document.getElementById('pay-error');
  err.textContent = '';
  const phone = document.getElementById('pay-phone').value.trim();
  if (!phone) { err.textContent = 'Entrez votre numéro Mobile Money.'; return; }
  const btn = document.getElementById('pay-submit');
  btn.disabled = true;
  btn.textContent = 'Initialisation…';
  try {
    const res = await fetch(`${API}/subscriptions/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ plan: state.selectedPlan, cadence: state.cadence, phone })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Paiement impossible');
    document.getElementById('pay-ussd').textContent = data.ussd_code || '*126#';
    document.getElementById('pay-pending').classList.remove('hidden');
    btn.textContent = 'En attente…';
    await pollConfirm(data.reference);
  } catch (e) {
    err.textContent = e.message;
    btn.disabled = false;
    btn.textContent = 'Payer maintenant';
    document.getElementById('pay-pending').classList.add('hidden');
  }
}

async function pollConfirm(reference, attempt = 0) {
  if (attempt > 20) { // ~60 s
    document.getElementById('pay-error').textContent = "Paiement non confirmé. Réessayez ou validez depuis votre téléphone.";
    document.getElementById('pay-pending').classList.add('hidden');
    const btn = document.getElementById('pay-submit');
    btn.disabled = false; btn.textContent = 'Réessayer';
    return;
  }
  const res = await fetch(`${API}/subscriptions/checkout/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${state.token}` }
  });
  const data = await res.json();
  if (data.status === 'successful') { showActivated(); return; }
  if (data.status === 'failed') {
    document.getElementById('pay-error').textContent = 'Paiement échoué. Réessayez.';
    document.getElementById('pay-pending').classList.add('hidden');
    const btn = document.getElementById('pay-submit');
    btn.disabled = false; btn.textContent = 'Réessayer';
    return;
  }
  setTimeout(() => pollConfirm(reference, attempt + 1), 3000);
}

function showActivated() {
  const p = planById(state.selectedPlan);
  document.getElementById('activated-line').innerHTML = `Votre plan <strong>${esc(p ? p.name : '')}</strong> est actif. Merci !`;
  showPanel('signup-activated');
  toast('Abonnement activé ✅');
}

/* ---------- Infra modale (Échap, fond, focus) ---------- */
let modalOpener = null;
function openModal(id) {
  modalOpener = document.activeElement;
  const m = document.getElementById(id);
  m.classList.remove('hidden');
  const f = m.querySelector('input, button');
  if (f) setTimeout(() => f.focus(), 40);
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  if (modalOpener && modalOpener.focus) modalOpener.focus();
}
document.addEventListener('keydown', (e) => {
  const open = document.querySelector('.modal:not(.hidden)');
  if (!open) return;
  if (e.key === 'Escape') { closeModal(open.id); return; }
  if (e.key !== 'Tab') return;
  const f = [...open.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])')]
    .filter((el) => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) closeModal(e.target.id);
});

/* ---------- Init ---------- */
document.getElementById('year').textContent = new Date().getFullYear();
loadPlans();
