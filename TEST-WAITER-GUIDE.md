# 🧪 Guide Test Rapide - Module Serveur

## ⚡ Mise en route (5 minutes)

### 1. Créer l'utilisateur serveur

**Option A: Via psql (recommandé)**

```bash
psql -U postgres -d bizon_db
```

Puis copier-coller:

```sql
INSERT INTO users (restaurant_id, email, password_hash, first_name, last_name, role)
VALUES (
    1,
    'serveur@test.com',
    '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdTv/HkXO',
    'Jean',
    'Martin',
    'waiter'
);
```

**Option B: Copier le fichier SQL**

```bash
psql -U postgres -d bizon_db -f test-waiter-create-user.sql
```

### 2. Démarrer les serveurs (si pas déjà fait)

```bash
# Backend API
cd /private/tmp/Perso/bizon
npm start

# PWA (autre terminal)
cd /private/tmp/Perso/bizon/pwa
python3 -m http.server 8080
```

### 3. Tester le login

Ouvrir: **http://localhost:8080**

**Connexion serveur**:
- Email: `serveur@test.com`
- Password: `serveur123`

➡️ **Vous devez être automatiquement redirigé vers** `http://localhost:8080/waiter/waiter.html`

---

## ✅ Checklist de test (10 minutes)

### Test 1: Authentification ✓

- [ ] Login serveur redirige vers `/waiter/waiter.html`
- [ ] Header affiche "SERVEUR" + nom utilisateur
- [ ] Bouton déconnexion fonctionne
- [ ] Login avec rôle non-waiter reste sur menu client

**Résultat attendu**: Redirection automatique + interface serveur affichée

---

### Test 2: Liste des commandes ✓

- [ ] Page affiche "MES COMMANDES"
- [ ] Filtres visibles (Toutes, Confirmées, Prép, Prêtes)
- [ ] Bouton "➕ Nouvelle Commande" présent
- [ ] Si aucune commande: message "Aucune commande en cours"

**Créer des commandes de test** (via curl):

```bash
# Token serveur (récupéré au login)
TOKEN="votre_token_ici"

# Commande 1
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "dine_in",
    "table_number": 5,
    "customer_name": "Dupont",
    "items": [
      {"product_id": 1, "quantity": 2, "unit_price": 2500},
      {"product_id": 2, "quantity": 1, "unit_price": 1500}
    ]
  }'

# Commande 2
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "dine_in",
    "table_number": 12,
    "customer_name": "Martin",
    "items": [
      {"product_id": 3, "quantity": 1, "unit_price": 3500}
    ]
  }'
```

Puis rafraîchir la page → Les commandes doivent apparaître

---

### Test 3: Nouvelle commande ✓

- [ ] Cliquer "Nouvelle Commande"
- [ ] Formulaire table + client visible
- [ ] Produits chargés (grille visible)
- [ ] Catégories affichées (onglets)

**Actions à tester**:

1. Saisir table: `8`
2. Saisir client: `Test`
3. Cliquer sur 3 produits différents
4. Vérifier récapitulatif à droite se met à jour
5. Cliquer `+` sur un produit → Quantité augmente
6. Cliquer `-` sur un produit → Quantité diminue
7. Total recalculé automatiquement
8. Cliquer "🍳 Envoyer en cuisine"
9. Toast "Commande envoyée avec succès"
10. Retour automatique à la liste après 1.5s

**Résultat attendu**: Nouvelle commande visible dans la liste avec badge "Confirmée"

---

### Test 4: Détail commande ✓

- [ ] Cliquer sur une commande dans la liste
- [ ] Page détail s'ouvre
- [ ] Infos affichées: table, client, statut, montant, date
- [ ] Produits listés avec quantités
- [ ] Si status = confirmed: bouton "Annuler" visible

**Actions à tester**:

1. Cliquer bouton "← Retour" → Retour à la liste
2. Re-cliquer sur une commande confirmée
3. Cliquer "❌ Annuler la commande"
4. Modal de confirmation apparaît
5. Cliquer "Annuler" dans modal → Rien ne se passe
6. Re-cliquer "❌ Annuler la commande"
7. Cliquer "Confirmer" dans modal
8. Toast "Commande annulée avec succès"
9. Retour à la liste
10. Commande disparue (status = cancelled)

---

### Test 5: Filtres ✓

- [ ] Cliquer "Toutes" → Toutes commandes visibles
- [ ] Cliquer "Confirmées" → Uniquement confirmed
- [ ] Cliquer "En préparation" → Uniquement preparing
- [ ] Cliquer "Prêtes" → Uniquement ready
- [ ] Filtre actif surligné en rouge

---

### Test 6: Validations ✓

**Nouvelle commande sans table**:
- [ ] Ne pas remplir le champ table
- [ ] Sélectionner des produits
- [ ] Cliquer "Envoyer en cuisine"
- [ ] Toast rouge "Le numéro de table est obligatoire"

**Nouvelle commande sans produit**:
- [ ] Remplir table: `10`
- [ ] Ne sélectionner AUCUN produit
- [ ] Cliquer "Envoyer en cuisine"
- [ ] Toast rouge "Veuillez sélectionner au moins un produit"

**Bouton désactivé**:
- [ ] Panier vide → Bouton "Envoyer en cuisine" grisé
- [ ] Ajouter 1 produit → Bouton devient cliquable

---

### Test 7: Responsive Mobile ✓

**Sur mobile (ou F12 → mode responsive)**:

- [ ] Header adapté (logo + déconnexion)
- [ ] Liste commandes: 1 colonne
- [ ] Filtres: scroll horizontal
- [ ] Nouvelle commande: formulaire full width
- [ ] Produits: 2-3 colonnes max
- [ ] Récapitulatif: collapsible/scroll
- [ ] Boutons: full width

---

### Test 8: Erreurs gérées ✓

**Token expiré** (simuler):
```bash
# Dans console navigateur (F12)
localStorage.setItem('bizon_token', 'invalid_token');
location.reload();
```
- [ ] Redirection vers login
- [ ] Toast "Session expirée"

**Rôle non-waiter** (simuler):
- [ ] Se connecter avec compte owner/manager
- [ ] Vérifier que `/waiter/waiter.html` bloque l'accès
- [ ] Redirection vers menu client

---

## 🎯 Scénario réel (2 minutes)

### Contexte: Client arrive à la table 15

1. Serveur ouvre l'app PWA
2. Clic "Nouvelle Commande"
3. Table: `15`, Client: `Famille Diallo`
4. Sélectionne:
   - 2× Coca (500₣)
   - 1× Pizza Margherita (2500₣)
   - 3× Salade César (3000₣ chacune)
5. Vérifie total: **12 000 FCFA**
6. Clic "Envoyer en cuisine"
7. Retour à la liste
8. Commande #XXX visible avec badge "Confirmée"

**Temps écoulé**: < 60 secondes ✅

---

## 📊 Critères de réussite

| Critère | Objectif | Résultat |
|---------|----------|----------|
| Login serveur | Redirection auto | ✓ / ✗ |
| Liste commandes | Affichage correct | ✓ / ✗ |
| Nouvelle commande | Création < 60s | ✓ / ✗ |
| Annulation | Modal + confirmation | ✓ / ✗ |
| Validations | Erreurs bloquées | ✓ / ✗ |
| Responsive | Mobile OK | ✓ / ✗ |
| Auto-refresh | 30s fonctionne | ✓ / ✗ |

**Score minimum**: 6/7 ✅ pour valider

---

## 🐛 Problèmes fréquents

### "Aucun produit disponible"

**Cause**: Restaurant créé sans produits

**Solution**:
```bash
# Créer restaurant avec template
curl -X POST http://localhost:3000/api/onboarding/quick-start \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantName": "Test Restaurant",
    "firstName": "Admin",
    "lastName": "Test",
    "email": "admin@test.com",
    "phone": "+221771234567",
    "password": "admin123",
    "template": "restaurant"
  }'
```

### "Accès refusé"

**Cause**: Rôle non autorisé sur l'endpoint

**Solution**: Vérifier `src/modules/orders/routes.js`
```javascript
// Doit contenir 'waiter' dans roleCheck
roleCheck(['owner', 'manager', 'waiter'])
```

### Redirection ne fonctionne pas

**Cause**: Modification `app.js` non prise en compte

**Solution**:
```bash
# Vider cache navigateur
Ctrl + Shift + R (ou Cmd + Shift + R sur Mac)
```

### Auto-refresh ne marche pas

**Cause**: Page pas active

**Solution**: Rester sur page "MES COMMANDES", attendre 30s

---

## 📝 Rapport de test

```
Date: _______________
Testeur: _______________
Navigateur: _______________

✓ / ✗  Login serveur
✓ / ✗  Liste commandes
✓ / ✗  Nouvelle commande
✓ / ✗  Détail commande
✓ / ✗  Annulation
✓ / ✗  Validations
✓ / ✗  Responsive

Bugs identifiés:
_________________________________
_________________________________
_________________________________

Suggestions:
_________________________________
_________________________________
_________________________________

Verdict final: ☐ OK PROD  ☐ CORRECTIONS NÉCESSAIRES
```

---

## 🚀 Prêt pour la prod ?

✅ **Si tous les tests passent**:
1. Créer utilisateurs serveur réels (SQL)
2. Déployer fichiers `pwa/waiter/` sur serveur
3. Configurer HTTPS
4. Former 2-3 serveurs pilotes
5. Monitorer pendant 48h

❌ **Si des tests échouent**:
1. Noter les bugs dans le rapport
2. Ouvrir issues GitHub
3. Corriger avant déploiement

---

**Durée totale du test**: 15-20 minutes
**Statut**: ☐ Testé le __________
