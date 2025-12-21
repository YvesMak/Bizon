# 📱 API ↔ PWA MAPPING GUIDE

## 🎯 OBJECTIF

Connecter la PWA existante au backend Bizon avec les endpoints disponibles.

---

## 🔐 AUTHENTIFICATION

### Écran: Login / Inscription

| Écran PWA | Endpoint API | Méthode | Auth | Body |
|-----------|--------------|---------|------|------|
| **Login** | `/api/auth/login` | POST | ❌ | `{email, password}` |
| **Inscription** | `/api/auth/register` | POST | ❌ | `{name, email, password, phone, address}` |
| **Profil** | `/api/auth/profile` | GET | ✅ | - |
| **Modifier profil** | `/api/auth/profile` | PUT | ✅ | `{first_name, last_name, phone}` |
| **Changer password** | `/api/auth/change-password` | POST | ✅ | `{old_password, new_password}` |

**Response Login/Register**:
```json
{
  "token": "eyJhbGci...",
  "user": {
    "id": "uuid",
    "email": "user@email.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "owner|manager|waiter|cashier",
    "restaurant_id": "uuid"
  },
  "restaurant": {
    "id": "uuid",
    "name": "Restaurant Name",
    "slug": "restaurant-name"
  }
}
```

**💡 Action PWA**: Stocker `token` dans localStorage, ajouter à tous les headers: `Authorization: Bearer {token}`

---

## 🍽️ MENU & PRODUITS

### Écran: Menu Principal (Vitrine Client)

**Besoin**: Afficher tous les produits disponibles organisés par catégories

| Action PWA | Endpoint API | Méthode | Auth | Query Params |
|------------|--------------|---------|------|--------------|
| **Charger le menu complet** | `/api/menus` | GET | ✅ | - |
| **Charger les produits** | `/api/products` | GET | ✅ | `?isAvailable=true` |

**Response `/api/menus`**:
```json
[
  {
    "id": "uuid",
    "name": "Menu Principal",
    "is_active": true,
    "categories": [
      {
        "id": "uuid",
        "name": "Plats",
        "description": "Nos spécialités",
        "image_url": null,
        "products": [
          {
            "id": "uuid",
            "name": "Yassa Poulet",
            "description": "Poulet mariné citron oignons",
            "price": "2500.00",
            "image_url": null,
            "stock_quantity": 10,
            "is_available": true
          }
        ]
      }
    ]
  }
]
```

**⚠️ GAP IDENTIFIÉ**: L'endpoint `/api/menus` doit inclure les catégories ET produits (à vérifier dans le service).

**💡 Alternative**: 
1. `GET /api/menus` → Liste menus
2. `GET /api/products?isAvailable=true` → Tous produits disponibles
3. Grouper par `category_id` côté PWA

---

### Écran: Gestion Produits (Admin)

| Action PWA | Endpoint API | Méthode | Auth | Rôle | Body |
|------------|--------------|---------|------|------|------|
| **Liste produits** | `/api/products` | GET | ✅ | Tous | `?categoryId=uuid&search=text` |
| **Détail produit** | `/api/products/:id` | GET | ✅ | Tous | - |
| **Créer produit** | `/api/products` | POST | ✅ | owner, manager | Voir ci-dessous |
| **Modifier produit** | `/api/products/:id` | PUT | ✅ | owner, manager | Voir ci-dessous |
| **Supprimer produit** | `/api/products/:id` | DELETE | ✅ | owner, manager | - |
| **Ajuster stock** | `/api/products/:id/stock` | PATCH | ✅ | owner, manager | `{quantity, operation: 'add'|'subtract'}` |

**Body Création Produit**:
```json
{
  "category_id": "uuid",
  "name": "Yassa Poulet",
  "description": "Poulet mariné",
  "price": 2500,
  "cost_price": 1800,
  "stock_quantity": 50,
  "low_stock_threshold": 10,
  "track_stock": true,
  "is_available": true,
  "image_url": "https://..."
}
```

---

### Écran: Gestion Catégories (Admin)

| Action PWA | Endpoint API | Méthode | Auth | Rôle |
|------------|--------------|---------|------|------|
| **Créer catégorie** | `/api/menus/:menuId/categories` | POST | ✅ | owner, manager |
| **Modifier catégorie** | `/api/menus/categories/:categoryId` | PUT | ✅ | owner, manager |
| **Supprimer catégorie** | `/api/menus/categories/:categoryId` | DELETE | ✅ | owner, manager |

---

## 🛒 COMMANDES

### Écran: Prise de Commande (Serveur/Caisse)

| Action PWA | Endpoint API | Méthode | Auth | Body |
|------------|--------------|---------|------|------|
| **Créer commande** | `/api/orders` | POST | ✅ | Voir ci-dessous |
| **Liste commandes** | `/api/orders` | GET | ✅ | `?status=pending&type=dine_in` |
| **Détail commande** | `/api/orders/:id` | GET | ✅ | - |
| **Changer statut** | `/api/orders/:id/status` | PATCH | ✅ | `{status: 'confirmed|preparing|ready|completed'}` |
| **Annuler commande** | `/api/orders/:id/cancel` | POST | ✅ | - |

**Body Création Commande**:
```json
{
  "customer_id": "uuid-optionnel",
  "type": "dine_in|takeaway",
  "table_number": "5",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 2,
      "notes": "Sans oignon"
    }
  ],
  "notes": "Commande urgente"
}
```

**Response**:
```json
{
  "message": "Commande créée",
  "order": {
    "id": "uuid",
    "order_number": "ORD-20251220-0001",
    "type": "dine_in",
    "status": "pending",
    "table_number": "5",
    "subtotal": "5000.00",
    "tax_amount": "900.00",
    "total_amount": "5900.00",
    "items": [
      {
        "id": "uuid",
        "product_name": "Yassa Poulet",
        "quantity": 2,
        "unit_price": "2500.00",
        "subtotal": "5000.00"
      }
    ],
    "created_at": "2025-12-20T..."
  }
}
```

**🔒 Sécurité**: Stock décrémenté atomiquement à la création.

---

### Écran: Suivi Commandes (Cuisine/Service)

| Écran | Filtre Query | Statut Affiché |
|-------|--------------|----------------|
| **En attente** | `?status=pending` | pending |
| **En préparation** | `?status=preparing` | preparing |
| **Prêtes** | `?status=ready` | ready |
| **Historique** | `?status=completed` | completed |

**Transitions Valides**:
```
pending → confirmed → preparing → ready → completed
         ↓           ↓           ↓
      cancelled   cancelled   cancelled
```

**❌ Annulation impossible si**: `status = 'completed'` OU paiement `status = 'completed'`

---

## 💳 PAIEMENTS

### Écran: Encaissement

| Action PWA | Endpoint API | Méthode | Auth | Body |
|------------|--------------|---------|------|------|
| **Créer paiement** | `/api/payments` | POST | ✅ | Voir ci-dessous |
| **Vérifier paiement MM** | `/api/payments/:id/verify` | POST | ✅ | `{transaction_code}` |
| **Paiements d'une commande** | `/api/payments/order/:orderId` | GET | ✅ | - |

**Body Création Paiement**:
```json
{
  "order_id": "uuid",
  "amount": 5900.00,
  "method": "mobile_money|cash|card",
  "phone_number": "+221771234567",
  "provider": "Orange Money|Wave|Free Money",
  "transaction_code": "OM123456"
}
```

**Response**:
```json
{
  "message": "Paiement créé",
  "payment": {
    "id": "uuid",
    "order_id": "uuid",
    "amount": "5900.00",
    "method": "mobile_money",
    "status": "pending|completed",
    "transaction_code": "OM123456",
    "verified_at": null,
    "created_at": "2025-12-20T..."
  }
}
```

**🔒 Protection Double Paiement**: 
- 1 seul paiement actif (pending/completed) par commande
- Code transaction unique vérifié

### Flux Mobile Money

```
1. Client: Créer paiement → status='pending'
2. Client: Composer *144# + confirmer
3. Serveur: Saisir code transaction
4. API: POST /payments/:id/verify {transaction_code}
5. Backend: 
   ✅ Valide code (unique)
   ✅ Payment status='completed'
   ✅ Génère facture PDF
   ✅ Order status='completed'
6. PWA: Afficher facture
```

---

## 🧾 FACTURES

### Écran: Historique Factures

| Action PWA | Endpoint API | Méthode | Auth | Query |
|------------|--------------|---------|------|-------|
| **Liste factures** | `/api/invoices` | GET | ✅ | `?status=issued&startDate=2025-12-01` |
| **Détail facture** | `/api/invoices/:id` | GET | ✅ | - |
| **Télécharger PDF** | `/api/invoices/:id/pdf` | GET | ✅ | - |
| **Régénérer PDF** | `/api/invoices/:id/regenerate` | POST | ✅ | - |

**Response Liste**:
```json
[
  {
    "id": "uuid",
    "invoice_number": "INV-202512-00001",
    "customer_name": "Client",
    "total_amount": "5900.00",
    "status": "issued|paid",
    "pdf_url": "/storage/invoices/invoice_INV-202512-00001.pdf",
    "issued_at": "2025-12-20T...",
    "order": {
      "id": "uuid",
      "order_number": "ORD-20251220-0001"
    }
  }
]
```

**💡 Téléchargement PDF**: 
- `GET /api/invoices/:id/pdf` → Fichier PDF en stream
- Header: `Content-Type: application/pdf`

---

## 📊 RESTAURANT & STATS

### Écran: Tableau de Bord

| Widget | Endpoint API | Méthode | Auth | Rôle |
|--------|--------------|---------|------|------|
| **Infos restaurant** | `/api/restaurants` | GET | ✅ | Tous |
| **Statistiques** | `/api/restaurants/stats` | GET | ✅ | owner, manager |

**Response Stats**:
```json
{
  "today": {
    "orders_count": 45,
    "revenue": "125000.00",
    "avg_order_value": "2777.78"
  },
  "week": {
    "orders_count": 312,
    "revenue": "890000.00"
  },
  "top_products": [
    {
      "name": "Yassa Poulet",
      "quantity_sold": 89,
      "revenue": "222500.00"
    }
  ],
  "low_stock_products": [
    {
      "name": "Thiéboudienne",
      "stock_quantity": 3,
      "low_stock_threshold": 10
    }
  ]
}
```

**⚠️ GAP IDENTIFIÉ**: Endpoint `/api/restaurants/stats` à vérifier/implémenter.

---

### Écran: Gestion Utilisateurs

| Action PWA | Endpoint API | Méthode | Auth | Rôle |
|------------|--------------|---------|------|------|
| **Liste users** | `/api/restaurants/users` | GET | ✅ | owner, manager |
| **Créer user** | `/api/restaurants/users` | POST | ✅ | owner, manager |
| **Modifier user** | `/api/restaurants/users/:userId` | PUT | ✅ | owner, manager |
| **Supprimer user** | `/api/restaurants/users/:userId` | DELETE | ✅ | owner |

**Body Création User**:
```json
{
  "email": "waiter@restaurant.com",
  "password": "Password123!",
  "first_name": "Jean",
  "last_name": "Dupont",
  "role": "waiter|cashier|manager",
  "phone": "+221771234567"
}
```

---

## 🔔 ABONNEMENTS

### Écran: Mon Abonnement

| Action PWA | Endpoint API | Méthode | Auth |
|------------|--------------|---------|------|
| **Infos abonnement** | `/api/subscriptions` | GET | ✅ |

**Response**:
```json
{
  "plan": "trial|basic|premium|enterprise",
  "status": "active|expired|cancelled",
  "start_date": "2025-12-20",
  "end_date": "2026-01-03",
  "features": {},
  "max_users": 5,
  "max_products": 100
}
```

---

## ❌ GESTION D'ERREURS

### Format Standardisé

**Succès** (2xx):
```json
{
  "message": "Action réussie",
  "data": {...}
}
```

**Erreur** (4xx/5xx):
```json
{
  "error": "Message d'erreur explicite"
}
```

### Codes HTTP à Gérer

| Code | Signification | Action PWA |
|------|---------------|------------|
| **200** | OK | Afficher données |
| **201** | Créé | Redirect ou confirmation |
| **400** | Validation | Afficher erreur sous champ |
| **401** | Non authentifié | Redirect login + clear token |
| **403** | Accès refusé | Message "Permissions insuffisantes" |
| **404** | Non trouvé | Message "Élément introuvable" |
| **409** | Conflit | Ex: "Double paiement détecté" |
| **500** | Erreur serveur | Message générique + retry |

### Messages Exploitables

**❌ À ÉVITER**:
```json
{"error": "Cannot read properties of undefined"}
```

**✅ ACTUELLEMENT** (après corrections):
```json
{"error": "Stock insuffisant pour \"Yassa Poulet\""}
{"error": "Cette commande a déjà été payée"}
{"error": "Un paiement est déjà en attente pour cette commande"}
{"error": "Ce code de transaction a déjà été utilisé"}
{"error": "Impossible d'annuler une commande déjà payée. Effectuez un remboursement."}
```

**💡 Action PWA**: Afficher `error.message` directement dans un toast/alert.

---

## 🔄 FLUX COMPLET: PRISE DE COMMANDE → PAIEMENT

### Séquence End-to-End

```
┌─────────────────────────────────────────────────────────────┐
│ 1. AUTHENTIFICATION                                         │
└─────────────────────────────────────────────────────────────┘
POST /api/auth/login
{email, password}
→ Stocker token

┌─────────────────────────────────────────────────────────────┐
│ 2. CHARGER LE MENU                                          │
└─────────────────────────────────────────────────────────────┘
GET /api/products?isAvailable=true
→ Afficher vitrine

┌─────────────────────────────────────────────────────────────┐
│ 3. CRÉER LA COMMANDE                                        │
└─────────────────────────────────────────────────────────────┘
POST /api/orders
{
  type: 'dine_in',
  table_number: '5',
  items: [{product_id, quantity}]
}
→ Recevoir order_id + total_amount
🔒 Stock décrémenté automatiquement

┌─────────────────────────────────────────────────────────────┐
│ 4. SUIVI CUISINE                                            │
└─────────────────────────────────────────────────────────────┘
PATCH /api/orders/:id/status
{status: 'preparing'}
→ pending → confirmed → preparing → ready

┌─────────────────────────────────────────────────────────────┐
│ 5. PAIEMENT                                                 │
└─────────────────────────────────────────────────────────────┘
POST /api/payments
{
  order_id,
  amount: total_amount,
  method: 'mobile_money',
  phone_number,
  provider
}
→ Recevoir payment_id (status='pending')

┌─────────────────────────────────────────────────────────────┐
│ 6. VÉRIFICATION MOBILE MONEY                                │
└─────────────────────────────────────────────────────────────┘
Client compose *144# et confirme
→ Obtenir code transaction

POST /api/payments/:id/verify
{transaction_code: 'OM123456'}
→ Payment status='completed'
→ Facture générée
→ Order status='completed'

┌─────────────────────────────────────────────────────────────┐
│ 7. FACTURE                                                  │
└─────────────────────────────────────────────────────────────┘
GET /api/invoices/:id/pdf
→ Télécharger PDF ou afficher
```

---

## 🚨 POINTS CRITIQUES À RESPECTER

### 1. Headers Requis

Toutes les requêtes authentifiées:
```javascript
{
  'Authorization': 'Bearer ' + token,
  'Content-Type': 'application/json'
}
```

### 2. Montants

**⚠️ IMPORTANT**: Les montants sont en **DÉCIMAL**, pas en centimes.

```javascript
// ✅ CORRECT
{amount: 2500.00}  // 2500 FCFA

// ❌ FAUX
{amount: 250000}   // Ne pas envoyer en centimes
```

### 3. UUIDs

Tous les IDs sont des **UUIDs v4**, pas des integers.

```javascript
// ✅ CORRECT
product_id: "a3d5f7c9-1b2e-4f8a-9c3d-5e7f8a9b0c1d"

// ❌ FAUX
product_id: 123
```

### 4. Isolation Multi-Tenant

**Automatique**: Le backend filtre TOUT par `restaurant_id` du JWT.

**Action PWA**: Aucune action requise, le backend gère.

### 5. Gestion du Cache

**Recommandations**:
- ✅ Cacher la liste des produits (refresh toutes les 5 min)
- ✅ Cacher le profil utilisateur
- ❌ NE PAS cacher les commandes actives (polling toutes les 10s)
- ❌ NE PAS cacher le stock (temps réel requis)

---

## 📝 CHECKLIST INTÉGRATION PWA

### Avant de Commencer

- [ ] Token JWT stocké dans localStorage
- [ ] Interceptor HTTP pour ajouter `Authorization: Bearer`
- [ ] Gestion erreur 401 → Redirect login
- [ ] Base URL configurée: `http://localhost:3000/api` (dev)

### Par Écran

**Authentification**:
- [ ] Login fonctionnel
- [ ] Stockage token
- [ ] Affichage nom restaurant
- [ ] Logout (clear token)

**Menu**:
- [ ] Affichage produits par catégorie
- [ ] Filtrage disponibles uniquement
- [ ] Affichage prix formatés (2500 FCFA)
- [ ] Gestion images manquantes (placeholder)

**Commande**:
- [ ] Panier fonctionnel
- [ ] Création commande
- [ ] Affichage numéro commande
- [ ] Transitions statuts
- [ ] Annulation (avec message si payée)

**Paiement**:
- [ ] Sélection méthode (Mobile Money, Cash, Card)
- [ ] Saisie code transaction (MM uniquement)
- [ ] Vérification
- [ ] Message double paiement
- [ ] Téléchargement facture

**Admin**:
- [ ] Gestion produits (CRUD)
- [ ] Ajustement stock
- [ ] Statistiques dashboard
- [ ] Gestion utilisateurs

---

## 🆘 DÉPANNAGE

### Erreur: "JWT must be provided"

**Cause**: Token manquant ou invalide

**Solution**: 
```javascript
// Vérifier le header
headers: {
  'Authorization': 'Bearer ' + localStorage.getItem('token')
}
```

### Erreur: "Commande non trouvée"

**Cause**: Mauvais `restaurant_id` (isolation multi-tenant)

**Solution**: Le token contient le bon restaurant_id, vérifier que l'order_id existe.

### Erreur: "Stock insuffisant"

**Cause**: Produit épuisé ou quantité > stock

**Solution**: 
1. Recharger les produits (`GET /api/products`)
2. Afficher stock disponible dans le panier
3. Bloquer quantité > stock_quantity

### Erreur: "Transition de statut invalide"

**Cause**: Changement de statut non autorisé

**Solution**: Respecter la machine d'états:
```
pending → confirmed → preparing → ready → completed
```

---

## 📊 ENDPOINTS MANQUANTS / À VÉRIFIER

### Haute Priorité

1. ⚠️ **GET /api/menus/:id** → Doit inclure categories + products
2. ⚠️ **GET /api/restaurants/stats** → Implémenter si pas déjà fait
3. ⚠️ **GET /api/orders (temps réel)** → Considérer WebSocket pour V2

### Moyenne Priorité

4. 💡 **PATCH /api/products/:id/availability** → Toggle disponibilité rapide
5. 💡 **GET /api/orders/active** → Raccourci pour `status IN (pending,preparing,ready)`

### Basse Priorité (V2)

6. 📅 **GET /api/restaurants/stats/range** → Stats personnalisées par période
7. 🔔 **WebSocket /ws/orders** → Notifications temps réel

---

*Généré le 20 décembre 2025 - ÉTAPE 3*
