# 🚀 GUIDE D'INSTALLATION RAPIDE BIZON

## Installation chez un restaurant en moins de 30 minutes

---

## ÉTAPE 1 : Inscription (5 minutes)

### Informations à collecter

- ✅ Nom du restaurant
- ✅ Nom et prénom du propriétaire
- ✅ Email (sera l'identifiant de connexion)
- ✅ Numéro de téléphone
- ✅ Mot de passe (minimum 8 caractères)

### Action à effectuer

**Endpoint:** `POST /api/auth/register`

```bash
curl -X POST https://api.bizon.sn/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantName": "Chez Fatou",
    "firstName": "Fatou",
    "lastName": "Diop",
    "email": "fatou@chezfatou.sn",
    "password": "SecurePass123!",
    "phone": "+221771234567"
  }'
```

**Résultat attendu:**
- ✅ Compte restaurant créé
- ✅ Abonnement essai 14 jours activé
- ✅ Token d'authentification reçu

---

## ÉTAPE 2 : Onboarding automatique (2 minutes)

### Génération du menu par défaut

Le système crée automatiquement:
- 4 catégories (Entrées, Plats, Boissons, Desserts)
- 10 produits sénégalais pré-configurés
- Structure de menu exploitable immédiatement

**Endpoint:** `POST /api/onboarding/setup`

```bash
curl -X POST https://api.bizon.sn/api/onboarding/setup \
  -H "Authorization: Bearer <TOKEN_RECU>"
```

**Menu créé par défaut:**

| Produit | Catégorie | Prix |
|---------|-----------|------|
| Yassa Poulet | Plats | 2500 FCFA |
| Thiéboudienne | Plats | 3000 FCFA |
| Mafé | Plats | 2800 FCFA |
| Salade de saison | Entrées | 1500 FCFA |
| Bissap | Boissons | 800 FCFA |
| Eau minérale | Boissons | 500 FCFA |
| Jus de fruits | Boissons | 1000 FCFA |
| Thiakry | Desserts | 1200 FCFA |
| Salade de fruits | Desserts | 1500 FCFA |
| Bouye | Boissons | 900 FCFA |

**Résultat attendu:**
- ✅ Menu "Menu Principal" créé
- ✅ 4 catégories actives
- ✅ 10 produits disponibles
- ✅ Restaurant prêt à prendre des commandes

---

## ÉTAPE 3 : Personnalisation du menu (10 minutes)

### Modifier les produits existants

**Endpoint:** `PUT /api/products/:id`

```bash
# Modifier le prix du Yassa Poulet
curl -X PUT https://api.bizon.sn/api/products/<PRODUCT_ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Yassa Poulet (portion familiale)",
    "price": 3500,
    "description": "Notre spécialité maison avec oignons confits"
  }'
```

### Ajouter de nouveaux produits

**Endpoint:** `POST /api/products`

```bash
curl -X POST https://api.bizon.sn/api/products \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": "<CATEGORY_ID>",
    "name": "Domoda",
    "description": "Ragoût d'arachide avec bœuf",
    "price": 2700,
    "track_stock": false,
    "is_available": true
  }'
```

### Ajouter de nouvelles catégories

**Endpoint:** `POST /api/menus/:menuId/categories`

```bash
curl -X POST https://api.bizon.sn/api/menus/<MENU_ID>/categories \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Grillades",
    "description": "Poissons et viandes grillés",
    "display_order": 5
  }'
```

---

## ÉTAPE 4 : Créer les comptes utilisateurs (5 minutes)

### Rôles disponibles

- **owner** : Propriétaire (accès total)
- **manager** : Gérant (gestion menu + commandes + paiements)
- **waiter** : Serveur (création commandes uniquement)
- **cashier** : Caissier (gestion paiements uniquement)

### Créer un serveur

**Endpoint:** `POST /api/restaurants/users`

```bash
curl -X POST https://api.bizon.sn/api/restaurants/users \
  -H "Authorization: Bearer <TOKEN_OWNER>" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Abdou",
    "last_name": "Sall",
    "email": "abdou@chezfatou.sn",
    "password": "Serveur123!",
    "role": "waiter"
  }'
```

### Créer un caissier

```bash
curl -X POST https://api.bizon.sn/api/restaurants/users \
  -H "Authorization: Bearer <TOKEN_OWNER>" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Aminata",
    "last_name": "Ndiaye",
    "email": "aminata@chezfatou.sn",
    "password": "Caisse123!",
    "role": "cashier"
  }'
```

---

## ÉTAPE 5 : Test en situation réelle (5 minutes)

### Scénario complet de commande

#### 1. Connexion du serveur

```bash
curl -X POST https://api.bizon.sn/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "abdou@chezfatou.sn",
    "password": "Serveur123!"
  }'
```

#### 2. Création d'une commande

```bash
curl -X POST https://api.bizon.sn/api/orders \
  -H "Authorization: Bearer <TOKEN_SERVEUR>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "dine_in",
    "table_number": "5",
    "items": [
      {
        "product_id": "<YASSA_POULET_ID>",
        "quantity": 2,
        "unit_price": 2500
      },
      {
        "product_id": "<BISSAP_ID>",
        "quantity": 2,
        "unit_price": 800
      }
    ],
    "notes": "Table 5 - Client préfère peu épicé"
  }'
```

**Total attendu:** 6600 FCFA

#### 3. Paiement Mobile Money

```bash
# Création du paiement
curl -X POST https://api.bizon.sn/api/payments \
  -H "Authorization: Bearer <TOKEN_CAISSE>" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "<ORDER_ID>",
    "amount": 6600,
    "method": "mobile_money",
    "phone_number": "+221771234567",
    "provider": "orange_money"
  }'
```

```bash
# Vérification du paiement
curl -X POST https://api.bizon.sn/api/payments/<PAYMENT_ID>/verify \
  -H "Authorization: Bearer <TOKEN_CAISSE>" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_code": "OM123456789"
  }'
```

**Résultat attendu:**
- ✅ Paiement validé
- ✅ Facture générée automatiquement
- ✅ Commande passée à "completed"
- ✅ PDF facture disponible

---

## ÉTAPE 6 : Formation du personnel (3 minutes)

### Consignes pour le serveur

1. Se connecter avec son email et mot de passe
2. Créer une commande avec les produits commandés
3. Indiquer le numéro de table
4. Soumettre la commande

### Consignes pour le caissier

1. Se connecter avec son email et mot de passe
2. Voir la liste des commandes en attente de paiement
3. Créer un paiement Mobile Money ou cash
4. Si Mobile Money : demander le code de transaction au client
5. Vérifier le paiement
6. Imprimer ou envoyer la facture au client

---

## ✅ CHECKLIST DE VALIDATION

Avant de déclarer l'installation terminée, vérifier:

- [ ] Inscription restaurant réussie
- [ ] Menu par défaut créé (4 catégories, 10 produits)
- [ ] Au moins 1 produit modifié/personnalisé
- [ ] Au moins 1 nouveau produit ajouté
- [ ] Compte serveur créé et testé
- [ ] Compte caissier créé et testé
- [ ] 1 commande complète réalisée (création → paiement → facture)
- [ ] Facture PDF générée et consultable

---

## 🆘 SUPPORT ET DÉPANNAGE

### Erreurs fréquentes

| Erreur | Cause | Solution |
|--------|-------|----------|
| "Email déjà utilisé" | Email existant | Utiliser un autre email |
| "Token invalide" | Session expirée | Se reconnecter |
| "Stock insuffisant" | Produit en rupture | Désactiver track_stock ou réapprovisionner |
| "Commande déjà payée" | Double paiement | Vérifier l'état de la commande avant |
| "Code transaction invalide" | Code < 6 caractères | Demander le code complet au client |

### Logs à consulter

```bash
# Voir les logs temps réel
tail -f logs/bizon.log

# Voir seulement les erreurs
tail -f logs/errors.log

# Voir les actions critiques (paiements, commandes)
grep "CRITICAL" logs/bizon.log
```

---

## 📈 APRÈS L'INSTALLATION

### Prochaines étapes suggérées

1. **Connecter la PWA** : Interface graphique pour serveurs/caissiers
2. **Configurer les imprimantes** : Tickets de cuisine et factures
3. **Personnaliser la facture PDF** : Logo et coordonnées du restaurant
4. **Former le personnel** : Session pratique de 30 minutes
5. **Activer les notifications** : Alertes stock bas, nouvelles commandes

### Abonnement

- ✅ **Essai 14 jours gratuit** : Toutes les fonctionnalités débloquées
- 📅 **Après 14 jours** : Passage à l'abonnement mensuel
- 💳 **Tarif** : À définir selon le plan choisi

---

## 📞 CONTACT

**Support technique :** support@bizon.sn  
**Urgences :** +221 XX XXX XX XX  
**Documentation :** https://docs.bizon.sn

---

✅ **Installation réussie ! Votre restaurant est maintenant équipé pour gérer ses commandes et paiements digitalement.**
