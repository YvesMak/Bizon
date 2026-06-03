# Bizon - Plateforme de Gestion de Commandes et Paiements Mobile Money

[![CI](https://github.com/YvesMak/Bizon/actions/workflows/ci.yml/badge.svg)](https://github.com/YvesMak/Bizon/actions/workflows/ci.yml)

Application SaaS multi-tenant pour la gestion des commandes et des paiements Mobile Money dans les restaurants.

> 🧪 Tests & migrations : voir [`docs/TESTING_AND_MIGRATIONS.md`](docs/TESTING_AND_MIGRATIONS.md).

## 🎯 Vue d'ensemble

Bizon est une solution backend robuste conçue pour gérer:
- Gestion multi-restaurant (isolation des données)
- Authentification et autorisation par rôles
- Menus, catégories et produits
- Gestion automatique des stocks
- Commandes (sur place / à emporter)
- Paiements Mobile Money avec validation par code
- Facturation PDF automatique
- Tableaux de bord et statistiques

## 🏗️ Architecture

```
bizon/
├── src/
│   ├── config/
│   │   └── database.js          # Configuration PostgreSQL + Sequelize
│   ├── models/                  # Modèles Sequelize
│   │   ├── Restaurant.js
│   │   ├── User.js
│   │   ├── Customer.js
│   │   ├── Menu.js
│   │   ├── Category.js
│   │   ├── Product.js
│   │   ├── Order.js
│   │   ├── OrderItem.js
│   │   ├── Payment.js
│   │   ├── Invoice.js
│   │   ├── Subscription.js
│   │   └── index.js             # Relations et init
│   ├── middlewares/
│   │   ├── auth.js              # Authentification JWT
│   │   ├── roleCheck.js         # Vérification des rôles
│   │   └── tenantIsolation.js   # Isolation multi-tenant
│   ├── modules/                 # Modules métier (MVC)
│   │   ├── auth/
│   │   │   ├── controller.js
│   │   │   ├── service.js
│   │   │   └── routes.js
│   │   ├── restaurants/
│   │   ├── menus/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── invoices/
│   │   └── subscriptions/
│   ├── utils/
│   │   ├── pdfGenerator.js      # Génération factures PDF
│   │   └── validators.js        # Validation Joi
│   └── server.js                # Point d'entrée
├── storage/
│   └── invoices/                # Stockage PDF
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 🚀 Installation

### Prérequis

- Node.js >= 18.x
- PostgreSQL >= 14.x
- npm ou yarn

### 1. Cloner et installer

```bash
# Créer le répertoire du projet
mkdir bizon && cd bizon

# Copier tous les fichiers fournis dans ce répertoire

# Installer les dépendances
npm install
```

### 2. Configuration de la base de données

```bash
# Se connecter à PostgreSQL
psql -U postgres

# Créer la base de données
CREATE DATABASE bizon_db;

# Quitter psql
\q
```

### 3. Configuration de l'environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer .env avec vos paramètres
nano .env
```

Variables essentielles:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bizon_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_super_secret_key
```

### 4. Initialiser la base de données

```bash
# Lancer le serveur (les tables seront créées automatiquement en dev)
npm run dev
```

## 📡 API Endpoints

### Authentification (`/api/auth`)

```
POST   /register              # Inscription restaurant + owner
POST   /login                 # Connexion
GET    /profile               # Profil utilisateur (protégé)
PUT    /profile               # Mise à jour profil
POST   /change-password       # Changement de mot de passe
```

### Restaurants (`/api/restaurants`)

```
GET    /                      # Info restaurant
PUT    /                      # Mise à jour restaurant
GET    /stats                 # Statistiques
GET    /users                 # Liste utilisateurs
POST   /users                 # Créer utilisateur
PUT    /users/:userId         # Modifier utilisateur
DELETE /users/:userId         # Supprimer utilisateur
```

### Menus (`/api/menus`)

```
GET    /                      # Liste menus
GET    /:id                   # Détail menu
POST   /                      # Créer menu
PUT    /:id                   # Modifier menu
DELETE /:id                   # Supprimer menu
POST   /:id/categories        # Créer catégorie
PUT    /categories/:categoryId # Modifier catégorie
DELETE /categories/:categoryId # Supprimer catégorie
```

### Produits (`/api/products`)

```
GET    /                      # Liste produits
GET    /:id                   # Détail produit
POST   /                      # Créer produit
PUT    /:id                   # Modifier produit
DELETE /:id                   # Supprimer produit
PATCH  /:id/stock             # Mise à jour stock
```

### Commandes (`/api/orders`)

```
GET    /                      # Liste commandes
GET    /:id                   # Détail commande
POST   /                      # Créer commande
PATCH  /:id/status            # Changer statut
POST   /:id/cancel            # Annuler commande
```

### Paiements (`/api/payments`)

```
POST   /                      # Créer paiement
POST   /:id/verify            # Vérifier paiement Mobile Money
GET    /order/:orderId        # Paiements d'une commande
```

### Factures (`/api/invoices`)

```
GET    /                      # Liste factures
GET    /:id                   # Détail facture
GET    /:id/pdf               # Télécharger PDF
POST   /:id/regenerate        # Régénérer PDF
```

### Subscriptions (`/api/subscriptions`)

```
GET    /                      # Info subscription
GET    /limits                # Vérifier limites
```

## 🔐 Authentification et Autorisation

### Rôles utilisateurs

- **owner**: Propriétaire du restaurant (tous droits)
- **manager**: Gérant (gestion opérationnelle)
- **waiter**: Serveur (prise de commandes)
- **cashier**: Caissier (gestion paiements)

### Utilisation du JWT

Toutes les routes protégées nécessitent un header:

```
Authorization: Bearer <token>
```

### Isolation multi-tenant

Chaque requête est automatiquement filtrée par `restaurant_id` via le middleware `tenantIsolation`.

## 💡 Flux métier critiques

### 1. Création de commande

```javascript
// POST /api/orders
{
  "type": "dine_in",
  "table_number": "5",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 2,
      "notes": "Sans oignon"
    }
  ]
}
```

**Comportement**:
- Vérifie disponibilité des produits
- Vérifie et décrémente automatiquement le stock
- Calcule les totaux (subtotal, TVA 18%, total)
- Génère un numéro de commande unique
- Statut initial: `pending`

### 2. Paiement Mobile Money

```javascript
// POST /api/payments
{
  "order_id": "uuid",
  "amount": 12000,
  "method": "mobile_money",
  "phone_number": "+221701234567",
  "provider": "Orange Money"
}
```

**Puis vérification**:

```javascript
// POST /api/payments/:id/verify
{
  "transaction_code": "MP123456789"
}
```

**Comportement**:
- Validation du code de transaction
- Marque le paiement comme `completed`
- Génère automatiquement la facture PDF
- Met la commande en statut `completed`

### 3. Annulation de commande

```javascript
// POST /api/orders/:id/cancel
```

**Comportement**:
- Restaure automatiquement le stock des produits
- Change le statut en `cancelled`
- Impossible si déjà `completed`

## 🧪 Tests avec VS Code

### 1. Utiliser REST Client Extension

Installer l'extension `REST Client` dans VS Code, puis créer un fichier `test.http`:

```http
### Variables
@baseUrl = http://localhost:3000/api
@token = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

### Inscription
POST {{baseUrl}}/auth/register
Content-Type: application/json

{
  "restaurantName": "Le Délice",
  "email": "owner@delice.com",
  "password": "password123",
  "firstName": "Jean",
  "lastName": "Dupont",
  "phone": "+221701234567"
}

### Connexion
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "owner@delice.com",
  "password": "password123"
}

### Créer produit
POST {{baseUrl}}/products
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "category_id": "uuid-here",
  "name": "Pizza Margherita",
  "price": 5000,
  "stock_quantity": 50
}
```

### 2. Utiliser Postman ou Insomnia

Importer la collection avec tous les endpoints.

## 🔧 Commandes de développement

```bash
# Développement avec rechargement auto
npm run dev

# Production
npm start

# Migrations (à implémenter selon besoins)
npm run migrate

# Seeds (à implémenter selon besoins)
npm run seed
```

## 📊 Modèle de données

### Relations principales

```
Restaurant 1----* User
Restaurant 1----* Customer
Restaurant 1----* Menu 1----* Category 1----* Product
Restaurant 1----* Order 1----* OrderItem *----1 Product
Order 1----* Payment
Order 1----1 Invoice
Restaurant 1----1 Subscription
```

### Statuts

**Order**: `pending` → `confirmed` → `preparing` → `ready` → `completed` / `cancelled`

**Payment**: `pending` → `completed` / `failed` / `refunded`

**Invoice**: `draft` → `issued` → `paid` / `cancelled`

## 🚨 Gestion des erreurs

Toutes les erreurs sont retournées au format:

```json
{
  "error": "Message d'erreur explicite"
}
```

Codes HTTP:
- `400`: Erreur de validation
- `401`: Non authentifié
- `403`: Accès refusé (permissions)
- `404`: Ressource non trouvée
- `500`: Erreur serveur

## 📈 Points d'amélioration future

- Implémentation réelle API Mobile Money (Orange Money, Wave, etc.)
- WebSockets pour notifications temps réel
- Rapports et analytics avancés
- Gestion des promotions et remises
- API de gestion des tables
- Système de réservations
- Intégration imprimante tickets

## 🛠️ Ordre recommandé de développement

1. ✅ Configuration et modèles
2. ✅ Authentification
3. ✅ Restaurants et utilisateurs
4. ✅ Menus et produits
5. ✅ Commandes avec gestion stock
6. ✅ Paiements Mobile Money
7. ✅ Facturation PDF
8. 🔜 Tests unitaires et intégration
9. 🔜 Documentation API complète (Swagger)
10. 🔜 Déploiement

## 📝 License

Propriétaire - Tous droits réservés

---

**Développé pour un MVP fonctionnel et évolutif**
