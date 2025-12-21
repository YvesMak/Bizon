# Bizon - Guide de Déploiement Module Serveur

## 📋 Vue d'ensemble

Ce guide explique comment déployer le **module SERVEUR** (waiter) de Bizon.

## 🔧 Prérequis

✅ Backend Bizon opérationnel (Node.js + PostgreSQL)
✅ PWA client déployée
✅ PostgreSQL accessible
✅ Serveur web (Nginx/Apache) configuré

## 📦 Fichiers déployés

```
pwa/
├── waiter/
│   ├── waiter.html      # Interface serveur
│   ├── waiter.css       # Styles
│   ├── waiter.js        # Logique métier
│   └── README.md        # Documentation
├── styles.css           # Styles partagés (déjà présent)
├── manifest.json        # PWA manifest (déjà présent)
└── app.js               # MODIFIÉ (redirection waiter)
```

## 🚀 Étapes de déploiement

### 1. Créer les utilisateurs serveur

**Option A: Via SQL (recommandé)**

```bash
psql -U postgres -d bizon_db -f test-waiter-create-user.sql
```

Le fichier SQL crée:
- Email: `serveur@test.com`
- Password: `serveur123`
- Rôle: `waiter`
- Restaurant: ID 1

**Option B: Via interface admin (si existe)**

Si vous avez une interface admin, créer manuellement:
- Rôle: Serveur
- Email: `serveur@restaurant.com`
- Password: au choix
- Restaurant: sélectionner

### 2. Vérifier les permissions backend

**Fichier**: `src/modules/orders/routes.js`

Vérifier que le rôle `waiter` est autorisé:

```javascript
const roleCheck = require('../../middlewares/roleCheck');

// Liste commandes
router.get('/', 
    auth, 
    roleCheck(['owner', 'manager', 'waiter']),  // ← waiter autorisé
    OrderController.getAll
);

// Créer commande
router.post('/', 
    auth, 
    roleCheck(['owner', 'manager', 'waiter']),  // ← waiter autorisé
    OrderController.create
);

// Annuler commande
router.patch('/:id/cancel', 
    auth, 
    roleCheck(['owner', 'manager', 'waiter']),  // ← waiter autorisé
    OrderController.cancel
);
```

**Si modifications nécessaires**:

```bash
cd /path/to/bizon
nano src/modules/orders/routes.js
# Ajouter 'waiter' dans roleCheck([...])
pm2 restart bizon  # ou npm start
```

### 3. Configurer CORS

**Fichier**: `src/server.js`

```javascript
const cors = require('cors');

app.use(cors({
    origin: [
        'https://app.bizon.com',           // Production
        'https://waiter.bizon.com',        // Sous-domaine serveur (optionnel)
        'http://localhost:8080'            // Dev local
    ],
    credentials: true
}));
```

### 4. Déployer les fichiers PWA

**Option A: Même domaine (recommandé)**

```
app.bizon.com/
├── index.html         # PWA client
├── app.js
├── styles.css
├── waiter/
│   ├── waiter.html    # Interface serveur
│   ├── waiter.js
│   └── waiter.css
└── ...
```

**Option B: Sous-domaine séparé**

```
Client:  app.bizon.com
Serveur: waiter.bizon.com
```

Configuration Nginx:

```nginx
# app.bizon.com (client + serveur)
server {
    listen 80;
    server_name app.bizon.com;
    
    root /var/www/bizon-pwa;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /waiter/ {
        try_files $uri $uri/ /waiter/waiter.html;
    }
}
```

### 5. Mettre à jour l'API URL (production)

**Fichier**: `pwa/waiter/waiter.js` (ligne 6)

```javascript
// DEV
const API_BASE_URL = 'http://localhost:3000/api';

// PRODUCTION
const API_BASE_URL = 'https://api.bizon.com/api';
```

**Automatiser avec variable d'environnement** (optionnel):

```javascript
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api'
    : 'https://api.bizon.com/api';
```

### 6. Tester le déploiement

**Test 1: Login serveur**

```bash
curl -X POST https://api.bizon.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "serveur@test.com",
    "password": "serveur123"
  }'
```

Réponse attendue:
```json
{
  "message": "Connexion réussie",
  "token": "eyJhbGc...",
  "user": {
    "role": "waiter",
    "firstName": "Jean",
    ...
  }
}
```

**Test 2: Interface web**

1. Ouvrir: `https://app.bizon.com`
2. Se connecter avec compte serveur
3. Vérifier redirection vers `/waiter/waiter.html`
4. Vérifier liste des commandes
5. Tester création commande

**Test 3: Permissions**

```bash
# Token serveur récupéré ci-dessus
TOKEN="eyJhbGc..."

# Liste commandes (doit fonctionner)
curl -X GET "https://api.bizon.com/api/orders?role=waiter" \
  -H "Authorization: Bearer $TOKEN"

# Stats restaurant (doit être refusé)
curl -X GET "https://api.bizon.com/api/restaurants/stats" \
  -H "Authorization: Bearer $TOKEN"
# Attendu: 403 Forbidden
```

## 🔒 Sécurité en production

### Checklist

✅ **HTTPS obligatoire**
```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
}
```

✅ **Token expiration adaptée**
```env
# .env backend
JWT_EXPIRES_IN=8h  # Durée d'un shift
```

✅ **Rate limiting**
```javascript
// src/server.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requêtes max
});

app.use('/api/orders', limiter);
```

✅ **Logs audit**
```javascript
// src/middlewares/auditLog.js
const auditLog = (req, res, next) => {
    if (req.user && req.user.role === 'waiter') {
        logger.info('Waiter action', {
            user: req.user.id,
            action: `${req.method} ${req.path}`,
            ip: req.ip
        });
    }
    next();
};
```

✅ **CSP Headers**
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';" always;
```

## 📱 Configuration PWA

### Manifest.json (déjà configuré)

```json
{
  "name": "Bizon - Menu Digital",
  "short_name": "Bizon",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#e63946"
}
```

### Service Worker (V2 - optionnel)

Pour mode offline, créer `sw.js`:

```javascript
const CACHE_NAME = 'bizon-waiter-v1';
const urlsToCache = [
  '/waiter/waiter.html',
  '/waiter/waiter.css',
  '/waiter/waiter.js',
  '/styles.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});
```

## 👥 Formation utilisateurs

### Pour les serveurs

**Onboarding (5 minutes)**:

1. Installation app (mobile):
   - Ouvrir `app.bizon.com` dans Chrome/Safari
   - Menu → "Ajouter à l'écran d'accueil"
   - Icône "Bizon" apparaît

2. Première connexion:
   - Email: fourni par manager
   - Password: fourni par manager
   - Interface serveur s'ouvre automatiquement

3. Workflow type:
   - Arrivée client → Noter table
   - "Nouvelle Commande" → Saisir table + sélectionner produits
   - "Envoyer en cuisine" → Commande transmise
   - Suivre statut dans la liste

### Pour les managers

**Créer un compte serveur**:

```sql
-- Via psql
INSERT INTO users (restaurant_id, email, password_hash, first_name, last_name, role)
VALUES (
    1,  -- ID restaurant
    'nouveau.serveur@restaurant.com',
    '$2b$10$...',  -- Générer via bcrypt
    'Prénom',
    'Nom',
    'waiter'
);
```

**Générer hash bcrypt**:

```bash
# Via Node.js
node -e "console.log(require('bcrypt').hashSync('password123', 10))"
```

Ou via interface admin si elle existe.

## 🐛 Dépannage

### Problème: "Accès refusé"

**Cause**: Rôle non autorisé sur l'endpoint

**Solution**:
```bash
# Vérifier les routes backend
grep -r "roleCheck" src/modules/orders/routes.js

# Doit contenir 'waiter' dans les arrays
```

### Problème: "Token expiré"

**Cause**: JWT_EXPIRES_IN trop court

**Solution**:
```env
# .env backend
JWT_EXPIRES_IN=8h  # Au lieu de 1h
```

Puis `pm2 restart bizon`

### Problème: Erreur CORS

**Cause**: Domaine non autorisé

**Solution**:
```javascript
// src/server.js
app.use(cors({
    origin: ['https://app.bizon.com'],  // Ajouter domaine
    credentials: true
}));
```

### Problème: Interface ne charge pas

**Cause**: Fichiers non déployés

**Solution**:
```bash
# Vérifier présence fichiers
ls -la /var/www/bizon-pwa/waiter/

# Doit contenir:
# - waiter.html
# - waiter.css
# - waiter.js
```

### Problème: Redirection ne fonctionne pas

**Cause**: Modification `app.js` non déployée

**Solution**:
```bash
# Vérifier le fichier
grep -A 10 "data.user.role === 'waiter'" /var/www/bizon-pwa/app.js

# Doit contenir:
# if (data.user.role === 'waiter') {
#     window.location.href = 'waiter/waiter.html';
#     return;
# }
```

## 📊 Monitoring

### Logs à surveiller

**Backend** (via Winston):
```bash
tail -f logs/combined.log | grep waiter
```

**Nginx**:
```bash
tail -f /var/log/nginx/access.log | grep /waiter/
```

### Métriques clés

- Nombre de connexions serveur/jour
- Nombre de commandes créées/shift
- Taux d'erreur API
- Temps de réponse moyen

### Alertes recommandées

- Taux d'erreur > 5%
- Temps de réponse > 2s
- Aucune commande pendant 1h (shift actif)

## 🔄 Mises à jour

### Déploiement d'une nouvelle version

```bash
# 1. Backup
cp -r /var/www/bizon-pwa /var/www/bizon-pwa.backup

# 2. Déployer nouveaux fichiers
scp pwa/waiter/* user@server:/var/www/bizon-pwa/waiter/

# 3. Vider cache navigateur (forcer refresh)
# Les serveurs doivent rafraîchir l'app (Ctrl+Shift+R)

# 4. Vérifier
curl -I https://app.bizon.com/waiter/waiter.html
```

### Rollback

```bash
# Restaurer backup
rm -rf /var/www/bizon-pwa
mv /var/www/bizon-pwa.backup /var/www/bizon-pwa
```

## 📈 Évolutions futures

### V2 prévue

- 🔔 Notifications push (commande prête)
- 📱 Mode offline (Service Worker)
- 🎤 Commande vocale
- 📸 Scan QR code table
- 📊 Stats personnelles serveur
- 🌐 Traductions (anglais, arabe)

### Intégrations possibles

- 🖨️ Imprimante cuisine (ESC/POS)
- 📱 Vibreur serveur (commande prête)
- 💬 Chat équipe temps réel
- 📍 Localisation tables (plan interactif)

## 📞 Support

**Documentation**:
- Backend: `/INSTALLATION.md`
- API: `/API-PWA-MAPPING.md`
- Module serveur: `/pwa/waiter/README.md`

**Logs debug**:
```bash
# Backend
pm2 logs bizon

# PostgreSQL
tail -f /var/log/postgresql/postgresql-15-main.log

# Nginx
tail -f /var/log/nginx/error.log
```

---

**Version**: 1.0
**Date**: 21 décembre 2025
**Statut**: ✅ Prêt production
