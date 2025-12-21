-- ============================================
-- BIZON - Menu par défaut
-- Création catégories + produits avec prix
-- Utilise le menu_id existant
-- ============================================

-- Vérifier le menu_id
DO $$
DECLARE
    v_menu_id UUID;
    v_restaurant_id UUID := '99d20088-b7ca-4cb0-9f1c-2fa5c2cfcc03';
BEGIN
    SELECT id INTO v_menu_id 
    FROM menus 
    WHERE restaurant_id = v_restaurant_id 
    ORDER BY created_at DESC LIMIT 1;
    
    IF v_menu_id IS NULL THEN
        RAISE EXCEPTION 'Aucun menu trouvé. Créez d''abord un menu via l''API.';
    END IF;
    
    RAISE NOTICE 'Utilisation du menu ID: %', v_menu_id;
END $$;

-- ============================================
-- CATÉGORIES
-- ============================================

INSERT INTO categories (id, restaurant_id, menu_id, name, description, is_active, display_order, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    '99d20088-b7ca-4cb0-9f1c-2fa5c2cfcc03',
    (SELECT id FROM menus WHERE restaurant_id = '99d20088-b7ca-4cb0-9f1c-2fa5c2cfcc03' ORDER BY created_at DESC LIMIT 1),
    name,
    description,
    true,
    display_order,
    NOW(),
    NOW()
FROM (VALUES
    ('Boissons', 'Boissons chaudes, froides et jus', 1),
    ('Entrées', 'Salades et entrées chaudes', 2),
    ('Plats', 'Plats principaux', 3),
    ('Desserts', 'Douceurs et desserts', 4)
) AS t(name, description, display_order)
ON CONFLICT DO NOTHING;

-- ============================================
-- PRODUITS - BOISSONS
-- ============================================

-- Récupérer l'ID de la catégorie Boissons
WITH cat_boissons AS (
    SELECT id FROM categories WHERE name = 'Boissons' AND restaurant_id = '99d20088-b7ca-4cb0-9f1c-2fa5c2cfcc03' LIMIT 1
)
INSERT INTO products (id, restaurant_id, category_id, name, description, price, is_available, track_stock, stock_quantity, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    '99d20088-b7ca-4cb0-9f1c-2fa5c2cfcc03',
    cat_boissons.id,
    name,
    description,
    price,
    true,
    true,
    stock,
    NOW(),
    NOW()
FROM cat_boissons, (VALUES
    ('Eau minérale', 'Eau plate 50cl', 500, 100),
    ('Eau gazeuse', 'Eau pétillante 50cl', 600, 80),
    ('Coca-Cola', 'Boisson gazeuse 33cl', 1000, 150),
    ('Fanta Orange', 'Boisson gazeuse 33cl', 1000, 120),
    ('Sprite', 'Boisson gazeuse 33cl', 1000, 120),
    ('Jus d''orange', 'Jus 100% naturel 25cl', 1500, 60),
    ('Jus de mangue', 'Jus 100% naturel 25cl', 1500, 50),
    ('Bissap', 'Jus d''hibiscus traditionnel 33cl', 1200, 80),
    ('Gingembre', 'Jus de gingembre frais 33cl', 1200, 70),
    ('Café noir', 'Espresso corsé', 800, 200),
    ('Café au lait', 'Café crème onctueux', 1200, 150),
    ('Thé vert', 'Thé vert nature', 700, 100),
    ('Thé à la menthe', 'Thé menthe sucré', 800, 100)
) AS t(name, description, price, stock)
ON CONFLICT DO NOTHING;

-- ============================================
-- PRODUITS - ENTRÉES
-- ============================================

WITH cat_entrees AS (
    SELECT id FROM categories WHERE name = 'Entrées' AND restaurant_id = '99d20088-b7ca-4cb0-9f1c-2fa5c2cfcc03' LIMIT 1
)
INSERT INTO products (id, restaurant_id, category_id, name, description, price, is_available, track_stock, stock_quantity, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    '99d20088-b7ca-4cb0-9f1c-2fa5c2cfcc03',
    cat_entrees.id,
    name,
    description,
    price,
    true,
    true,
    stock,
    NOW(),
    NOW()
FROM cat_entrees, (VALUES
    ('Salade César', 'Laitue, poulet grillé, parmesan, croûtons', 3500, 30),
    ('Salade niçoise', 'Tomates, thon, œufs, olives, haricots', 3200, 25),
    ('Salade verte', 'Mesclun, vinaigrette maison', 2000, 40),
    ('Fataya viande', '4 pièces - Chaussons frits à la viande', 2500, 50),
    ('Fataya poisson', '4 pièces - Chaussons frits au poisson', 2500, 40),
    ('Nems poulet', '5 pièces - Nems croustillants', 3000, 35),
    ('Pastels', '6 pièces - Beignets de poisson épicés', 2800, 45),
    ('Accras de morue', '8 pièces - Beignets antillais', 3200, 30),
    ('Soupe du jour', 'Soupe fraîche maison', 2000, 20)
) AS t(name, description, price, stock)
ON CONFLICT DO NOTHING;

-- ============================================
-- PRODUITS - PLATS
-- ============================================

WITH cat_plats AS (
    SELECT id FROM categories WHERE name = 'Plats' AND restaurant_id = '99d20088-b7ca-4cb0-9f1c-2fa5c2cfcc03' LIMIT 1
)
INSERT INTO products (id, restaurant_id, category_id, name, description, price, is_available, track_stock, stock_quantity, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    '99d20088-b7ca-4cb0-9f1c-2fa5c2cfcc03',
    cat_plats.id,
    name,
    description,
    price,
    true,
    true,
    stock,
    NOW(),
    NOW()
FROM cat_plats, (VALUES
    ('Thiéboudienne', 'Riz au poisson, légumes variés - Plat national', 4500, 30),
    ('Yassa poulet', 'Poulet mariné citron-oignon, riz blanc', 4000, 35),
    ('Yassa poisson', 'Poisson braisé sauce yassa, riz', 5000, 25),
    ('Mafé', 'Ragoût sauce arachide, viande, légumes, riz', 4200, 30),
    ('Bassi salté', 'Couscous sénégalais, viande grillée', 4800, 20),
    ('Poulet DG', 'Poulet Directeur Général, légumes sautés, plantain', 5500, 25),
    ('Poisson braisé', 'Poisson entier grillé, attiéké ou riz', 6000, 20),
    ('Côtelettes d''agneau', '4 pièces grillées, frites, salade', 7500, 15),
    ('Steak de bœuf', '250g grillé, sauce au choix, accompagnement', 6500, 18),
    ('Pizza Margherita', 'Tomate, mozzarella, basilic', 5000, 25),
    ('Pizza 4 fromages', 'Mozzarella, emmental, chèvre, parmesan', 6000, 20),
    ('Pasta Carbonara', 'Spaghetti, lardons, crème, parmesan', 4500, 30),
    ('Spaghetti Bolognaise', 'Sauce tomate, viande hachée', 4200, 35),
    ('Tagliatelles fruits de mer', 'Crevettes, calamars, moules, sauce tomate', 6500, 20)
) AS t(name, description, price, stock)
ON CONFLICT DO NOTHING;

-- ============================================
-- PRODUITS - DESSERTS
-- ============================================

WITH cat_desserts AS (
    SELECT id FROM categories WHERE name = 'Desserts' AND restaurant_id = '99d20088-b7ca-4cb0-9f1c-2fa5c2cfcc03' LIMIT 1
)
INSERT INTO products (id, restaurant_id, category_id, name, description, price, is_available, track_stock, stock_quantity, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    '99d20088-b7ca-4cb0-9f1c-2fa5c2cfcc03',
    cat_desserts.id,
    name,
    description,
    price,
    true,
    true,
    stock,
    NOW(),
    NOW()
FROM cat_desserts, (VALUES
    ('Tiramisu', 'Dessert italien crémeux au café', 2500, 20),
    ('Fondant au chocolat', 'Coulant chocolat noir, glace vanille', 2800, 25),
    ('Tarte citron meringuée', 'Tarte acidulée, meringue douce', 2300, 18),
    ('Salade de fruits frais', 'Fruits de saison, sirop menthe', 2000, 30),
    ('Crème brûlée', 'Crème vanille caramélisée', 2500, 20),
    ('Glace vanille', '3 boules, chantilly', 1500, 50),
    ('Glace chocolat', '3 boules, chantilly', 1500, 50),
    ('Glace mangue', '3 boules, chantilly', 1800, 40),
    ('Thiakry', 'Couscous sucré, lait caillé, vanille', 1800, 35),
    ('Ngalakh', 'Dessert mil, pâte d''arachide, raisins', 2000, 25)
) AS t(name, description, price, stock)
ON CONFLICT DO NOTHING;

-- ============================================
-- RÉSUMÉ
-- ============================================

SELECT 
    c.name AS categorie,
    COUNT(p.id) AS nb_produits,
    MIN(p.price) AS prix_min,
    MAX(p.price) AS prix_max,
    SUM(p.stock_quantity) AS stock_total
FROM categories c
LEFT JOIN products p ON c.id = p.category_id
WHERE c.restaurant_id = '99d20088-b7ca-4cb0-9f1c-2fa5c2cfcc03'
GROUP BY c.name, c.display_order
ORDER BY c.display_order;

SELECT 'Menu créé avec succès!' AS message;
