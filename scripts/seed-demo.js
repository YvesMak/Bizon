#!/usr/bin/env node
/**
 * Crée un restaurant de DÉMO complet (menu + comptes) pour tester rapidement
 * une version déployée et envoyer un lien de test.
 *
 * Usage :
 *   node scripts/seed-demo.js            # crée la démo (n'écrase pas si elle existe)
 *   node scripts/seed-demo.js --reset    # supprime puis recrée la démo
 *
 * À la fin, affiche le lien client + les identifiants manager/serveur.
 */
require('dotenv').config();
const { sequelize } = require('../src/config/database');
const {
  Restaurant, User, Subscription, Menu, Category, Product, initModels
} = require('../src/models');

const SLUG = process.env.DEMO_SLUG || 'resto-demo';
const PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';
const OWNER_EMAIL = process.env.DEMO_OWNER_EMAIL || 'demo@bizon.cm';
const WAITER_EMAIL = process.env.DEMO_WAITER_EMAIL || 'serveur@bizon.cm';
const KITCHEN_EMAIL = process.env.DEMO_KITCHEN_EMAIL || 'cuisine@bizon.cm';
const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

const MENU = [
  {
    category: 'Entrées', emoji: '🥗', products: [
      { name: 'Salade de crudités', price: 1500, desc: 'Tomates, concombre, vinaigrette maison' },
      { name: 'Beignets haricots', price: 1000, desc: 'Accompagnés de bouillie' }
    ]
  },
  {
    category: 'Plats', emoji: '🍛', products: [
      { name: 'Poulet DG', price: 4500, desc: 'Poulet, plantains mûrs, légumes' },
      { name: 'Ndolè crevettes', price: 5000, desc: 'Spécialité maison, riz ou plantain' },
      { name: 'Riz sauté', price: 3000, desc: 'Riz wok, légumes, œuf' }
    ]
  },
  {
    category: 'Boissons', emoji: '🥤', products: [
      { name: 'Jus de gingembre', price: 1000, desc: 'Fait maison, bien frais' },
      { name: 'Eau minérale', price: 500, desc: '50 cl' }
    ]
  },
  {
    category: 'Desserts', emoji: '🍰', products: [
      { name: 'Beignet sucré', price: 800, desc: 'Croustillant' }
    ]
  }
];

async function destroyExisting() {
  const existing = await Restaurant.findOne({ where: { slug: SLUG } });
  if (!existing) return;
  const rid = existing.id;
  // Suppression dans l'ordre des dépendances
  await Product.destroy({ where: { restaurant_id: rid } });
  await Category.destroy({ where: { restaurant_id: rid } });
  await Menu.destroy({ where: { restaurant_id: rid } });
  await Subscription.destroy({ where: { restaurant_id: rid } });
  await User.destroy({ where: { restaurant_id: rid } });
  await Restaurant.destroy({ where: { id: rid } });
}

async function main() {
  const reset = process.argv.includes('--reset');
  await sequelize.authenticate();
  initModels();

  const already = await Restaurant.findOne({ where: { slug: SLUG } });
  if (already && !reset) {
    printSummary(already);
    console.log('\nℹ️  La démo existe déjà. Relancez avec --reset pour la recréer à neuf.');
    await sequelize.close();
    return;
  }
  if (reset) await destroyExisting();

  const t = await sequelize.transaction();
  try {
    const restaurant = await Restaurant.create({
      name: 'Restaurant Démo Bizon',
      slug: SLUG,
      address: 'Akwa, Douala',
      phone: '+237600000000',
      email: OWNER_EMAIL,
      status: 'active',
      settings: { service_types: ['dine_in', 'takeaway', 'delivery'] }
    }, { transaction: t });

    const owner = await User.create({
      restaurant_id: restaurant.id,
      email: OWNER_EMAIL, password: PASSWORD,
      first_name: 'Demo', last_name: 'Owner',
      role: 'owner', status: 'active', max_restaurants: 1
    }, { transaction: t });
    await restaurant.update({ owner_id: owner.id }, { transaction: t });

    await User.create({
      restaurant_id: restaurant.id,
      email: WAITER_EMAIL, password: PASSWORD,
      first_name: 'Demo', last_name: 'Serveur',
      role: 'waiter', status: 'active'
    }, { transaction: t });

    await User.create({
      restaurant_id: restaurant.id,
      email: KITCHEN_EMAIL, password: PASSWORD,
      first_name: 'Demo', last_name: 'Cuisine',
      role: 'kitchen', status: 'active'
    }, { transaction: t });

    const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 30);
    await Subscription.create({
      restaurant_id: restaurant.id, plan: 'trial', status: 'active',
      start_date: new Date(), end_date: trialEnd, max_users: 5, max_products: 100
    }, { transaction: t });

    const menu = await Menu.create({
      restaurant_id: restaurant.id, name: 'Menu principal',
      is_active: true, display_order: 0
    }, { transaction: t });

    let catOrder = 0;
    for (const cat of MENU) {
      const category = await Category.create({
        restaurant_id: restaurant.id, menu_id: menu.id,
        name: cat.category, is_active: true, display_order: catOrder++
      }, { transaction: t });
      let pOrder = 0;
      for (const p of cat.products) {
        await Product.create({
          restaurant_id: restaurant.id, category_id: category.id,
          name: p.name, description: p.desc, price: p.price,
          is_available: true, track_stock: false, stock_quantity: 100,
          display_order: pOrder++
        }, { transaction: t });
      }
    }

    await t.commit();
    printSummary(restaurant);
    console.log('\n✅ Démo créée avec succès.');
  } catch (err) {
    await t.rollback();
    throw err;
  }
  await sequelize.close();
}

function printSummary(restaurant) {
  const line = '─'.repeat(60);
  console.log('\n' + line);
  console.log('  🍽️  RESTAURANT DÉMO BIZON');
  console.log(line);
  console.log(`  Lien CLIENT (à envoyer) : ${BASE_URL}/?r=${restaurant.slug}`);
  console.log('');
  console.log(`  MANAGER  : ${BASE_URL}/manager/`);
  console.log(`     email : ${OWNER_EMAIL}   mot de passe : ${PASSWORD}`);
  console.log('');
  console.log(`  SERVEUR  : ${BASE_URL}/staff/login.html`);
  console.log(`     email : ${WAITER_EMAIL}   mot de passe : ${PASSWORD}`);
  console.log('');
  console.log(`  CUISINE  : ${BASE_URL}/staff/login.html  (→ écran cuisine)`);
  console.log(`     email : ${KITCHEN_EMAIL}   mot de passe : ${PASSWORD}`);
  console.log('');
  console.log(`  ADMIN    : ${BASE_URL}/admin/   (compte via : npm run create-admin)`);
  console.log(line);
}

main().catch((err) => {
  console.error('❌ Erreur seed démo :', err.message);
  process.exit(1);
});
