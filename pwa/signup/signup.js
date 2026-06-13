// Page d'inscription publique Bizon (propriétaires de restaurant).
const API = '/api';
const state = { plans: [], cadence: 'monthly', selectedPlan: 'premium' };

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
  // (ré)afficher le formulaire, masquer le succès
  document.getElementById('signup-form').classList.remove('hidden');
  document.getElementById('signup-success').classList.add('hidden');
  document.getElementById('signup-error').textContent = '';
  openModal('signup-modal');
}
function closeSignup() { closeModal('signup-modal'); }

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
  document.getElementById('success-plan-line').innerHTML = p && !p.custom
    ? `Plan choisi : <strong>${esc(p.name)}</strong> — ${fmt(p.monthly)} FCFA/mois après l'essai`
    : 'Notre équipe vous contactera pour votre devis.';
  document.getElementById('signup-form').classList.add('hidden');
  document.getElementById('signup-success').classList.remove('hidden');
  toast('Compte créé 🎉');
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
