# Bizon - Module Serveur (Waiter)

## 📋 Vue d'ensemble

Module frontend dédié au rôle **SERVEUR** (waiter) dans la PWA Bizon.

**Accès**: `http://localhost:8080/waiter/waiter.html`

## 🎯 Fonctionnalités implémentées

### 1. Authentification & Sécurité

✅ **Vérification rôle au chargement**
- Decode JWT token
- Vérifie `role === 'waiter'`
- Redirection auto si non authentifié ou mauvais rôle

✅ **Protection des routes**
- Middleware frontend dans `checkWaiterAuth()`
- Blocage accès si token expiré (401)
- Blocage si permissions insuffisantes (403)

### 2. Écran : Liste des commandes

**Route**: Page par défaut après login

**Affichage**:
- Commandes avec statuts: `confirmed`, `preparing`, `ready`
- Données visibles:
  - Numéro commande (#123)
  - Table / Nom client
  - Montant total
  - Badge de statut (couleur)
  - Date création

**Filtres**:
- Toutes
- Confirmées
- En préparation
- Prêtes

**Actions**:
- Clic sur carte → Voir détail
- Bouton "Annuler" (si `status === confirmed`)
- Bouton principal: "➕ Nouvelle Commande"

**Auto-refresh**: Toutes les 30 secondes

**Endpoint**: `GET /api/orders?role=waiter&status=confirmed,preparing,ready`

### 3. Écran : Nouvelle commande

**Route**: Activée via bouton "Nouvelle Commande"

**Formulaire**:
- `tableNumber` (obligatoire, type number)
- `customerName` (optionnel, type text)

**Sélection produits**:
- Réutilise la grille produits existante
- Filtrage par catégories (onglets dynamiques)
- Clic sur produit → ajout au panier
- Badge "selected" sur produits dans panier

**Récapitulatif**:
- Liste items avec quantités
- Boutons +/- pour modifier quantité
- Total calculé automatiquement
- Sticky positioning (reste visible au scroll)

**Validation**:
- Vérifie table_number présent
- Vérifie au moins 1 produit sélectionné
- Affiche toast d'erreur si invalide

**Envoi**:
- Bouton "🍳 Envoyer en cuisine"
- État désactivé si panier vide
- Loading state pendant l'envoi
- Toast de succès
- Retour auto à la liste après 1.5s

**Endpoint**: `POST /api/orders`

**Payload**:
```json
{
  "type": "dine_in",
  "table_number": 12,
  "customer_name": "Dupont",
  "items": [
    {
      "product_id": 5,
      "quantity": 2,
      "unit_price": 2500
    }
  ],
  "notes": "Commande serveur - Jean Martin"
}
```

### 4. Écran : Détail commande

**Route**: Clic sur une commande dans la liste

**Informations affichées**:
- Table
- Client (ou "Client anonyme")
- Statut (badge coloré)
- Montant total
- Date de création

**Produits**:
- Nom produit
- Prix unitaire × quantité
- Total par ligne

**Actions dynamiques**:

**Si `status === 'confirmed'`**:
- Bouton "❌ Annuler la commande"
- Modal de confirmation avant annulation
- Toast de succès après annulation
- Retour auto à la liste

**Sinon**:
- Message: "Cette commande ne peut plus être modifiée"

**Endpoints**:
- `GET /api/orders/:id` (détail)
- `PATCH /api/orders/:id/cancel` (annulation)

## 🏗️ Architecture

```
pwa/waiter/
├── waiter.html      # Structure HTML (3 pages)
├── waiter.css       # Styles spécifiques rôle serveur
└── waiter.js        # Logique métier
```

### État global (waiterState)

```javascript
{
  user: {...},              // Info utilisateur décodé du JWT
  token: "...",             // JWT token
  restaurantId: "...",      // ID restaurant
  orders: [],               // Liste commandes chargées
  products: [],             // Catalogue produits
  categories: [],           // Liste catégories
  currentOrder: {           // Commande en cours de création
    tableNumber: null,
    customerName: '',
    items: []
  },
  filters: {
    status: 'all'           // Filtre actif
  },
  currentOrderDetail: null  // Commande en détail
}
```

### Pages (Single Page Application)

**Page 1: `page-orders`** (active par défaut)
- Liste commandes filtrées
- Filtres de statut
- Bouton nouvelle commande

**Page 2: `page-new-order`**
- Formulaire table/client
- Grille produits + catégories
- Récapitulatif panier
- Bouton envoi cuisine

**Page 3: `page-order-detail`**
- Informations commande
- Liste produits
- Actions conditionnelles

### Composants réutilisés

✅ **Styles de base** (`../styles.css`)
- Variables CSS (couleurs, ombres)
- Boutons (`.btn-primary`, `.btn-secondary`)
- Toast notifications
- Layout de base

✅ **Grille produits**
- Design adapté pour sélection
- Badge "selected" ajouté
- Interaction clic simplifiée

✅ **Système de toast**
- Fonction `showToast(message, type)`
- Types: `success`, `error`, `info`
- Auto-dismiss après 3s

## 🔒 Sécurité

### Frontend

✅ **Vérification rôle**
```javascript
// Décode JWT, vérifie role === 'waiter'
checkWaiterAuth()
```

✅ **Gestion token expiré**
```javascript
// Si 401: logout + redirection
if (response.status === 401) {
  localStorage.removeItem('bizon_token');
  window.location.href = '../index.html';
}
```

✅ **Permissions insuffisantes**
```javascript
// Si 403: toast d'erreur
if (response.status === 403) {
  showToast('Accès refusé: permissions insuffisantes', 'error');
}
```

### Backend (déjà en place)

✅ Middleware `auth` vérifie JWT
✅ Middleware `roleCheck(['waiter'])` sur routes
✅ Middleware `tenantIsolation` filtre par restaurant_id

## 🎨 UX

### Principes appliqués

✅ **1 action principale par écran**
- Liste: "Nouvelle Commande"
- Nouvelle: "Envoyer en cuisine"
- Détail: "Annuler" (si possible)

✅ **Feedback immédiat**
- Toast après chaque action
- Loading states sur boutons
- Badges de statut colorés

✅ **Prévention erreurs**
- Validation formulaire
- Boutons désactivés si invalide
- Modal de confirmation (actions critiques)

✅ **Navigation claire**
- Boutons "← Retour" visibles
- Breadcrumb dans header (badge "SERVEUR")
- Pages bien séparées

### Design épuré

- **Couleurs**: Rouge Bizon (#e63946) + gris neutres
- **Typographie**: System fonts (rapide)
- **Espacement**: Généreux (touch-friendly)
- **Responsive**: Mobile + tablette + desktop

## 📱 Responsive

### Breakpoint: 768px

**Mobile**:
- Grille 1 colonne (commandes)
- Produits: 2-3 colonnes
- Actions: full width
- Filtres: scroll horizontal

**Desktop**:
- Grille multi-colonnes
- Produits: 4-5 colonnes
- Actions: inline
- Filtres: flex wrap

## 🧪 Test manuel

### 1. Créer un utilisateur serveur (via backend)

**Option A: Utiliser script SQL**
```sql
-- Insérer un serveur dans la table users
INSERT INTO users (restaurant_id, email, password, first_name, last_name, role)
VALUES (1, 'serveur@test.com', '$2b$10$...', 'Jean', 'Martin', 'waiter');
```

**Option B: Via API (si endpoint d'admin existe)**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -d '{
    "email": "serveur@test.com",
    "password": "test1234",
    "firstName": "Jean",
    "lastName": "Martin",
    "role": "waiter"
  }'
```

### 2. Connexion serveur

1. Aller sur `http://localhost:8080/index.html`
2. Cliquer "Connexion"
3. Email: `serveur@test.com`
4. Password: `test1234`
5. Backend retourne token avec `role: 'waiter'`

### 3. Redirection manuelle

**Après login, rediriger vers**:
```
http://localhost:8080/waiter/waiter.html
```

### 4. Tester les fonctionnalités

✅ **Liste commandes**:
- Voir les commandes existantes
- Filtrer par statut
- Vérifier auto-refresh (attendre 30s)

✅ **Nouvelle commande**:
- Cliquer "Nouvelle Commande"
- Remplir table: `5`
- Sélectionner 2-3 produits
- Modifier quantités (+/-)
- Vérifier total mis à jour
- Cliquer "Envoyer en cuisine"
- Vérifier toast de succès
- Vérifier retour à la liste

✅ **Détail commande**:
- Cliquer sur une commande
- Vérifier toutes les infos
- Si `confirmed`: tester annulation
- Vérifier modal de confirmation
- Vérifier toast après annulation

✅ **Déconnexion**:
- Cliquer "Déconnexion"
- Vérifier redirection vers index.html
- Vérifier token supprimé du localStorage

## 🚫 Restrictions appliquées

✅ **Pas de paiement** → Aucun bouton/page paiement
✅ **Pas de stats** → Pas d'accès aux statistiques resto
✅ **Pas de gestion produits** → Lecture seule du catalogue
✅ **Pas de gestion utilisateurs** → Pas d'accès admin
✅ **Pas de données financières globales** → Uniquement montants des commandes individuelles

## 🔄 Intégration avec PWA client

### Modifications à apporter dans `pwa/app.js`

**Ajouter après login**:

```javascript
// Dans la fonction login, après success
async function login(email, password) {
    const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    
    state.token = data.token;
    state.user = data.user;
    
    localStorage.setItem('bizon_token', data.token);
    
    // AJOUTER CETTE LOGIQUE
    if (data.user.role === 'waiter') {
        // Redirection vers espace serveur
        window.location.href = 'waiter/waiter.html';
        return;
    }
    
    // Sinon, comportement normal (client/owner)
    showPage('menu');
    await loadProducts();
}
```

## 📊 Endpoints utilisés

| Méthode | Endpoint | Description | Rôle requis |
|---------|----------|-------------|-------------|
| GET | `/api/orders?role=waiter&status=...` | Liste commandes serveur | waiter |
| GET | `/api/orders/:id` | Détail commande | waiter |
| POST | `/api/orders` | Créer commande | waiter |
| PATCH | `/api/orders/:id/cancel` | Annuler commande | waiter |
| GET | `/api/products` | Liste produits | waiter |
| GET | `/api/menus` | Liste catégories | waiter |

**Note**: Backend doit autoriser le rôle `waiter` sur ces endpoints.

## 🐛 Gestion d'erreurs

### Types d'erreurs gérées

✅ **Token manquant/invalide**
- Redirection vers login
- Message clair dans console

✅ **Token expiré (401)**
- Toast "Session expirée"
- Logout auto après 1.5s
- Redirection login

✅ **Permissions insuffisantes (403)**
- Toast "Accès refusé"
- Pas de redirection (reste sur page)

✅ **Erreurs API (400, 404, 500)**
- Toast avec message d'erreur
- État du bouton restauré (si applicable)

✅ **Erreurs réseau**
- Toast "Erreur de connexion"
- Console.error pour debug

## 📝 Points d'amélioration V2

### Non implémentés (hors scope)

❌ **Modification de commande** → Complexe, risque erreur
❌ **Mode offline** → Nécessite Service Worker
❌ **Notifications push** → Backend WebSocket requis
❌ **Historique personnel** → Statistiques serveur
❌ **Photos produits** → Optimisation chargement
❌ **Recherche produits** → Nice-to-have
❌ **Scanner QR code table** → Matériel spécifique

### Évolutions possibles

💡 **Raccourcis clavier** (desktop)
💡 **Swipe actions** (mobile)
💡 **Mode sombre**
💡 **Notes vocales** (commande)
💡 **Impression commande** (cuisine)

## 🚀 Déploiement

### Checklist

✅ Variables d'environnement
```javascript
// Modifier dans waiter.js (ligne 6)
const API_BASE_URL = 'https://api.bizon.com/api';
```

✅ CORS backend
```javascript
// src/server.js
app.use(cors({
    origin: ['https://app.bizon.com', 'http://localhost:8080'],
    credentials: true
}));
```

✅ HTTPS obligatoire en production

✅ Token expiration
```env
JWT_EXPIRES_IN=8h  # Durée shift serveur
```

✅ Rate limiting (éviter abus)

## 🎓 Guide utilisateur serveur

### Workflow type

1. **Arrivée du client**
   - Noter numéro de table

2. **Prise de commande**
   - Ouvrir PWA serveur
   - Cliquer "Nouvelle Commande"
   - Saisir table + nom (optionnel)
   - Sélectionner produits (clic)
   - Ajuster quantités
   - Vérifier total
   - "Envoyer en cuisine"

3. **Suivi**
   - Retour auto à la liste
   - Voir statut en temps réel
   - Badge couleur: Confirmée → En préparation → Prête

4. **Service**
   - Attendre statut "Prête"
   - Servir le client
   - (Paiement géré par caissier)

5. **Annulation** (si besoin)
   - Cliquer sur commande
   - "Annuler la commande"
   - Confirmer dans modal

### Erreurs courantes

❌ **"Le numéro de table est obligatoire"**
→ Remplir le champ table

❌ **"Veuillez sélectionner au moins un produit"**
→ Cliquer sur au moins 1 produit

❌ **"Session expirée"**
→ Se reconnecter

❌ **"Cette commande ne peut plus être modifiée"**
→ Statut `preparing` ou `ready` (trop tard)

---

## 📞 Support technique

**Documentation backend**: `/INSTALLATION.md`
**API complète**: `/API-PWA-MAPPING.md`
**Guide pilotes**: `/GUIDE-RESTAURANTS-PILOTES.md`

**Logs debug**:
- F12 → Console (browser)
- Vérifier token localStorage: `localStorage.getItem('bizon_token')`
- Décoder JWT: https://jwt.io

---

**Version**: 1.0
**Date**: 21 décembre 2025
**Statut**: ✅ Prêt pour tests
