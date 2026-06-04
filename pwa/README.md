# Bizon PWA - Interface Utilisateur

## 🎨 Design

PWA moderne inspirée de votre maquette avec :
- Logo "B" rouge circulaire
- Menu latéral avec catégories (Boissons, Nourriture, Desserts)
- Grille de produits avec images circulaires
- Interface responsive mobile + desktop

## 🚀 Lancement

### Option 1 : Serveur HTTP Simple (Recommandé)

```bash
cd /private/tmp/Perso/bizon/pwa
python3 -m http.server 8080
```

Puis ouvrir : **http://localhost:8080**

### Option 2 : Avec Node.js

```bash
npx serve pwa -p 8080
```

## 📱 Fonctionnalités

### ✅ Implémenté

1. **Authentification**
   - Connexion utilisateur
   - Inscription restaurant (onboarding complet)
   - Stockage token JWT

2. **Menu Digital**
   - Navigation par catégories (sidebar)
   - Affichage produits avec images, prix, stock
   - Filtrage dynamique par catégorie

3. **Panier**
   - Ajout/suppression produits
   - Modification quantités
   - Application d'un code promo (réduction)
   - Persistance localStorage

4. **Commandes**
   - Création commande depuis panier
   - Envoi API backend
   - Notifications toast

### 📋 Pages

- **Menu** : Grille produits par catégorie
- **Login** : Formulaire connexion
- **Inscription** : Onboarding restaurant (3 templates)
- **Panier** : Récapitulatif + checkout

## 🎯 Utilisation

### 1. Première Utilisation

**Créer un restaurant :**
1. Cliquer sur "Inscription"
2. Remplir le formulaire :
   - Nom restaurant : "Le Bistrot"
   - Prénom/Nom : "Jean Dupont"
   - Email : "jean@bistrot.com"
   - Téléphone : "+237690000000"
   - Mot de passe : (au choix)
   - Template : Restaurant (23 produits pré-créés)
3. Cliquer "Créer mon restaurant"

✅ **Vous êtes connecté automatiquement + 23 produits générés**

### 2. Navigation

**Catégories disponibles** (sidebar gauche) :
- Boissons Gazeuses
- Boissons Naturelles
- Boissons Chaudes
- Bières
- Spiritueux
- Petit Déj
- Entrées
- Plats classiques
- Plats traditionnels
- Desserts Classiques
- Salades de fruits
- Crêpes

### 3. Commander

1. Cliquer sur un produit pour l'ajouter au panier
2. Cliquer sur l'icône 🛒 (badge rouge indique le nombre)
3. Ajuster les quantités (+/-)
4. Cliquer "Commander"

✅ **Commande créée dans la base de données**

## 🔧 Configuration

### API Backend

Le fichier [app.js](app.js) pointe vers :
```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

**Vérifier que le serveur backend tourne :**
```bash
curl http://localhost:3000/health
```

### CORS

Si erreurs CORS, ajouter dans `src/server.js` :

```javascript
app.use(cors({
    origin: 'http://localhost:8080',
    credentials: true
}));
```

## 🎨 Personnalisation

### Couleurs (styles.css)

```css
:root {
    --primary: #e63946;        /* Rouge Bizon */
    --primary-dark: #d62828;   /* Rouge foncé */
    --secondary: #f1faee;      /* Beige clair */
    --text-dark: #1d3557;      /* Bleu marine */
}
```

### Images Produits

Par défaut : placeholder générique.

**Pour vraies images**, modifier dans backend :
```javascript
// src/modules/products/service.js
image_url: 'https://example.com/drinks/coca.jpg'
```

## 📊 Architecture

```
pwa/
├── index.html        # Structure HTML
├── styles.css        # Design complet
├── app.js            # Logique JavaScript
└── manifest.json     # Config PWA (icône, couleurs)
```

### Composants Clés

**State Management (app.js) :**
```javascript
const state = {
    user: null,              // Utilisateur connecté
    token: '...',            // JWT stocké
    restaurantId: '...',     // ID restaurant
    cart: [],                // Panier
    products: [],            // Catalogue
    currentCategory: '...'   // Filtre actif
};
```

**API Calls :**
- `register()` → `/api/onboarding/quick-start`
- `login()` → `/api/auth/login`
- `getProducts()` → `/api/products`
- `createOrder()` → `/api/orders`

## 🔐 Sécurité

- ✅ Token JWT dans localStorage
- ✅ Header Authorization sur toutes requêtes
- ✅ Validation formulaires côté client
- ✅ HTTPS recommandé en production

## 📱 Progressive Web App

### Installation

Sur mobile (Chrome/Safari) :
1. Ouvrir l'URL
2. Menu → "Ajouter à l'écran d'accueil"
3. Icône "B" rouge apparaît

**Features PWA :**
- ✅ Manifest.json configuré
- ✅ Icône SVG dynamique
- ✅ Theme color rouge
- ⚠️ Service Worker à ajouter (cache offline)

## 🐛 Dépannage

### Problème : "Aucun produit"
**Solution :** Vérifier que vous êtes connecté ET que le template a généré des produits

### Problème : Erreur CORS
**Solution :** Ajouter middleware CORS dans backend (voir section Configuration)

### Problème : Images cassées
**Normal** : Les URLs d'images par défaut sont des placeholders. Remplacer par vraies URLs.

### Problème : Token expiré
**Solution :** Se reconnecter. Token valide 7 jours par défaut.

## 🚀 Prochaines Étapes

Pour améliorer la PWA :

1. **Service Worker** (cache offline)
2. **Photos produits** (intégration Cloudinary/S3)
3. **Paiements Mobile Money** (page dédiée)
4. **Historique commandes** (page "Mes commandes")
5. **Notifications push** (nouvelles commandes)
6. **Mode sombre** (toggle CSS)

## 📞 Support

Logs navigateur (F12) pour débugger :
```javascript
console.log('State:', state);
console.log('Cart:', state.cart);
```

Logs backend (terminal Node.js) pour voir les requêtes API.

---

**Note :** Cette PWA est une **version MVP** fonctionnelle. Pour production, ajouter tests, optimisations images, et monitoring.
