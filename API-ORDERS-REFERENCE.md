# Bizon - Référence Rapide API

## Endpoints Commandes (Orders)

### Base URL
```
http://localhost:3000/api/orders
```

Toutes les requêtes nécessitent un header `Authorization: Bearer <token>`.

---

## 1. Créer une commande (draft)

```bash
POST /api/orders
Content-Type: application/json

{
  "type": "dine_in",  # ou "takeaway", "delivery"
  "table_number": "10",  # OU customer_name
  "customer_name": "Jean Dupont",  # OU table_number
  "items": [
    {
      "product_id": "uuid-du-produit",
      "quantity": 2,
      "price": 3200  # en FCFA
    }
  ],
  "notes": "Sans oignons"  # optionnel
}
```

**Réponse** :
```json
{
  "message": "Commande créée en brouillon",
  "order": {
    "id": "uuid",
    "restaurant_id": "uuid",
    "order_number": "ORD-20251221-0001",
    "status": "draft",
    "type": "dine_in",
    "table_number": "10",
    "customer_name": null,
    "total_amount": "7552.00",
    "created_at": "2025-12-21T15:30:00.000Z"
  }
}
```

---

## 2. Confirmer une commande (décrémente le stock)

```bash
PATCH /api/orders/{order_id}/status
Content-Type: application/json

{
  "status": "confirmed"
}
```

**Actions** :
- Vérifie transition valide (`draft` → `confirmed`)
- **Décrémente le stock** de manière atomique
- Rollback si stock insuffisant

**Réponse** :
```json
{
  "message": "Statut mis à jour",
  "order": {
    "id": "uuid",
    "status": "confirmed",
    ...
  }
}
```

---

## 3. Faire progresser une commande

### Confirmed → Preparing
```bash
PATCH /api/orders/{order_id}/status
{"status": "preparing"}
```

### Preparing → Ready
```bash
PATCH /api/orders/{order_id}/status
{"status": "ready"}
```

### Ready → Paid
```bash
PATCH /api/orders/{order_id}/status
{"status": "paid"}
```

---

## 4. Annuler une commande (restaure le stock)

```bash
POST /api/orders/{order_id}/cancel
```

**Actions** :
- Passe en `cancelled`
- **Restaure le stock** si commande était `confirmed`
- Pas de restauration si était `draft` (jamais décrémenté)

**Réponse** :
```json
{
  "message": "Commande annulée",
  "order": {
    "id": "uuid",
    "status": "cancelled",
    ...
  }
}
```

---

## 5. Lister les commandes (avec filtrage rôle)

```bash
GET /api/orders
```

**Filtrage automatique par rôle** :
- **waiter** : voit `draft`, `confirmed`, `preparing`, `ready`
- **cashier** : voit `ready`, `paid`
- **manager/owner** : voit TOUS les statuts

**Query params disponibles** :
```bash
# Filtrer par statut
GET /api/orders?status=confirmed

# Plusieurs statuts
GET /api/orders?status=confirmed,preparing,ready

# Par type
GET /api/orders?type=dine_in

# Par table
GET /api/orders?table_number=10

# Pagination
GET /api/orders?page=1&limit=20
```

**Réponse** :
```json
[
  {
    "id": "uuid",
    "order_number": "ORD-20251221-0001",
    "status": "confirmed",
    "type": "dine_in",
    "table_number": "10",
    "total_amount": "7552.00",
    "created_at": "2025-12-21T15:30:00.000Z",
    "items": [
      {
        "id": "uuid",
        "product_name": "Accras de morue",
        "quantity": 2,
        "unit_price": "3200.00",
        "subtotal": "6400.00"
      }
    ]
  }
]
```

---

## 6. Obtenir une commande spécifique

```bash
GET /api/orders/{order_id}
```

**Réponse** : Objet complet avec items, customer, payment (si existe)

---

## Transitions de statut autorisées

| Depuis | Vers | Note |
|--------|------|------|
| `draft` | `confirmed` | ✅ Décrémente stock |
| `draft` | `cancelled` | ✅ Pas de restauration stock |
| `confirmed` | `preparing` | ✅ Stock déjà décrémenté |
| `confirmed` | `cancelled` | ✅ Restaure stock |
| `preparing` | `ready` | ✅ |
| `preparing` | `cancelled` | ❌ Non autorisé (utiliser annulation manuelle) |
| `ready` | `paid` | ✅ |
| `ready` | `cancelled` | ❌ Non autorisé |
| `paid` | * | ❌ État final |
| `cancelled` | * | ❌ État final |

**Toute transition non listée retourne** :
```json
{
  "error": "Transition interdite : {from} → {to}"
}
```

---

## Exemples de flux complets

### Flux normal (service table)

```bash
# 1. Créer commande
TOKEN="eyJ..."
PRODUCT_ID="uuid"

ORDER=$(curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "dine_in",
    "table_number": "5",
    "items": [{"product_id": "'$PRODUCT_ID'", "quantity": 2, "price": 3200}]
  }')

ORDER_ID=$(echo "$ORDER" | jq -r '.order.id')

# 2. Confirmer (décrémente stock)
curl -X PATCH "http://localhost:3000/api/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "confirmed"}'

# 3. Cuisine prépare
curl -X PATCH "http://localhost:3000/api/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "preparing"}'

# 4. Commande prête
curl -X PATCH "http://localhost:3000/api/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "ready"}'

# 5. Client paie
curl -X PATCH "http://localhost:3000/api/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "paid"}'
```

### Flux annulation

```bash
# Créer et confirmer
ORDER_ID="..."

# Annuler (restaure stock si était confirmed)
curl -X POST "http://localhost:3000/api/orders/$ORDER_ID/cancel" \
  -H "Authorization: Bearer $TOKEN"
```

### Vérifier stock avant/après

```bash
# Stock initial
STOCK_BEFORE=$(curl -s "http://localhost:3000/api/products/$PRODUCT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.stock_quantity')

echo "Stock avant : $STOCK_BEFORE"

# Créer et confirmer commande de 2 unités
# ...

# Stock après
STOCK_AFTER=$(curl -s "http://localhost:3000/api/products/$PRODUCT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.stock_quantity')

echo "Stock après : $STOCK_AFTER"
echo "Différence : $((STOCK_AFTER - STOCK_BEFORE))"  # Devrait être -2
```

---

## Gestion des erreurs

### Stock insuffisant
```json
{
  "error": "Stock insuffisant pour \"Accras de morue\". Commande annulée, rechargez la liste des produits."
}
```
→ Afficher toast d'erreur, recharger produits

### Transition interdite
```json
{
  "error": "Transition interdite : confirmed → ready"
}
```
→ Ne devrait pas arriver si UI respecte la machine à états

### Commande non trouvée
```json
{
  "error": "Commande non trouvée"
}
```
→ Vérifier `restaurant_id` dans le JWT

### Token expiré
```json
{
  "error": "Token invalide"
}
```
→ Rediriger vers page de login

---

## Endpoints Auth (pour référence)

### Login
```bash
POST /api/auth/login

{
  "email": "serveur@test.com",
  "password": "serveur123"
}
```

**Réponse** :
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "serveur@test.com",
    "first_name": "Jean",
    "last_name": "Serveur",
    "role": "waiter",
    "restaurant": {
      "id": "uuid",
      "name": "Restaurant Test"
    }
  }
}
```

### Refresh (vérifie token)
```bash
GET /api/auth/me
Authorization: Bearer <token>
```

---

## Tests

### Script complet
```bash
./test-waiter-flow.sh
```

### Tests individuels
```bash
# Health check
curl http://localhost:3000/health

# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"serveur@test.com","password":"serveur123"}' | jq -r '.token')

# Lister produits
curl -s http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" | jq '.[0:3]'

# Créer commande test
curl -s -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "dine_in",
    "table_number": "99",
    "items": [{"product_id": "UUID", "quantity": 1, "price": 1000}]
  }' | jq '.'
```

---

## Statuts HTTP

| Code | Signification | Action |
|------|---------------|--------|
| 200 | OK | Traiter la réponse |
| 201 | Created | Commande créée avec succès |
| 400 | Bad Request | Afficher `error` à l'utilisateur |
| 401 | Unauthorized | Rediriger vers login |
| 404 | Not Found | Ressource n'existe pas |
| 500 | Server Error | Afficher erreur générique, logger |

---

## Workflow Frontend (PWA waiter)

### Création commande
```javascript
// 1. Créer en draft
const draftResponse = await fetch('/api/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    type: 'dine_in',
    table_number: tableNumber,
    items: cart.map(item => ({
      product_id: item.id,
      quantity: item.quantity,
      price: item.price
    }))
  })
});

const { order } = await draftResponse.json();

// 2. Confirmer immédiatement (décrémente stock)
await fetch(`/api/orders/${order.id}/status`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ status: 'confirmed' })
});

// 3. Rafraîchir liste
loadOrders();
```

### Changement statut
```javascript
async function updateOrderStatus(orderId, newStatus) {
  const response = await fetch(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status: newStatus })
  });

  if (!response.ok) {
    const { error } = await response.json();
    showToast(error, 'error');
    return false;
  }

  loadOrders();
  return true;
}
```

### Annulation
```javascript
async function cancelOrder(orderId) {
  const response = await fetch(`/api/orders/${orderId}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const { error } = await response.json();
    showToast(error, 'error');
    return false;
  }

  showToast('Commande annulée, stock restauré', 'success');
  loadOrders();
  return true;
}
```

---

## Notes importantes

### Multi-tenancy
Tous les endpoints filtrent automatiquement par `restaurant_id` extrait du JWT. Impossible d'accéder aux commandes d'un autre restaurant.

### Transactions
Les opérations critiques (création, confirmation, annulation) utilisent des transactions PostgreSQL pour garantir l'intégrité des données.

### Stock tracking
Seuls les produits avec `track_stock = true` sont vérifiés et décrémentés. Les autres (services, boissons illimitées) ne sont pas impactés.

### Atomicité
La décrémentation stock utilise un UPDATE avec WHERE pour éviter les race conditions :
```sql
UPDATE products 
SET stock_quantity = stock_quantity - 2
WHERE id = 'uuid' AND stock_quantity >= 2
```
Si le UPDATE retourne 0 rows affected, l'erreur "Stock insuffisant" est levée.

---

Pour plus de détails, voir `WAITER-FLOW-IMPLEMENTATION.md`.
