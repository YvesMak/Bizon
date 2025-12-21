# 🚀 BIZON V2 - ROADMAP & POINTS D'EXTENSION

**Document de planification V2 - SANS CODER**

Identification des points d'extension dans le code MVP actuel pour préparer les futures évolutions sans modifier la logique métier.

---

## 📍 POINTS D'EXTENSION IDENTIFIÉS

### 1. 🔔 NOTIFICATIONS TEMPS RÉEL (WebSockets)

**Objectif**: Mettre à jour automatiquement les interfaces (cuisine, caisse) sans polling

**Points d'intégration dans le code actuel**:

```
src/modules/orders/service.js
├─ Ligne 188-215 : create() → Émettre event "order_created"
├─ Ligne 230-270 : updateStatus() → Émettre event "order_status_changed"  
└─ Ligne 285-340 : cancel() → Émettre event "order_cancelled"

src/modules/payments/service.js
├─ Ligne 7-90 : create() → Émettre event "payment_created"
└─ Ligne 96-185 : verify() → Émettre event "payment_verified"
```

**Architecture proposée**:
```
src/services/
└── websocket/
    ├── server.js          # Serveur Socket.IO
    ├── events.js          # Définition des events
    └── channels.js        # Channels par restaurant (isolation tenant)
```

**Events à implémenter**:
- `order:created` → Notification cuisine
- `order:status_changed` → Update écran serveur/cuisine
- `order:ready` → Notification caisse
- `payment:verified` → Update commande en temps réel
- `stock:low` → Alerte produit en rupture

**Modifications nécessaires**: AUCUNE dans le MVP, juste ajouter `socketService.emit()` après les opérations critiques

---

### 2. 💰 INTÉGRATION API MOBILE MONEY RÉELLE

**Objectif**: Remplacer la validation factice par vraies API Orange Money, Wave, Free Money

**Point d'intégration principal**:

```
src/modules/payments/service.js
└─ Ligne 131-145 : verify() → Actuellement validation factice

// TODO V2: Intégrer avec l'API Mobile Money réelle
// Pour le MVP, on accepte tout code non vide
if (!transactionCode || transactionCode.length < 6) {
  throw new Error('Code de transaction invalide');
}
```

**Architecture proposée**:
```
src/services/mobilemoney/
├── providers/
│   ├── OrangeMoney.js     # API Orange Money Sénégal
│   ├── Wave.js            # API Wave
│   └── FreeMoney.js       # API Free Money
├── MobileMoneyFactory.js   # Factory pattern pour provider
└── types.js               # Types communs (request/response)
```

**Flow proposé**:
1. `create()` → Initier transaction via API provider
2. Provider renvoie `transaction_id` unique
3. Client compose `*144#` (Orange) ou équivalent
4. `verify()` → Appel API provider pour vérifier statut
5. Webhook callback (optionnel) → Update automatique

**Variables d'environnement à ajouter** (.env):
```env
# Orange Money
ORANGE_MONEY_API_URL=https://api.orange.sn/omoney/v1
ORANGE_MONEY_API_KEY=xxx
ORANGE_MONEY_MERCHANT_ID=xxx

# Wave
WAVE_API_URL=https://api.wave.com/v1
WAVE_API_KEY=xxx

# Free Money
FREE_MONEY_API_URL=https://api.freemoney.sn/v1
FREE_MONEY_API_KEY=xxx
```

**Endpoints webhook à créer**:
```
POST /api/webhooks/mobile-money/orange
POST /api/webhooks/mobile-money/wave
POST /api/webhooks/mobile-money/free
```

---

### 3. 🎁 SYSTÈME DE PROMOTIONS & COUPONS

**Objectif**: Remises automatiques, codes promo, fidélité

**Points d'intégration**:

```
src/models/Order.js
└─ Ligne 50-55 : discount_amount existe déjà (prêt pour V2)

src/modules/orders/service.js
└─ Ligne 180-195 : create() → Appliquer promotions avant calcul total
```

**Architecture proposée**:
```
src/models/
├── Promotion.js           # Règles de promotion
├── Coupon.js             # Codes promo uniques
└── CustomerLoyalty.js    # Points fidélité

src/modules/promotions/
├── service.js            # Logique application promotions
├── controller.js         # CRUD promotions
└── routes.js
```

**Schéma Promotion (nouveau modèle)**:
```javascript
{
  id: UUID,
  restaurant_id: UUID,
  name: "Happy Hour",
  type: "percentage|fixed|buy_x_get_y",
  value: 20, // 20% ou 2000 FCFA
  conditions: {
    min_amount: 5000,
    days: ["friday", "saturday"],
    hours: ["18:00", "21:00"],
    categories: ["uuid1", "uuid2"],
    products: ["uuid3"]
  },
  start_date: DATE,
  end_date: DATE,
  max_uses: 100,
  uses_count: 45,
  is_active: true
}
```

**Logique d'application dans OrderService.create()**:
```javascript
// AVANT calcul total (après validation items)
const applicablePromotions = await PromotionService.findApplicable(
  restaurantId, 
  validatedItems, 
  subtotal,
  new Date()
);

let discountAmount = 0;
if (applicablePromotions.length > 0) {
  discountAmount = PromotionService.calculateDiscount(
    applicablePromotions[0], 
    subtotal
  );
}

// Calcul avec discount
const taxAmount = subtotal * 0.18;
const totalAmount = subtotal + taxAmount - discountAmount;
```

**Points de modification**:
- ✅ Pas de modification du schéma Order (discount_amount existe)
- ✅ Ajouter appel PromotionService dans create() uniquement
- ✅ Afficher promotions appliquées dans facture PDF

---

### 4. 📊 ANALYTICS AVANCÉES

**Objectif**: Tableaux de bord détaillés, tendances, prévisions

**Point d'extension**:

```
src/modules/restaurants/service.js
└─ Ligne 123-200 : getStats() → Stats basiques actuelles
```

**Architecture proposée**:
```
src/modules/analytics/
├── service.js
├── reports/
│   ├── SalesReport.js        # Rapport ventes
│   ├── ProductReport.js      # Produits populaires
│   ├── CustomerReport.js     # Comportement clients
│   └── StaffReport.js        # Performance équipe
└── charts/
    ├── TimeSeriesChart.js    # Évolution temporelle
    └── Aggregator.js         # Agrégations complexes
```

**Nouvelles métriques**:
- Ventes par heure/jour/semaine/mois
- Produits les plus vendus / rentables
- Panier moyen par type de commande
- Taux de conversion (commandes/visites)
- Temps moyen de préparation
- Performance par serveur/caissier
- Prévisions de vente (ML basique)

**Endpoints à créer**:
```
GET /api/analytics/sales?period=week&group_by=day
GET /api/analytics/products/top?limit=10&metric=revenue
GET /api/analytics/customers/behavior
GET /api/analytics/staff/performance?user_id=xxx
```

---

### 5. 📱 NOTIFICATIONS PUSH (PWA)

**Objectif**: Alertes mobiles pour serveurs/caissiers

**Points d'intégration**:

```
src/modules/orders/service.js
└─ Après création/changement statut → Envoyer push

src/modules/payments/service.js
└─ Après paiement vérifié → Notification caisse
```

**Architecture proposée**:
```
src/services/notifications/
├── PushService.js         # Service push notifications
├── providers/
│   ├── Firebase.js        # Firebase Cloud Messaging
│   └── OneSignal.js       # Alternative OneSignal
└── templates.js           # Templates de notifications
```

**Flow**:
1. PWA s'abonne aux notifications (permission utilisateur)
2. Token stocké en DB (table `user_devices`)
3. Backend envoie via FCM/OneSignal
4. PWA affiche notification même app fermée

**Schéma UserDevice (nouveau modèle)**:
```javascript
{
  id: UUID,
  user_id: UUID,
  device_token: STRING,   // FCM token
  device_type: "android|ios|web",
  is_active: true,
  last_used_at: DATE
}
```

---

### 6. 🗄️ MIGRATIONS SEQUELIZE FORMELLES

**Objectif**: Remplacer `sync()` par migrations versionnées

**Point actuel**:

```
src/server.js
└─ Ligne 75-77 : sync({ alter: false }) en développement
```

**Architecture proposée**:
```
src/migrations/
├── 001-create-restaurants.js
├── 002-create-users.js
├── 003-create-menus.js
├── 004-create-categories.js
├── 005-create-products.js
├── 006-create-orders.js
├── 007-create-order-items.js
├── 008-create-payments.js
├── 009-create-invoices.js
├── 010-create-subscriptions.js
├── 011-add-promotions.js           # V2
├── 012-add-customer-loyalty.js     # V2
└── 013-add-user-devices.js         # V2
```

**Commandes à ajouter** (package.json):
```json
"scripts": {
  "migrate": "sequelize-cli db:migrate",
  "migrate:undo": "sequelize-cli db:migrate:undo",
  "migrate:status": "sequelize-cli db:migrate:status"
}
```

**Avantages**:
- ✅ Historique des changements DB
- ✅ Rollback possible
- ✅ Synchronisation équipe
- ✅ Déploiement production sûr

---

### 7. 🔍 RECHERCHE & FILTRES AVANCÉS

**Objectif**: Recherche full-text produits, filtres multi-critères

**Points d'extension**:

```
src/modules/products/service.js
└─ getAll() → Ajouter recherche + filtres avancés

src/modules/orders/service.js
└─ getAll() → Filtres actuels basiques (status, type, date)
```

**Fonctionnalités à ajouter**:
- Recherche full-text nom/description produits
- Filtres: catégorie, prix min/max, disponibilité, stock
- Tri: popularité, prix, alphabétique
- Pagination performante (cursor-based)

**Extension requête**:
```javascript
// Actuellement
async getAll(restaurantId, filters = {})

// V2
async getAll(restaurantId, filters = {
  // Existants
  status,
  type,
  startDate,
  endDate,
  
  // Nouveaux
  search,           // Full-text
  category_id,      // Filtrer par catégorie
  min_price,
  max_price,
  in_stock_only,
  sort_by,          // price|name|created_at|popularity
  sort_order,       // asc|desc
  page,
  per_page
})
```

**Indexation PostgreSQL**:
```sql
-- Index full-text
CREATE INDEX idx_products_search ON products 
USING GIN(to_tsvector('french', name || ' ' || description));

-- Index composite pour filtres
CREATE INDEX idx_products_filters ON products 
(restaurant_id, category_id, is_available, price);
```

---

### 8. 👥 GESTION CLIENTS AVANCÉE

**Objectif**: CRM basique, historique, préférences

**Point d'extension**:

```
src/models/Customer.js
└─ Schéma basique actuel (first_name, last_name, phone, email)
```

**Enrichissements proposés**:
- Historique commandes complet
- Produits favoris (fréquence)
- Préférences (allergies, notes spéciales)
- Adresses de livraison multiples
- Programme fidélité (points, récompenses)

**Nouveaux modèles**:
```
CustomerPreference.js    # Préférences alimentaires
CustomerAddress.js       # Adresses livraison
CustomerFavorite.js      # Produits favoris
```

**Endpoints à ajouter**:
```
GET /api/customers/:id/orders           # Historique
GET /api/customers/:id/favorites        # Favoris
GET /api/customers/:id/loyalty-points   # Points fidélité
POST /api/customers/:id/addresses       # Ajouter adresse
```

---

### 9. 🚚 MODULE LIVRAISON (Delivery)

**Objectif**: Gestion livraisons à domicile

**Points d'extension**:

```
src/models/Order.js
└─ type: 'dine_in' | 'takeaway' → Ajouter 'delivery'

src/models/Customer.js
└─ Ajouter relation avec CustomerAddress
```

**Nouveaux modèles**:
```javascript
Delivery.js {
  id: UUID,
  order_id: UUID,
  address_id: UUID,
  driver_id: UUID,        // Nouveau: livreur
  status: 'pending|assigned|picked_up|delivered',
  estimated_time: INTEGER,  // Minutes
  actual_time: INTEGER,
  delivery_fee: DECIMAL,
  notes: TEXT
}

Driver.js {
  id: UUID,
  restaurant_id: UUID,
  first_name: STRING,
  last_name: STRING,
  phone: STRING,
  vehicle_type: 'bike|moto|car',
  is_available: BOOLEAN,
  current_location: JSONB  // {lat, lng}
}
```

**Workflow livraison**:
1. Commande créée avec `type: 'delivery'`
2. Assigner livreur disponible
3. Tracking temps réel (GPS)
4. Client reçoit notifications
5. Confirmation livraison

---

### 10. 📄 EXPORTS & RAPPORTS

**Objectif**: Export Excel/PDF, rapports comptables

**Points d'extension**:

```
src/modules/invoices/service.js
└─ generate() → Déjà génération PDF

src/modules/restaurants/service.js
└─ getStats() → Données pour rapports
```

**Formats à supporter**:
- Excel (XLSX) : Ventes, inventaire, staff
- PDF : Rapports comptables mensuels
- CSV : Export données brutes

**Nouveaux endpoints**:
```
GET /api/exports/sales?format=xlsx&period=month
GET /api/exports/inventory?format=csv
GET /api/reports/accounting?month=12&year=2025
```

**Librairies à ajouter**:
```json
"dependencies": {
  "exceljs": "^4.3.0",      // Génération Excel
  "csv-writer": "^1.6.0"     // Export CSV
}
```

---

## 🗂️ NOUVEAUX MODÈLES V2

Résumé des tables à créer :

```
promotions          # Règles promotions
coupons            # Codes promo
customer_loyalty   # Points fidélité
customer_preferences # Préférences clients
customer_addresses  # Adresses livraison
deliveries         # Livraisons
drivers            # Livreurs
user_devices       # Tokens push notifications
notifications      # Historique notifications
audit_logs         # Logs d'audit sécurité
```

---

## 📋 FEATURES HORS-SCOPE MVP

Liste des fonctionnalités identifiées mais **NON prioritaires** pour V2 :

### Basse Priorité V2
- [ ] Module réservations de tables
- [ ] Gestion des fournisseurs
- [ ] Inventaire matières premières
- [ ] Planning équipe / horaires
- [ ] Chat support intégré
- [ ] Marketplace add-ons

### Très Basse Priorité (V3+)
- [ ] Multi-restaurants (franchises)
- [ ] API publique pour partenaires
- [ ] White-label / Rebranding
- [ ] IA prédiction de demande
- [ ] Intégration comptabilité (Sage, etc.)
- [ ] Support multi-devises

---

## 🔧 MIGRATIONS DB NÉCESSAIRES V2

### Migration 011: Ajout Promotions
```sql
CREATE TABLE promotions (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  name VARCHAR(100),
  type VARCHAR(20),  -- percentage, fixed, buy_x_get_y
  value DECIMAL(10,2),
  conditions JSONB,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Migration 012: Customer Loyalty
```sql
CREATE TABLE customer_loyalty (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  restaurant_id UUID REFERENCES restaurants(id),
  points INTEGER DEFAULT 0,
  tier VARCHAR(20) DEFAULT 'bronze',  -- bronze, silver, gold, platinum
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(customer_id, restaurant_id)
);
```

### Migration 013: User Devices (Push)
```sql
CREATE TABLE user_devices (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  device_token VARCHAR(255) UNIQUE,
  device_type VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP
);
```

### Migration 014: Deliveries
```sql
CREATE TABLE deliveries (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  driver_id UUID REFERENCES drivers(id),
  address_id UUID REFERENCES customer_addresses(id),
  status VARCHAR(20),
  estimated_time INTEGER,
  actual_time INTEGER,
  delivery_fee DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE drivers (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  phone VARCHAR(20),
  vehicle_type VARCHAR(20),
  is_available BOOLEAN DEFAULT true,
  current_location JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 📝 MARQUAGE TODO V2 DANS LE CODE

### Emplacements stratégiques :

#### src/modules/payments/service.js
```javascript
// TODO V2: Remplacer par intégration API Mobile Money réelle
// Voir V2-ROADMAP.md section "Intégration API Mobile Money"
if (!transactionCode || transactionCode.length < 6) {
  throw new Error('Code de transaction invalide');
}
```

#### src/modules/orders/service.js
```javascript
// TODO V2: Appliquer promotions ici avant calcul total
// Voir V2-ROADMAP.md section "Système de Promotions"
const taxAmount = subtotal * 0.18;
const totalAmount = subtotal + taxAmount;
```

```javascript
// TODO V2: Émettre WebSocket event "order_created"
// Voir V2-ROADMAP.md section "Notifications Temps Réel"
await logger.info('ORDER_CREATED', {...});
```

```javascript
// TODO V2: Émettre WebSocket event "order_status_changed"
// Voir V2-ROADMAP.md section "Notifications Temps Réel"
await order.update(updateData);
```

#### src/server.js
```javascript
// TODO V2: Remplacer sync() par migrations Sequelize
// Voir V2-ROADMAP.md section "Migrations Formelles"
if (process.env.NODE_ENV === 'development') {
  await sequelize.sync({ alter: false });
}
```

#### src/modules/restaurants/service.js
```javascript
// TODO V2: Ajouter analytics avancées (tendances, prévisions)
// Voir V2-ROADMAP.md section "Analytics Avancées"
async getStats(restaurantId) {
  // Stats basiques MVP
}
```

---

## 🎯 PRIORITÉS V2 (Recommandations)

### Phase 1 (Critique pour croissance)
1. **Intégration Mobile Money réelle** ⭐⭐⭐⭐⭐
   - Requis pour production Sénégal
   - Effort: 2 semaines
   
2. **WebSockets temps réel** ⭐⭐⭐⭐⭐
   - Améliore UX cuisine/caisse drastiquement
   - Effort: 1 semaine

3. **Migrations Sequelize** ⭐⭐⭐⭐
   - Requis avant production
   - Effort: 3 jours

### Phase 2 (Valeur ajoutée)
4. **Promotions & Coupons** ⭐⭐⭐⭐
   - Différenciateur commercial
   - Effort: 2 semaines

5. **Analytics avancées** ⭐⭐⭐⭐
   - Aide décision restaurateurs
   - Effort: 1 semaine

6. **Push Notifications** ⭐⭐⭐
   - Améliore réactivité équipe
   - Effort: 3 jours

### Phase 3 (Extensions)
7. **Module Livraison** ⭐⭐⭐
   - Nouveau canal de revenus
   - Effort: 3 semaines

8. **CRM Clients avancé** ⭐⭐
   - Fidélisation
   - Effort: 2 semaines

9. **Exports & Rapports** ⭐⭐
   - Conformité comptable
   - Effort: 1 semaine

---

## 🏗️ ARCHITECTURE ÉVOLUTIVE

### Principes conservés du MVP :
✅ Multi-tenancy strict (restaurant_id partout)
✅ Séparation Controller/Service  
✅ Transactions atomiques Sequelize
✅ Middlewares (auth, roleCheck, tenantIsolation)
✅ Logging structuré Winston

### Évolutions architecture V2 :

```
src/
├── config/
│   ├── database.js
│   ├── logger.js
│   └── websocket.js        # ➕ Nouveau
│
├── services/              # ➕ Nouveau: Services transverses
│   ├── websocket/
│   ├── mobilemoney/
│   ├── notifications/
│   └── analytics/
│
├── migrations/            # ➕ Nouveau: Migrations Sequelize
│   ├── 001-create-restaurants.js
│   └── ...
│
├── modules/
│   ├── promotions/        # ➕ Nouveau
│   ├── deliveries/        # ➕ Nouveau
│   ├── analytics/         # ➕ Nouveau
│   └── ... (existants)
│
└── utils/
    ├── pdfGenerator.js
    ├── excelGenerator.js  # ➕ Nouveau
    └── csvExporter.js     # ➕ Nouveau
```

---

## ✅ CHECKLIST AVANT DÉMARRAGE V2

Avant de coder la V2, s'assurer que :

- [ ] MVP en production stable (0 bugs critiques)
- [ ] Au moins 10 restaurants utilisateurs actifs
- [ ] Feedback terrain collecté et analysé
- [ ] Priorisation features validée avec stakeholders
- [ ] Budget/resources alloués pour 3 mois dev
- [ ] Tests automatisés MVP > 80% coverage
- [ ] Documentation technique à jour
- [ ] Plan de migration DB testé en staging

---

**Document généré le 20 décembre 2025 - ÉTAPE 5**
**Prochaine étape**: ÉTAPE 6 - Tests terrain avec restaurants pilotes
