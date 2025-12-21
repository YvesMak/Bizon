# Bizon Backend - Instructions pour Agents IA

## Vue d'ensemble du projet

Bizon est une plateforme SaaS **multi-tenant** de gestion de commandes et paiements Mobile Money pour restaurants. L'architecture repose sur Node.js/Express + PostgreSQL/Sequelize avec une **isolation stricte des données par restaurant**.

## Architecture et patterns clés

### 1. Multi-tenancy par restaurant_id

**Chaque requête DOIT être filtrée par `restaurant_id`**. Le middleware `tenantIsolation` injecte automatiquement `req.restaurantId` depuis le JWT.

```javascript
// ✅ TOUJOURS filtrer par restaurant_id
const products = await Product.findAll({
  where: { restaurant_id: req.restaurantId }
});

// ❌ JAMAIS de requêtes globales sans filtre
const products = await Product.findAll(); // ERREUR: fuite de données
```

### 2. Séparation Controller / Service

- **Controllers** (`controller.js`): Gestion HTTP uniquement (req/res)
- **Services** (`service.js`): Logique métier pure (réutilisable, testable)

```javascript
// Controller
async create(req, res) {
  try {
    const product = await ProductService.create(req.restaurantId, req.body);
    res.status(201).json({ message: 'Produit créé', product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// Service
async create(restaurantId, data) {
  // Logique métier ici
  return await Product.create({ restaurant_id: restaurantId, ...data });
}
```

### 3. Relations Sequelize

Toujours utiliser les associations définies dans `src/models/index.js`:

```javascript
// ✅ Utiliser include avec alias défini
const order = await Order.findOne({
  where: { id, restaurant_id: restaurantId },
  include: [
    { model: OrderItem, as: 'items' },
    { model: Customer, as: 'customer' }
  ]
});
```

### 4. Gestion automatique du stock

**Règle critique**: La création/annulation de commande gère automatiquement le stock dans `OrderService`.

```javascript
// OrderService.create() décrémente le stock (avec transaction)
// OrderService.cancel() restaure le stock (avec transaction)
// ⚠️ NE PAS modifier le stock manuellement dans les commandes
```

Vérification avant commande (dans `OrderService.create()`):
```javascript
if (product.track_stock && product.stock_quantity < item.quantity) {
  throw new Error(`Stock insuffisant pour "${product.name}"`);
}
// Puis décrémentation automatique
await product.update({ stock_quantity: product.stock_quantity - item.quantity }, { transaction });
```

Pour ajustements manuels du stock (inventaire), utiliser:
```javascript
await ProductService.updateStock(restaurantId, productId, quantity, 'add' | 'subtract');
```

### 5. Workflow de paiement Mobile Money

Flux en 2 étapes obligatoire:

1. **Création** (`POST /api/payments`): statut `pending`
2. **Vérification** (`POST /api/payments/:id/verify`): 
   - Valide le code de transaction
   - Passe en `completed`
   - Génère la facture PDF
   - Complète la commande

```javascript
// Après vérification réussie:
await InvoiceService.generate(restaurantId, payment.order_id);
await order.update({ status: 'completed', completed_at: new Date() });
```

### 6. Génération de factures

Les factures sont générées **automatiquement** après paiement confirmé via `InvoiceService.generate()`.

Stockage: `storage/invoices/invoice_INV-YYYYMM-XXXXX.pdf`

## Conventions de code

### Nommage

- Modèles: PascalCase (`Restaurant`, `OrderItem`)
- Services/Controllers: camelCase exports (`new AuthController()`)
- Fichiers: camelCase (`pdfGenerator.js`)
- Routes: kebab-case (`/api/order-items`)

### Gestion des erreurs

Toujours throw dans les services, catch dans les controllers:

```javascript
// Service
if (!user) throw new Error('Utilisateur non trouvé');

// Controller
try {
  const result = await Service.method();
  res.json(result);
} catch (error) {
  res.status(400).json({ error: error.message });
}
```

### Transactions Sequelize

Utiliser des transactions pour les opérations multi-tables (création/annulation de commandes, paiements):

```javascript
const transaction = await sequelize.transaction();
try {
  await Model1.create(data, { transaction });
  await Model2.update(data, { where: {...}, transaction });
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

**Important**: Toujours importer depuis `config/database`:
```javascript
const { sequelize } = require('../../config/database');
```

## Commandes essentielles

```bash
# Développement
npm run dev              # Lance avec nodemon

# Production
npm start                # Lance server.js

# Structure projet
src/
├── config/              # DB config
├── models/              # Sequelize models + relations
├── middlewares/         # auth, roleCheck, tenantIsolation
├── modules/             # Modules métier (auth, orders, etc.)
│   └── [module]/
│       ├── controller.js
│       ├── service.js
│       └── routes.js
└── utils/               # pdfGenerator, validators
```

## Middlewares de protection

Ordre d'application sur les routes protégées:

```javascript
router.use(auth, tenantIsolation);
router.post('/', roleCheck(['owner', 'manager']), Controller.create);
```

1. `auth`: Vérifie JWT, injecte `req.user` et `req.restaurantId`
2. `tenantIsolation`: Ajoute auto `restaurant_id` aux POST
3. `roleCheck(['roles'])`: Vérifie le rôle

## Pièges à éviter

❌ **Ne pas filtrer par restaurant_id**
```javascript
const order = await Order.findByPk(orderId); // ERREUR: pas de filtre tenant
```

✅ **Toujours inclure restaurant_id**
```javascript
const order = await Order.findOne({
  where: { id: orderId, restaurant_id: restaurantId }
});
```

❌ **Modifier le stock directement**
```javascript
await product.update({ stock_quantity: newValue }); // ERREUR: perte de traçabilité
```

✅ **Utiliser ProductService**
```javascript
await ProductService.updateStock(restaurantId, productId, quantity, 'add');
```

❌ **Générer facture manuellement**
```javascript
await Invoice.create({...}); // ERREUR: pas de PDF généré
```

✅ **Utiliser InvoiceService**
```javascript
await InvoiceService.generate(restaurantId, orderId);
```

## Ajout d'une nouvelle fonctionnalité

1. **Créer le modèle** dans `src/models/` si nécessaire
2. **Ajouter les relations** dans `src/models/index.js`
3. **Créer le module** `src/modules/[nom]/`:
   - `service.js`: Logique métier
   - `controller.js`: Handlers HTTP
   - `routes.js`: Définition endpoints
4. **Importer routes** dans `src/server.js`:
   ```javascript
   app.use('/api/[nom]', require('./modules/[nom]/routes'));
   ```
5. **Appliquer middlewares** sur les routes

## Variables d'environnement critiques

Voir `.env.example` pour la liste complète. Essentielles:

```env
# Obligatoire
JWT_SECRET=              # Clé signature JWT (DOIT être changée en prod)
DB_NAME=bizon_db         # Nom base de données
DB_USER=postgres         # User PostgreSQL
DB_PASSWORD=             # Mot de passe PostgreSQL

# Configuration
PORT=3000                # Port serveur (défaut: 3000)
NODE_ENV=development     # Mode: development | production
JWT_EXPIRES_IN=7d        # Durée validité token

# Stockage
INVOICE_STORAGE_PATH=./storage/invoices  # Chemin stockage PDF
```

## Référence rapide des statuts

**Order**: `pending` → `confirmed` → `preparing` → `ready` → `completed` | `cancelled`

**Payment**: `pending` → `completed` | `failed` | `refunded`

**Invoice**: `draft` → `issued` → `paid` | `cancelled`

Transitions validées dans `OrderService.updateStatus()`.

## Points d'extension future

- Intégration API Mobile Money réelle (remplacer la validation factice)
- WebSockets pour notifications temps réel
- Migrations Sequelize formelles (actuellement `sync()` en dev)
- Tests unitaires et intégration (Jest/Supertest)
- Rate limiting par tenant
- Gestion promotions/coupons

---

**Règle d'or**: En cas de doute sur un flux métier, lire le service correspondant. La logique métier est TOUJOURS dans les services, jamais dans les controllers ou routes.
