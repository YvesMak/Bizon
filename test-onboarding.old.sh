#!/bin/bash

# Script de test de l'onboarding Bizon
# Valide la création automatique du menu par défaut

BASE_URL="http://localhost:3000"
RESTAURANT_NAME="Restaurant Test Onboarding"
OWNER_EMAIL="onboarding$(date +%s)@test.com"
OWNER_PASSWORD="Test1234!"

echo "🧪 TEST ONBOARDING - Bizon Backend"
echo "====================================="
echo ""

# Fonction pour formater le JSON
format_json() {
  if command -v jq &> /dev/null; then
    echo "$1" | jq '.'
  else
    echo "$1"
  fi
}

# 1. Inscription du restaurant
echo "1️⃣  Inscription du restaurant..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantName": "'"$RESTAURANT_NAME"'",
    "firstName": "Jean",
    "lastName": "Dupont",
    "email": "'"$OWNER_EMAIL"'",
    "password": "'"$OWNER_PASSWORD"'"
  }')

echo "Réponse:"
format_json "$REGISTER_RESPONSE"
echo ""

# Extraction du token
TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Erreur: Token non reçu"
  exit 1
fi

echo "✅ Token reçu: ${TOKEN:0:50}..."
echo ""

# 2. Vérification du statut AVANT onboarding
echo "2️⃣  Vérification statut (avant onboarding)..."
STATUS_BEFORE=$(curl -s -X GET "$BASE_URL/api/onboarding/status" \
  -H "Authorization: Bearer $TOKEN")

echo "Réponse:"
format_json "$STATUS_BEFORE"
echo ""

# 3. Lancement de l'onboarding
echo "3️⃣  Lancement de l'onboarding (création menu par défaut)..."
SETUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/onboarding/setup" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Réponse:"
format_json "$SETUP_RESPONSE"
echo ""

# Vérification succès
if echo "$SETUP_RESPONSE" | grep -q '"menu"'; then
  echo "✅ Menu créé avec succès"
else
  echo "❌ Erreur lors de la création du menu"
  exit 1
fi

# 4. Vérification du statut APRÈS onboarding
echo "4️⃣  Vérification statut (après onboarding)..."
STATUS_AFTER=$(curl -s -X GET "$BASE_URL/api/onboarding/status" \
  -H "Authorization: Bearer $TOKEN")

echo "Réponse:"
format_json "$STATUS_AFTER"
echo ""

# 5. Récupération du menu créé
echo "5️⃣  Récupération du menu créé..."
MENUS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/menus" \
  -H "Authorization: Bearer $TOKEN")

echo "Réponse:"
format_json "$MENUS_RESPONSE"
echo ""

# Vérifications
CATEGORIES_COUNT=$(echo "$MENUS_RESPONSE" | grep -o '"categories"' | wc -l)
PRODUCTS_COUNT=$(echo "$MENUS_RESPONSE" | grep -o '"name"' | wc -l)

echo "📊 Résultats:"
echo "   - Catégories trouvées: $CATEGORIES_COUNT"
echo "   - Produits trouvés: environ $PRODUCTS_COUNT"
echo ""

# 6. Test re-onboarding (doit échouer)
echo "6️⃣  Test re-onboarding (doit échouer)..."
RERUN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/onboarding/setup" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Réponse:"
format_json "$RERUN_RESPONSE"
echo ""

if echo "$RERUN_RESPONSE" | grep -q "déjà"; then
  echo "✅ Protection contre le double onboarding fonctionne"
else
  echo "⚠️  Attention: le re-onboarding n'a pas été bloqué"
fi

echo ""
echo "✅ TEST TERMINÉ - Vérifiez les logs ci-dessus"
echo ""
echo "💡 Pour re-initialiser avec force: curl -X POST $BASE_URL/api/onboarding/setup?force=true -H \"Authorization: Bearer \$TOKEN\""
