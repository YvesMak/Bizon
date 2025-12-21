#!/bin/bash

echo "=== TEST DÉMARRAGE BIZON MVP ==="
echo ""

echo "1. Vérification PostgreSQL..."
if /opt/homebrew/opt/postgresql@15/bin/psql -d bizon_db -c "SELECT 1;" &>/dev/null; then
  echo "✅ PostgreSQL actif et bizon_db accessible"
else
  echo "❌ Problème PostgreSQL"
  exit 1
fi

echo ""
echo "2. Vérification .env..."
if [ -f .env ]; then
  echo "✅ Fichier .env présent"
  grep "DB_USER" .env
  grep "JWT_SECRET" .env | head -c 40
  echo "..."
else
  echo "❌ Fichier .env manquant"
  exit 1
fi

echo ""
echo "3. Vérification storage..."
if [ -d storage/invoices ]; then
  echo "✅ Dossier storage/invoices existe"
else
  echo "❌ Dossier storage/invoices manquant"
  exit 1
fi

echo ""
echo "4. Démarrage serveur en background..."
node src/server.js &
SERVER_PID=$!
echo "PID du serveur: $SERVER_PID"

sleep 5

echo ""
echo "5. Test Health Check..."
if curl -s http://localhost:3000/health | grep -q "ok"; then
  echo "✅ Health check répond OK"
else
  echo "❌ Health check échoue"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi

echo ""
echo "6. Test création restaurant..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Restaurant MVP",
    "email": "test-mvp@bizon.test",
    "password": "Test1234!",
    "phone": "+221771234567",
    "address": "Dakar, Sénégal"
  }')

if echo "$RESPONSE" | grep -q "token"; then
  echo "✅ Création restaurant réussie"
  echo "Token reçu (début):"
  echo "$RESPONSE" | grep -o '"token":"[^"]*"' | head -c 60
  echo "..."
else
  echo "❌ Création restaurant échouée"
  echo "Réponse:"
  echo "$RESPONSE"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi

echo ""
echo "7. Arrêt serveur..."
kill $SERVER_PID 2>/dev/null
sleep 2

echo ""
echo "================================"
echo "✅ TOUS LES TESTS PASSENT"
echo "================================"
echo ""
echo "Le serveur Bizon MVP est prêt pour utilisation."
echo "Lancer avec: npm run dev"
