# WAITER UI - RÈGLES STRICTES FRONTEND

## MATRICE D'ACTIONS PAR ÉTAT

| État      | Modifier produits | Annuler | Envoyer cuisine | Afficher dans liste |
|-----------|-------------------|---------|-----------------|---------------------|
| draft     | OUI               | OUI     | OUI             | NON                 |
| confirmed | NON               | OUI     | NON             | OUI                 |
| preparing | NON               | NON     | NON             | OUI                 |
| ready     | NON               | NON     | NON             | OUI                 |
| paid      | NON               | NON     | NON             | NON                 |
| cancelled | NON               | NON     | NON             | NON                 |

## FLUX UTILISATEUR

### 1. Créer commande (Nouvelle Commande)
- Créer en `draft` automatiquement
- Rester sur l'écran de saisie
- Ajouter/supprimer produits librement
- Bouton "Envoyer en cuisine" → Passe à `confirmed`

### 2. Liste commandes
- Afficher UNIQUEMENT: `confirmed`, `preparing`, `ready`
- NE PAS afficher: `draft`, `paid`, `cancelled`
- Bouton "Annuler" visible UNIQUEMENT pour `confirmed`

### 3. Détail commande
- Lecture seule
- Actions selon état:
  - `confirmed`: Bouton "Annuler"
  - `preparing`/`ready`: Aucune action

## IMPLÉMENTATION

### Modifications waiter.js

```javascript
// Créer commande en DRAFT
async function sendToKitchen() {
    const orderData = {...}; // Pas de status
    const result = await createOrder(orderData); // Backend retourne draft
    
    // Confirmer immédiatement
    await confirmOrder(result.order.id);
}

// Nouvelle fonction
async function confirmOrder(orderId) {
    await updateOrderStatus(orderId, 'confirmed');
}

// API
async function updateOrderStatus(orderId, newStatus) {
    return await apiCall(`/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
    });
}
```

### Filtrage liste
```javascript
async function getOrders(statusFilter) {
    // Toujours filtrer sur confirmed,preparing,ready
    let endpoint = '/orders?status=confirmed,preparing,ready';
    return await apiCall(endpoint);
}
```

### Actions conditionnelles
```javascript
function getActionsForOrder(order) {
    if (order.status === 'confirmed') {
        return `<button onclick="cancelOrder('${order.id}')">Annuler</button>`;
    }
    return ''; // Pas d'action pour preparing/ready
}
```

## TESTS OBLIGATOIRES

1. Créer commande → Vérifier statut `confirmed` dans liste
2. Annuler commande `confirmed` → Disparaît de la liste
3. Commande `preparing` → Pas de bouton annuler
4. Filtres fonctionnent correctement
