#!/usr/bin/env node

/**
 * Script de création menu par défaut via API
 * Usage: node create-default-menu.js <TOKEN>
 */

const token = process.argv[2];
if (!token) {
  console.error('Usage: node create-default-menu.js <TOKEN>');
  console.error('Obtenez le token en vous connectant: curl -X POST http://localhost:3000/api/auth/login ...');
  process.exit(1);
}

const API_URL = 'http://localhost:3000/api';

async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, options);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Erreur API');
  }
  
  return data;
}

// Données du menu par défaut
const MENU_DATA = {
  name: 'Menu Principal',
  description: 'Notre sélection complète',
  is_active: true
};

const CATEGORIES = [
  { name: 'Boissons', description: 'Boissons chaudes, froides et jus', order: 1 },
  { name: 'Entrées', description: 'Salades et entrées chaudes', order: 2 },
  { name: 'Plats', description: 'Plats principaux', order: 3 },
  { name: 'Desserts', description: 'Douceurs et desserts', order: 4 }
];

const PRODUCTS = {
  'Boissons': [
    { name: 'Eau minérale', description: 'Eau plate 50cl', price: 500, stock: 100 },
    { name: 'Eau gazeuse', description: 'Eau pétillante 50cl', price: 600, stock: 80 },
    { name: 'Coca-Cola', description: 'Boisson gazeuse 33cl', price: 1000, stock: 150 },
    { name: 'Fanta Orange', description: 'Boisson gazeuse 33cl', price: 1000, stock: 120 },
    { name: 'Sprite', description: 'Boisson gazeuse 33cl', price: 1000, stock: 120 },
    { name: 'Jus d\'orange', description: 'Jus 100% naturel 25cl', price: 1500, stock: 60 },
    { name: 'Jus de mangue', description: 'Jus 100% naturel 25cl', price: 1500, stock: 50 },
    { name: 'Bissap', description: 'Jus d\'hibiscus traditionnel 33cl', price: 1200, stock: 80 },
    { name: 'Café noir', description: 'Espresso corsé', price: 800, stock: 200 },
    { name: 'Thé à la menthe', description: 'Thé menthe sucré', price: 800, stock: 100 }
  ],
  'Entrées': [
    { name: 'Salade César', description: 'Laitue, poulet grillé, parmesan, croûtons', price: 3500, stock: 30 },
    { name: 'Salade niçoise', description: 'Tomates, thon, œufs, olives, haricots', price: 3200, stock: 25 },
    { name: 'Fataya viande', description: '4 pièces - Chaussons frits à la viande', price: 2500, stock: 50 },
    { name: 'Fataya poisson', description: '4 pièces - Chaussons frits au poisson', price: 2500, stock: 40 },
    { name: 'Nems poulet', description: '5 pièces - Nems croustillants', price: 3000, stock: 35 },
    { name: 'Pastels', description: '6 pièces - Beignets de poisson épicés', price: 2800, stock: 45 }
  ],
  'Plats': [
    { name: 'Thiéboudienne', description: 'Riz au poisson, légumes variés - Plat national', price: 4500, stock: 30 },
    { name: 'Yassa poulet', description: 'Poulet mariné citron-oignon, riz blanc', price: 4000, stock: 35 },
    { name: 'Yassa poisson', description: 'Poisson braisé sauce yassa, riz', price: 5000, stock: 25 },
    { name: 'Mafé', description: 'Ragoût sauce arachide, viande, légumes, riz', price: 4200, stock: 30 },
    { name: 'Poulet DG', description: 'Poulet Directeur Général, légumes sautés, plantain', price: 5500, stock: 25 },
    { name: 'Poisson braisé', description: 'Poisson entier grillé, attiéké ou riz', price: 6000, stock: 20 },
    { name: 'Pizza Margherita', description: 'Tomate, mozzarella, basilic', price: 5000, stock: 25 },
    { name: 'Spaghetti Bolognaise', description: 'Sauce tomate, viande hachée', price: 4200, stock: 35 }
  ],
  'Desserts': [
    { name: 'Tiramisu', description: 'Dessert italien crémeux au café', price: 2500, stock: 20 },
    { name: 'Fondant au chocolat', description: 'Coulant chocolat noir, glace vanille', price: 2800, stock: 25 },
    { name: 'Salade de fruits frais', description: 'Fruits de saison, sirop menthe', price: 2000, stock: 30 },
    { name: 'Glace vanille', description: '3 boules, chantilly', price: 1500, stock: 50 },
    { name: 'Thiakry', description: 'Couscous sucré, lait caillé, vanille', price: 1800, stock: 35 }
  ]
};

async function main() {
  try {
    console.log('🚀 Création du menu par défaut...\n');
    
    // 1. Créer le menu
    console.log('1️⃣ Création du menu principal...');
    const menu = await apiCall('/menus', 'POST', MENU_DATA);
    console.log(`✅ Menu créé: "${menu.menu.name}" (ID: ${menu.menu.id})\n`);
    
    const menuId = menu.menu.id;
    const categoryIds = {};
    let totalProducts = 0;
    
    // 2. Créer les catégories
    console.log('2️⃣ Création des catégories...');
    for (const cat of CATEGORIES) {
      const category = await apiCall('/menus/categories', 'POST', {
        menu_id: menuId,
        name: cat.name,
        description: cat.description,
        display_order: cat.order,
        is_active: true
      });
      categoryIds[cat.name] = category.category.id;
      console.log(`   ✅ ${cat.name} (${PRODUCTS[cat.name].length} produits)`);
    }
    console.log('');
    
    // 3. Créer les produits
    console.log('3️⃣ Création des produits...');
    for (const [categoryName, products] of Object.entries(PRODUCTS)) {
      console.log(`   📦 ${categoryName}:`);
      for (const prod of products) {
        try {
          await apiCall('/products', 'POST', {
            category_id: categoryIds[categoryName],
            name: prod.name,
            description: prod.description,
            price: prod.price,
            is_available: true,
            track_stock: true,
            stock_quantity: prod.stock
          });
          console.log(`      ✓ ${prod.name} - ${prod.price} FCFA`);
          totalProducts++;
        } catch (err) {
          console.log(`      ✗ ${prod.name} - ${err.message}`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ MENU CRÉÉ AVEC SUCCÈS !');
    console.log('='.repeat(50));
    console.log(`📋 1 menu`);
    console.log(`📁 ${CATEGORIES.length} catégories`);
    console.log(`🍽️  ${totalProducts} produits`);
    console.log('\n🎯 Rafraîchissez votre navigateur pour voir le menu !');
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();
