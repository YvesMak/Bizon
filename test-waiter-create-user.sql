-- ============================================
-- SQL: Création d'un utilisateur SERVEUR
-- ============================================

-- 1. Créer l'utilisateur serveur (associé au restaurant ID 1)
-- Password: "serveur123" (hash bcrypt)

INSERT INTO users (
    restaurant_id, 
    email, 
    password_hash, 
    first_name, 
    last_name, 
    role,
    created_at,
    updated_at
)
VALUES (
    1,  -- ID du premier restaurant créé
    'serveur@test.com',
    '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdTv/HkXO',  -- hash de "serveur123"
    'Jean',
    'Martin',
    'waiter',
    NOW(),
    NOW()
)
ON CONFLICT (email) 
DO UPDATE SET 
    first_name = 'Jean',
    last_name = 'Martin',
    role = 'waiter',
    restaurant_id = 1;

-- 2. Vérifier la création
SELECT id, email, first_name, last_name, role, restaurant_id 
FROM users 
WHERE email = 'serveur@test.com';

-- ============================================
-- INSTRUCTIONS D'UTILISATION
-- ============================================

-- Exécuter dans le terminal:
-- psql -U postgres -d bizon_db -f test-waiter-create-user.sql

-- Ou directement dans psql:
-- psql -U postgres -d bizon_db
-- Puis copier-coller les commandes INSERT et SELECT ci-dessus

-- ============================================
-- TEST DE LOGIN
-- ============================================

-- Après création, tester via curl:
-- curl -X POST http://localhost:3000/api/auth/login \
--   -H "Content-Type: application/json" \
--   -d '{"email":"serveur@test.com","password":"serveur123"}'

-- Réponse attendue:
-- {
--   "message": "Connexion réussie",
--   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
--   "user": {
--     "id": X,
--     "email": "serveur@test.com",
--     "firstName": "Jean",
--     "lastName": "Martin",
--     "role": "waiter",
--     "restaurant_id": 1
--   }
-- }

-- ============================================
-- CRÉER UN DEUXIÈME SERVEUR (OPTIONNEL)
-- ============================================

INSERT INTO users (
    restaurant_id, 
    email, 
    password_hash, 
    first_name, 
    last_name, 
    role,
    created_at,
    updated_at
)
VALUES (
    1,
    'marie.serveur@test.com',
    '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdTv/HkXO',
    'Marie',
    'Dubois',
    'waiter',
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;
