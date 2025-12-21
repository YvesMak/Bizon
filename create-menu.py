#!/usr/bin/env python3
"""Script de création du menu par défaut"""

import requests
import json

API_URL = "http://localhost:3000/api"

# Connexion
print("🔐 Connexion...")
login_res = requests.post(f"{API_URL}/auth/login", json={
    "email": "test-mvp@bizon.test",
    "password": "serveur123"
})
token = login_res.json()['token']
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
print("✅ Connecté\n")

# 1. Créer menu
print("1️⃣ Création du menu...")
menu_res = requests.post(f"{API_URL}/menus", headers=headers, json={
    "name": "Menu Principal",
    "description": "Notre sélection complète",
    "is_active": True
})
menu_id = menu_res.json()['menu']['id']
print(f"✅ Menu créé (ID: {menu_id})\n")

# 2. Créer catégories
print("2️⃣ Création des catégories...")
categories = {}
for name, desc, order in [
    ("Boissons", "Boissons chaudes, froides et jus", 1),
    ("Entrées", "Salades et entrées chaudes", 2),
    ("Plats", "Plats principaux", 3),
    ("Desserts", "Douceurs et desserts", 4)
]:
    cat_res = requests.post(f"{API_URL}/menus/categories", headers=headers, json={
        "menu_id": menu_id,
        "name": name,
        "description": desc,
        "display_order": order,
        "is_active": True
    })
    categories[name] = cat_res.json()['category']['id']
    print(f"   ✅ {name}")
print()

# 3. Créer produits
print("3️⃣ Création des produits...")
products = {
    "Boissons": [
        ("Eau minérale", "Eau plate 50cl", 500, 100),
        ("Coca-Cola", "Boisson gazeuse 33cl", 1000, 150),
        ("Jus d'orange", "Jus 100% naturel 25cl", 1500, 60),
        ("Bissap", "Jus d'hibiscus traditionnel 33cl", 1200, 80),
        ("Café noir", "Espresso corsé", 800, 200),
    ],
    "Entrées": [
        ("Salade César", "Laitue, poulet grillé, parmesan, croûtons", 3500, 30),
        ("Fataya viande", "4 pièces - Chaussons frits à la viande", 2500, 50),
        ("Nems poulet", "5 pièces - Nems croustillants", 3000, 35),
        ("Pastels", "6 pièces - Beignets de poisson épicés", 2800, 45),
    ],
    "Plats": [
        ("Thiéboudienne", "Riz au poisson, légumes variés", 4500, 30),
        ("Yassa poulet", "Poulet mariné citron-oignon, riz", 4000, 35),
        ("Mafé", "Ragoût sauce arachide, viande, riz", 4200, 30),
        ("Poulet DG", "Poulet DG, légumes sautés, plantain", 5500, 25),
        ("Pizza Margherita", "Tomate, mozzarella, basilic", 5000, 25),
        ("Spaghetti Bolognaise", "Sauce tomate, viande hachée", 4200, 35),
    ],
    "Desserts": [
        ("Tiramisu", "Dessert italien au café", 2500, 20),
        ("Fondant chocolat", "Coulant chocolat, glace vanille", 2800, 25),
        ("Salade de fruits", "Fruits de saison, sirop menthe", 2000, 30),
        ("Glace vanille", "3 boules, chantilly", 1500, 50),
    ]
}

total = 0
for cat_name, items in products.items():
    print(f"   📦 {cat_name}:")
    for name, desc, price, stock in items:
        try:
            requests.post(f"{API_URL}/products", headers=headers, json={
                "category_id": categories[cat_name],
                "name": name,
                "description": desc,
                "price": price,
                "is_available": True,
                "track_stock": True,
                "stock_quantity": stock
            })
            print(f"      ✓ {name} - {price} FCFA")
            total += 1
        except Exception as e:
            print(f"      ✗ {name} - {e}")

print("\n" + "="*50)
print("✅ MENU CRÉÉ AVEC SUCCÈS !")
print("="*50)
print(f"📋 1 menu")
print(f"📁 4 catégories")
print(f"🍽️  {total} produits")
print("\n🎯 Rafraîchissez votre navigateur !")
