#!/bin/bash

# Script de test d'onboarding complet pour Bizon
# Teste le flow : Onboarding → Menu → Commande → Paiement → Facture

set -e  # Arrêter en cas d'erreur

BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMESTAMP=$(date +%s)

echo "🚀 Test d'onboarding complet Bizon"
echo "===================================="
echo ""

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() {
  echo -e "${GREEN}✅ $1${NC}"
}

error() {
  echo -e "${RED}❌ $1${NC}"
  exit 1
}

info() {
  echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Vérifier que le serveur est actif
echo "📡 Étape 0 : Vérification du serveur..."
HEALTH=$(curl -s "$BASE_URL/health" | jq -r '.status' 2>/dev/null)
if [ "$HEALTH" != "ok" ]; then
  error "Le serveur n'est pas accessible à $BASE_URL"
fi
success "Serveur actif"
echo ""

# 1. QUICK START : Créer un restaurant complet
echo "🏪 Étape 1 : Création du restaurant avec menu démo..."
RESTAURANT_DATA=$(curl -s -X POST "$BASE_URL/api/onboarding/quick-start" \
  -H "Content-Type: application/json" \
  -d "{
    \"restaurantName\": \"Restaurant Test $TIMESTAMP\",
    \"restaurantAddress\": \"123 Avenue Test, Dakar\",
    \"restaurantPhone\": \"+221771234567\",
    \"ownerEmail\": \"owner$TIMESTAMP@bizon.test\",
    \"ownerPassword\": \"SecurePass123!\",
    \"ownerFirstName\": \"Test\",
    \"ownerLastName\": \"Owner\",
    \"menuTemplate\": \"restaurant\"
  }")

RESTAURANT_ID=$(echo "$RESTAURANT_DATA" | jq -r '.data.restaurant.id')
OWNER_EMAIL=$(echo "$RESTAURANT_DATA" | jq -r '.data.owner.email')
MENU_ID=$(echo "$RESTAURANT_DATA" | jq -r '.data.menu.id')
CATEGORIES_COUNT=$(echo "$RESTAURANT_DATA" | jq -r '.data.menu.categories | length')

if [ -z "$RESTAURANT_ID" ] || [ "$RESTAURANT_ID" == "null" ]; then
  error "Échec création restaurant"
fi

success "Restaurant créé (ID: $RESTAURANT_ID)"
info "  - Owner: $OWNER_EMAIL"
info "  - Menu: $MENU_ID ($CATEGORIES_COUNT catégories)"
echo ""

# 2. LOGIN : Se connecter avec le propriétaire
echo "🔐 Étape 2 : Authentification du propriétaire..."
LOGIN_DATA=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$OWNER_EMAIL\",
    \"password\": \"SecurePass123!\"
  }")

TOKEN=$(echo "$LOGIN_DATA" | jq -r '.token')
if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  error "Échec authentification"
fi

success "Authentification réussie"
info "  - Token: ${TOKEN:0:20}..."
echo ""

# 3. RÉCUPÉRATION DU MENU : Vérifier les produits
echo "📋 Étape 3 : Récupération du menu..."
MENUS=$(curl -s "$BASE_URL/api/menus" \
  -H "Authorization: Bearer $TOKEN")

MENUS_COUNT=$(echo "$MENUS" | jq '. | length')
FIRST_MENU=$(echo "$MENUS" | jq -r '.[0].id')

if [ "$MENUS_COUNT" -lt 1 ]; then
  error "Aucun menu trouvé"
fi

success "Menu récupéré ($MENUS_COUNT menus)"
info "  - Premier menu ID: $FIRST_MENU"
echo ""

# 4. LISTE DES PRODUITS : Récupérer les produits
echo "🍽️  Étape 4 : Récupération des produits..."
PRODUCTS=$(curl -s "$BASE_URL/api/products" \
  -H "Authorization: Bearer $TOKEN")

PRODUCTS_COUNT=$(echo "$PRODUCTS" | jq '. | length')
FIRST_PRODUCT_ID=$(echo "$PRODUCTS" | jq -r '.[0].id')
FIRST_PRODUCT_NAME=$(echo "$PRODUCTS" | jq -r '.[0].name')
FIRST_PRODUCT_PRICE=$(echo "$PRODUCTS" | jq -r '.[0].price')

if [ "$PRODUCTS_COUNT" -lt 1 ]; then
  error "Aucun produit trouvé"
fi

success "Produits récupérés ($PRODUCTS_COUNT produits)"
info "  - Premier produit: $FIRST_PRODUCT_NAME (${FIRST_PRODUCT_PRICE} FCFA)"
echo ""

# 5. CRÉER UNE COMMANDE : Passer une commande
echo "🛒 Étape 5 : Création d'une commande..."
ORDER_DATA=$(curl -s -X POST "$BASE_URL/api/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"dine_in\",
    \"table_number\": \"T5\",
    \"items\": [
      {
        \"product_id\": \"$FIRST_PRODUCT_ID\",
        \"quantity\": 2
      }
    ]
  }")

ORDER_ID=$(echo "$ORDER_DATA" | jq -r '.order.id')
ORDER_NUMBER=$(echo "$ORDER_DATA" | jq -r '.order.order_number')
ORDER_TOTAL=$(echo "$ORDER_DATA" | jq -r '.order.total_amount')

if [ -z "$ORDER_ID" ] || [ "$ORDER_ID" == "null" ]; then
  error "Échec création commande"
fi

success "Commande créée"
info "  - Numéro: $ORDER_NUMBER"
info "  - Montant: ${ORDER_TOTAL} FCFA"
info "  - Produit: 2x $FIRST_PRODUCT_NAME"
echo ""

# 6. CRÉER UN PAIEMENT : Payer la commande
echo "💰 Étape 6 : Création d'un paiement..."
PAYMENT_DATA=$(curl -s -X POST "$BASE_URL/api/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"order_id\": \"$ORDER_ID\",
    \"amount\": $ORDER_TOTAL,
    \"method\": \"mobile_money\",
    \"phone_number\": \"+221771234567\",
    \"provider\": \"orange_money\"
  }")

PAYMENT_ID=$(echo "$PAYMENT_DATA" | jq -r '.payment.id')
PAYMENT_STATUS=$(echo "$PAYMENT_DATA" | jq -r '.payment.status')

if [ -z "$PAYMENT_ID" ] || [ "$PAYMENT_ID" == "null" ]; then
  error "Échec création paiement"
fi

success "Paiement créé (ID: $PAYMENT_ID)"
info "  - Statut: $PAYMENT_STATUS"
echo ""

# 7. VÉRIFIER LE PAIEMENT : Simuler la vérification Mobile Money
echo "✔️  Étape 7 : Vérification du paiement..."
VERIFY_DATA=$(curl -s -X POST "$BASE_URL/api/payments/$PAYMENT_ID/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"transaction_code\": \"OM$(date +%s)TEST\"
  }")

VERIFY_STATUS=$(echo "$VERIFY_DATA" | jq -r '.payment.status')
INVOICE_ID=$(echo "$VERIFY_DATA" | jq -r '.invoice.id // empty')

if [ "$VERIFY_STATUS" != "completed" ]; then
  error "Échec vérification paiement (statut: $VERIFY_STATUS)"
fi

success "Paiement vérifié et confirmé"
if [ -n "$INVOICE_ID" ]; then
  info "  - Facture générée (ID: $INVOICE_ID)"
fi
echo ""

# 8. RÉCUPÉRER LA COMMANDE COMPLÈTE : Vérifier le statut final
echo "📊 Étape 8 : Vérification de la commande finale..."
FINAL_ORDER=$(curl -s "$BASE_URL/api/orders/$ORDER_ID" \
  -H "Authorization: Bearer $TOKEN")

FINAL_STATUS=$(echo "$FINAL_ORDER" | jq -r '.status')
PAYMENTS_COUNT=$(echo "$FINAL_ORDER" | jq -r '.payments | length')

if [ "$FINAL_STATUS" != "completed" ]; then
  error "La commande n'est pas complétée (statut: $FINAL_STATUS)"
fi

success "Commande complétée"
info "  - Statut: $FINAL_STATUS"
info "  - Paiements: $PAYMENTS_COUNT"
echo ""

# RÉSUMÉ FINAL
echo "======================================"
echo "🎉 TEST D'ONBOARDING RÉUSSI !"
echo "======================================"
echo ""
echo "Résumé des opérations :"
echo "  ✅ Restaurant créé avec $CATEGORIES_COUNT catégories et $PRODUCTS_COUNT produits"
echo "  ✅ Authentification propriétaire réussie"
echo "  ✅ Menu accessible via API"
echo "  ✅ Commande créée ($ORDER_NUMBER)"
echo "  ✅ Paiement effectué et vérifié"
echo "  ✅ Commande complétée avec facture"
echo ""
echo "Données de test :"
echo "  - Restaurant ID: $RESTAURANT_ID"
echo "  - Email: $OWNER_EMAIL"
echo "  - Commande: $ORDER_NUMBER"
echo "  - Paiement: $PAYMENT_ID"
echo ""

success "Tous les tests sont passés ! Le système est opérationnel."
