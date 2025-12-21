# Guide d'Installation - Bizon Backend

## Vue d'ensemble

Bizon est une plateforme SaaS multi-tenant de gestion de commandes et paiements Mobile Money pour restaurants. Ce guide vous permettra d'installer et de démarrer le backend en moins de 30 minutes.

## Prérequis

### Logiciels nécessaires

- **Node.js** >= 18.0.0 ([télécharger](https://nodejs.org/))
- **PostgreSQL** >= 15.0 ([télécharger](https://www.postgresql.org/download/))
- **npm** (inclus avec Node.js)
- **Git** (optionnel, pour cloner le projet)

### Connaissances recommandées

- Utilisation basique du terminal
- Notions de base en Node.js et PostgreSQL

## Installation pas à pas

### 1. Installer PostgreSQL

#### macOS (avec Homebrew)
```bash
brew install postgresql@15
brew services start postgresql@15
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Windows
Téléchargez l'installeur depuis [postgresql.org](https://www.postgresql.org/download/windows/)

### 2. Créer la base de données

```bash
# Se connecter à PostgreSQL
psql postgres

# Dans psql, créer la base de données
CREATE DATABASE bizon_db;

# Créer un utilisateur (optionnel)
CREATE USER bizon_user WITH PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE bizon_db TO bizon_user;

# Quitter psql
\q
```

### 3. Cloner/télécharger le projet

```bash
# Via Git
git clone <URL_DU_REPO> bizon
cd bizon

# Ou extraire depuis une archive
unzip bizon.zip
cd bizon
```

### 4. Installer les dépendances

```bash
npm install
```

**Attendu** : Installation d'environ 200 packages en ~1 minute

### 5. Configurer l'environnement

Créer le fichier `.env` à la racine du projet :

```bash
# Copier le template
cp .env.example .env
```

**Éditer `.env` avec vos valeurs** :

```env
# Base de données (OBLIGATOIRE)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bizon_db
DB_USER=postgres
DB_PASSWORD=        # Votre mot de passe PostgreSQL (vide si pas configuré)

# JWT (OBLIGATOIRE - CHANGER EN PRODUCTION)
JWT_SECRET=CHANGEZ_CETTE_CLE_SECRETE_EN_PRODUCTION_123456789
JWT_EXPIRES_IN=7d

# Serveur
PORT=3000
NODE_ENV=development

# Stockage
INVOICE_STORAGE_PATH=./storage/invoices

# Logging
LOG_LEVEL=info
```

### 6. Créer les répertoires nécessaires

```bash
mkdir -p storage/invoices
mkdir -p logs
```

### 7. Démarrer le serveur

#### Mode développement (avec auto-reload)
```bash
npm run dev
```

#### Mode production
```bash
npm start
```

**Sortie attendue** :
```
✅ Connexion PostgreSQL établie avec succès
✅ Relations des modèles initialisées
✅ Modèles synchronisés
🚀 Serveur Bizon démarré sur le port 3000
📍 http://localhost:3000
🏥 Health check: http://localhost:3000/health
```

### 8. Vérifier l'installation

#### Test du health check
```bash
curl http://localhost:3000/health
```

**Réponse attendue** :
```json
{
  "status": "ok",
  "timestamp": "2025-12-20T15:00:00.000Z"
}
```

#### Test de création d'un restaurant
```bash
curl -X POST http://localhost:3000/api/onboarding/quick-start \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantName": "Restaurant Test",
    "ownerEmail": "test@example.com",
    "ownerPassword": "SecurePass123!",
    "menuTemplate": "restaurant"
  }'
```

**Réponse attendue** : Un objet JSON avec `message: "Restaurant créé avec succès..."`

## Configuration de production

### Variables d'environnement critiques à modifier

```env
# ⚠️ OBLIGATOIRE : Générer une nouvelle clé secrète
JWT_SECRET=$(openssl rand -base64 64)

# Activer le mode production
NODE_ENV=production

# Désactiver le log debug
LOG_LEVEL=warn

# Configurer la base de données distante
DB_HOST=votre-serveur-db.com
DB_PASSWORD=mot_de_passe_fort
```

### Sécurité PostgreSQL

```sql
-- Créer un utilisateur dédié avec droits limités
CREATE USER bizon_prod WITH PASSWORD 'mot_de_passe_tres_fort';
GRANT CONNECT ON DATABASE bizon_db TO bizon_prod;
GRANT USAGE ON SCHEMA public TO bizon_prod;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bizon_prod;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO bizon_prod;
```

### Reverse proxy (Nginx recommandé)

```nginx
server {
    listen 80;
    server_name api.votre-domaine.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Gestionnaire de processus (PM2)

```bash
# Installer PM2 globalement
npm install -g pm2

# Démarrer avec PM2
pm2 start src/server.js --name bizon-api

# Démarrage automatique au redémarrage
pm2 startup
pm2 save

# Monitoring
pm2 monit
pm2 logs bizon-api
```

## Troubleshooting

### Erreur : "Connection refused" à PostgreSQL

**Cause** : PostgreSQL n'est pas démarré ou les credentials sont incorrects

**Solution** :
```bash
# Vérifier que PostgreSQL tourne
# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql

# Démarrer si arrêté
# macOS
brew services start postgresql@15

# Linux
sudo systemctl start postgresql
```

### Erreur : "Port 3000 already in use"

**Cause** : Un autre processus utilise le port 3000

**Solution** :
```bash
# Trouver le processus
lsof -i :3000

# Le tuer
kill -9 <PID>

# Ou changer le port dans .env
PORT=3001
```

### Erreur : "Cannot find module..."

**Cause** : Dépendances manquantes

**Solution** :
```bash
# Supprimer node_modules et réinstaller
rm -rf node_modules package-lock.json
npm install
```

### Logs vides ou erreurs non affichées

**Cause** : LOG_LEVEL trop restrictif

**Solution** :
```env
# Dans .env
LOG_LEVEL=debug
NODE_ENV=development
```

### Base de données non synchronisée

**Cause** : Schéma désynchronisé avec les modèles

**Solution** :
```bash
# Mode développement uniquement
# Dans .env, ajouter
NODE_ENV=development

# Redémarrer le serveur
# La synchronisation se fera automatiquement
```

⚠️ **En production, utilisez des migrations au lieu de `sync()`**

## Test de validation complet

Script pour valider l'installation :

```bash
#!/bin/bash
# test-installation.sh

echo "🔍 Test d'installation Bizon..."

# 1. Health check
echo "1/5 Test health check..."
HEALTH=$(curl -s http://localhost:3000/health | jq -r '.status')
if [ "$HEALTH" != "ok" ]; then
  echo "❌ Health check échoué"
  exit 1
fi
echo "✅ Health check OK"

# 2. Templates disponibles
echo "2/5 Test templates..."
TEMPLATES=$(curl -s http://localhost:3000/api/onboarding/templates | jq '.templates | length')
if [ "$TEMPLATES" -lt 3 ]; then
  echo "❌ Templates manquants"
  exit 1
fi
echo "✅ Templates OK ($TEMPLATES templates)"

# 3. Création restaurant
echo "3/5 Test création restaurant..."
RESTAURANT=$(curl -s -X POST http://localhost:3000/api/onboarding/quick-start \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantName": "Test Installation '$(date +%s)'",
    "ownerEmail": "test'$(date +%s)'@bizon.test",
    "ownerPassword": "TestPass123!",
    "menuTemplate": "fast-food"
  }' | jq -r '.data.restaurant.id')

if [ -z "$RESTAURANT" ] || [ "$RESTAURANT" == "null" ]; then
  echo "❌ Création restaurant échouée"
  exit 1
fi
echo "✅ Restaurant créé (ID: $RESTAURANT)"

# 4. Login
echo "4/5 Test authentification..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"test$(date +%s)@bizon.test\",
    \"password\": \"TestPass123!\"
  }" | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Authentification échouée"
  exit 1
fi
echo "✅ Authentification OK"

# 5. Accès menu
echo "5/5 Test accès menu..."
MENUS=$(curl -s http://localhost:3000/api/menus \
  -H "Authorization: Bearer $TOKEN" | jq '. | length')

if [ "$MENUS" -lt 1 ]; then
  echo "❌ Accès menu échoué"
  exit 1
fi
echo "✅ Menu accessible ($MENUS menus)"

echo ""
echo "🎉 Installation validée avec succès !"
echo "✅ Tous les tests sont passés"
```

Rendre le script exécutable et le lancer :
```bash
chmod +x test-installation.sh
./test-installation.sh
```

## Endpoints disponibles

Une fois installé, ces endpoints sont disponibles :

### Publics (sans authentification)
- `GET /health` - Health check
- `POST /api/auth/register` - Inscription (méthode alternative)
- `POST /api/auth/login` - Connexion
- `POST /api/onboarding/quick-start` - Création restaurant rapide
- `GET /api/onboarding/templates` - Liste des templates de menu

### Protégés (nécessitent un token JWT)
- `GET /api/menus` - Liste des menus
- `POST /api/products` - Créer un produit
- `POST /api/orders` - Créer une commande
- `POST /api/payments` - Créer un paiement
- Voir [API-PWA-MAPPING.md](./API-PWA-MAPPING.md) pour la liste complète

## Prochaines étapes

Après l'installation réussie :

1. **Personnaliser** : Modifier le menu et les produits démo
2. **Inviter l'équipe** : Créer des utilisateurs (gérants, serveurs, caissiers)
3. **Configurer** : Logo, informations restaurant, paramètres
4. **Tester** : Créer des commandes tests
5. **Connecter la PWA** : Utiliser l'API documentée dans `API-PWA-MAPPING.md`

## Support

En cas de problème :

1. Consultez la section **Troubleshooting** ci-dessus
2. Vérifiez les logs :
   - Console : logs en temps réel
   - Fichiers : `logs/combined-YYYY-MM-DD.log` et `logs/error-YYYY-MM-DD.log`
3. Mode debug : `LOG_LEVEL=debug npm run dev`

## Architecture

```
bizon/
├── src/
│   ├── config/          # Configuration DB, logger
│   ├── middlewares/     # auth, roleCheck, tenantIsolation
│   ├── models/          # Modèles Sequelize (12 tables)
│   ├── modules/         # Modules métier (auth, orders, payments, etc.)
│   ├── utils/           # pdfGenerator, validators, errorTranslator
│   └── server.js        # Point d'entrée
├── storage/invoices/    # Factures PDF générées
├── logs/                # Logs rotatifs (Winston)
├── .env                 # Configuration (ne pas commiter)
└── package.json         # Dépendances

```

## Licence & Confidentialité

Ce projet est propriétaire. Tous droits réservés.
