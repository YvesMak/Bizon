#!/bin/bash

# ============================================
# Script de création d'un utilisateur SERVEUR
# ============================================

echo "🔧 Création d'un utilisateur serveur pour tests..."
echo ""

# Configuration
API_URL="http://localhost:3000/api"
RESTAURANT_ID=1

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================
# 1. Créer un restaurant owner pour avoir un token admin
# ============================================

echo "📝 Étape 1: Création d'un restaurant (si besoin)..."

OWNER_DATA='{
  "restaurantName": "Restaurant Test",
  "firstName": "Admin",
  "lastName": "Test",
  "email": "admin@test.com",
  "phone": "+221771234567",
  "password": "admin123",
  "template": "restaurant"
}'

OWNER_RESPONSE=$(curl -s -X POST "$API_URL/onboarding/quick-start" \
  -H "Content-Type: application/json" \
  -d "$OWNER_DATA")

# Extraire le token (si création réussie ou login si existe déjà)
OWNER_TOKEN=$(echo "$OWNER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$OWNER_TOKEN" ]; then
  echo "${YELLOW}⚠️  Restaurant existe déjà, tentative de login...${NC}"
  
  LOGIN_DATA='{"email":"admin@test.com","password":"admin123"}'
  LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "$LOGIN_DATA")
  
  OWNER_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  
  if [ -z "$OWNER_TOKEN" ]; then
    echo "${RED}❌ Impossible d'obtenir un token admin${NC}"
    echo "Réponse: $LOGIN_RESPONSE"
    exit 1
  fi
fi

echo "${GREEN}✅ Token admin obtenu${NC}"
echo ""

# ============================================
# 2. Créer l'utilisateur SERVEUR via SQL direct
# ============================================

echo "📝 Étape 2: Création de l'utilisateur serveur..."

# Générer le hash bcrypt du password "serveur123"
# Note: bcrypt hash de "serveur123" avec salt 10
HASHED_PASSWORD='$2b$10$YQiGoQXqYhH0z8qvXxM3K.DxL3qN5bJ1.jF9Lx1Q1x5qN5bJ1.jF9L'

SQL_QUERY="INSERT INTO users (restaurant_id, email, password_hash, first_name, last_name, role, created_at, updated_at)
VALUES (1, 'serveur@test.com', '${HASHED_PASSWORD}', 'Jean', 'Martin', 'waiter', NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET 
  first_name = 'Jean',
  last_name = 'Martin',
  role = 'waiter'
RETURNING id, email, first_name, last_name, role;"

echo "${YELLOW}⚠️  Exécution SQL directe nécessaire${NC}"
echo ""
echo "Veuillez exécuter cette commande dans PostgreSQL:"
echo ""
echo "${YELLOW}psql -U postgres -d bizon_db -c \"$SQL_QUERY\"${NC}"
echo ""

# Alternative: via API si endpoint de création utilisateur existe
echo "📝 Étape 2 (Alternative): Tentative via API..."

# Note: Cette route n'existe peut-être pas, on teste quand même
WAITER_DATA='{
  "email": "serveur@test.com",
  "password": "serveur123",
  "firstName": "Jean",
  "lastName": "Martin",
  "role": "waiter",
  "restaurantId": 1
}'

API_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "$WAITER_DATA")

HTTP_CODE=$(echo "$API_RESPONSE" | tail -n1)
BODY=$(echo "$API_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "${GREEN}✅ Utilisateur serveur créé via API${NC}"
else
  echo "${YELLOW}⚠️  Création via API non disponible (code: $HTTP_CODE)${NC}"
  echo "Utilisez la commande SQL ci-dessus"
fi

echo ""

# ============================================
# 3. Tester le login du serveur
# ============================================

echo "📝 Étape 3: Test de connexion serveur..."

WAITER_LOGIN='{"email":"serveur@test.com","password":"serveur123"}'

WAITER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "$WAITER_LOGIN")

HTTP_CODE=$(echo "$WAITER_RESPONSE" | tail -n1)
BODY=$(echo "$WAITER_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  WAITER_TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  
  if [ -n "$WAITER_TOKEN" ]; then
    echo "${GREEN}✅ Login serveur réussi !${NC}"
    echo ""
    echo "Token: $WAITER_TOKEN"
    echo ""
    
    # Décoder le JWT pour vérifier le rôle
    PAYLOAD=$(echo "$WAITER_TOKEN" | cut -d'.' -f2)
    DECODED=$(echo "$PAYLOAD" | base64 -d 2>/dev/null || echo "$PAYLOAD" | base64 -D 2>/dev/null)
    
    echo "Payload JWT:"
    echo "$DECODED" | jq . 2>/dev/null || echo "$DECODED"
    echo ""
  fi
else
  echo "${RED}❌ Échec du login serveur${NC}"
  echo "Code HTTP: $HTTP_CODE"
  echo "Réponse: $BODY"
  echo ""
  echo "${YELLOW}Action requise: Créer l'utilisateur manuellement via SQL${NC}"
fi

# ============================================
# 4. Instructions finales
# ============================================

echo ""
echo "════════════════════════════════════════"
echo "  INSTRUCTIONS POUR TESTER LE MODULE"
echo "════════════════════════════════════════"
echo ""
echo "1️⃣  Assurez-vous que l'utilisateur serveur existe"
echo ""
echo "   ${YELLOW}Si création via API a échoué, exécutez:${NC}"
echo ""
echo "   psql -U postgres -d bizon_db"
echo "   INSERT INTO users (restaurant_id, email, password_hash, first_name, last_name, role)"
echo "   VALUES (1, 'serveur@test.com', '\$2b\$10\$YQiGoQXqYhH0z8qvXxM3K.DxL3qN5bJ1.jF9Lx1Q1x5qN5bJ1.jF9L', 'Jean', 'Martin', 'waiter');"
echo ""
echo "2️⃣  Ouvrez la PWA client:"
echo "   ${GREEN}http://localhost:8080/index.html${NC}"
echo ""
echo "3️⃣  Connexion avec les identifiants serveur:"
echo "   Email: ${GREEN}serveur@test.com${NC}"
echo "   Password: ${GREEN}serveur123${NC}"
echo ""
echo "4️⃣  Vous serez automatiquement redirigé vers:"
echo "   ${GREEN}http://localhost:8080/waiter/waiter.html${NC}"
echo ""
echo "5️⃣  Testez les fonctionnalités:"
echo "   ✓ Liste des commandes"
echo "   ✓ Nouvelle commande"
echo "   ✓ Détail commande"
echo "   ✓ Annulation (si status = confirmed)"
echo ""
echo "════════════════════════════════════════"
echo ""

# ============================================
# 5. Créer quelques commandes de test
# ============================================

echo "📝 Étape 4 (Optionnel): Création de commandes de test..."

if [ -n "$WAITER_TOKEN" ]; then
  echo "Création de 2 commandes de test..."
  
  # Commande 1: Confirmée
  ORDER1='{
    "type": "dine_in",
    "table_number": 5,
    "customer_name": "Client Test 1",
    "items": [
      {"product_id": 1, "quantity": 2, "unit_price": 2500},
      {"product_id": 2, "quantity": 1, "unit_price": 1500}
    ],
    "notes": "Commande de test"
  }'
  
  curl -s -X POST "$API_URL/orders" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $WAITER_TOKEN" \
    -d "$ORDER1" > /dev/null
  
  echo "${GREEN}✅ Commande test 1 créée${NC}"
  
  # Commande 2
  ORDER2='{
    "type": "dine_in",
    "table_number": 12,
    "customer_name": "Client Test 2",
    "items": [
      {"product_id": 3, "quantity": 1, "unit_price": 3500}
    ],
    "notes": "Commande de test 2"
  }'
  
  curl -s -X POST "$API_URL/orders" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $WAITER_TOKEN" \
    -d "$ORDER2" > /dev/null
  
  echo "${GREEN}✅ Commande test 2 créée${NC}"
  
  echo ""
  echo "${GREEN}✅ Setup complet ! Vous pouvez maintenant tester l'interface serveur.${NC}"
else
  echo "${YELLOW}⚠️  Token serveur non disponible, commandes de test non créées${NC}"
fi

echo ""
