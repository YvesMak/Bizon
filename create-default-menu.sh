#!/bin/bash

# ============================================
# BIZON - Script création menu par défaut
# ============================================

set -e

API_URL="http://localhost:3000/api"
TOKEN=""

# Connexion et récupération du token
echo "🔐 Connexion..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test-mvp@bizon.test","password":"serveur123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Erreur de connexion"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Connecté"
echo ""

# Fonction API call
api_call() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  curl -s -X "$method" "$API_URL$endpoint" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    ${data:+-d "$data"}
}

# 1. Créer le menu
echo "1️⃣ Création du menu principal..."
MENU_RESPONSE=$(api_call POST "/menus" '{
  "name": "Menu Principal",
  "description": "Notre sélection complète",
  "is_active": true
}')

MENU_ID=$(echo "$MENU_RESPONSE" | jq -r '.menu.id')
echo "✅ Menu créé (ID: $MENU_ID)"
echo ""

# 2. Créer les catégories
echo "2️⃣ Création des catégories..."

# Boissons
CAT_BOISSONS=$(api_call POST "/menus/categories" "{
  \"menu_id\": \"$MENU_ID\",
  \"name\": \"Boissons\",
  \"description\": \"Boissons chaudes, froides et jus\",
  \"display_order\": 1,
  \"is_active\": true
}")
BOISSONS_ID=$(echo "$CAT_BOISSONS" | jq -r '.category.id')
echo "   ✅ Boissons"

# Entrées
CAT_ENTREES=$(api_call POST "/menus/categories" "{
  \"menu_id\": \"$MENU_ID\",
  \"name\": \"Entrées\",
  \"description\": \"Salades et entrées chaudes\",
  \"display_order\": 2,
  \"is_active\": true
}")
ENTREES_ID=$(echo "$CAT_ENTREES" | jq -r '.category.id')
echo "   ✅ Entrées"

# Plats
CAT_PLATS=$(api_call POST "/menus/categories" "{
  \"menu_id\": \"$MENU_ID\",
  \"name\": \"Plats\",
  \"description\": \"Plats principaux\",
  \"display_order\": 3,
  \"is_active\": true
}")
PLATS_ID=$(echo "$CAT_PLATS" | jq -r '.category.id')
echo "   ✅ Plats"

# Desserts
CAT_DESSERTS=$(api_call POST "/menus/categories" "{
  \"menu_id\": \"$MENU_ID\",
  \"name\": \"Desserts\",
  \"description\": \"Douceurs et desserts\",
  \"display_order\": 4,
  \"is_active\": true
}")
DESSERTS_ID=$(echo "$CAT_DESSERTS" | jq -r '.category.id')
echo "   ✅ Desserts"
echo ""

# 3. Créer les produits
echo "3️⃣ Création des produits..."
TOTAL=0

# Fonction création produit
create_product() {
  local cat_id=$1
  local name=$2
  local desc=$3
  local price=$4
  local stock=$5
  
  api_call POST "/products" "{
    \"category_id\": \"$cat_id\",
    \"name\": \"$name\",
    \"description\": \"$desc\",
    \"price\": $price,
    \"is_available\": true,
    \"track_stock\": true,
    \"stock_quantity\": $stock
  }" > /dev/null
  
  echo "      ✓ $name - $price FCFA"
  ((TOTAL++))
}

# BOISSONS
echo "   📦 Boissons:"
create_product "$BOISSONS_ID" "Eau minérale" "Eau plate 50cl" 500 100
create_product "$BOISSONS_ID" "Coca-Cola" "Boisson gazeuse 33cl" 1000 150
create_product "$BOISSONS_ID" "Jus d'orange" "Jus 100% naturel 25cl" 1500 60
create_product "$BOISSONS_ID" "Bissap" "Jus d'hibiscus traditionnel 33cl" 1200 80
create_product "$BOISSONS_ID" "Café noir" "Espresso corsé" 800 200

# ENTRÉES
echo "   📦 Entrées:"
create_product "$ENTREES_ID" "Salade César" "Laitue, poulet grillé, parmesan, croûtons" 3500 30
create_product "$ENTREES_ID" "Fataya viande" "4 pièces - Chaussons frits à la viande" 2500 50
create_product "$ENTREES_ID" "Nems poulet" "5 pièces - Nems croustillants" 3000 35
create_product "$ENTREES_ID" "Pastels" "6 pièces - Beignets de poisson épicés" 2800 45

# PLATS
echo "   📦 Plats:"
create_product "$PLATS_ID" "Thiéboudienne" "Riz au poisson, légumes variés - Plat national" 4500 30
create_product "$PLATS_ID" "Yassa poulet" "Poulet mariné citron-oignon, riz blanc" 4000 35
create_product "$PLATS_ID" "Mafé" "Ragoût sauce arachide, viande, légumes, riz" 4200 30
create_product "$PLATS_ID" "Poulet DG" "Poulet Directeur Général, légumes sautés, plantain" 5500 25
create_product "$PLATS_ID" "Pizza Margherita" "Tomate, mozzarella, basilic" 5000 25
create_product "$PLATS_ID" "Spaghetti Bolognaise" "Sauce tomate, viande hachée" 4200 35

# DESSERTS
echo "   📦 Desserts:"
create_product "$DESSERTS_ID" "Tiramisu" "Dessert italien crémeux au café" 2500 20
create_product "$DESSERTS_ID" "Fondant au chocolat" "Coulant chocolat noir, glace vanille" 2800 25
create_product "$DESSERTS_ID" "Salade de fruits frais" "Fruits de saison, sirop menthe" 2000 30
create_product "$DESSERTS_ID" "Glace vanille" "3 boules, chantilly" 1500 50

echo ""
echo "=================================================="
echo "✅ MENU CRÉÉ AVEC SUCCÈS !"
echo "=================================================="
echo "📋 1 menu"
echo "📁 4 catégories"
echo "🍽️  $TOTAL produits"
echo ""
echo "🎯 Rafraîchissez votre navigateur pour voir le menu !"
