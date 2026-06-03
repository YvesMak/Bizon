# Tests & Migrations — Bizon

Mise en place du Sprint 1 : tests automatisés (Jest + Supertest) et migrations
Sequelize versionnées (remplacent les `ALTER TABLE` manuels et `sequelize.sync`).

---

## 🧪 Tests

### Pré-requis (une seule fois)

```bash
# 1. Copier la config de test et l'adapter (DB_USER notamment)
cp .env.test.example .env.test

# 2. Créer la base de test PostgreSQL
createdb bizon_test
```

> La base de test est **isolée** (`bizon_test`). Le code refuse de tourner les
> tests sur une base dont le nom ne contient pas « test » (garde-fou dans
> `tests/setup.js`).

### Lancer les tests

```bash
npm test              # toute la suite
npm run test:watch    # mode watch
npm run test:coverage # avec rapport de couverture
```

### Organisation

```
tests/
├── load-env.js        # charge .env.test avant tout (setupFiles)
├── setup.js           # sync({force}) avant chaque fichier, truncate après chaque test
├── helpers/factory.js # fabriques de données (restaurant, user, customer, menu…)
├── unit/              # tests unitaires (hash mot de passe, JWT)
└── integration/       # tests API via Supertest (auth, customers, public, health)
```

- Chaque **fichier** de test reconstruit un schéma propre (`sync({ force: true })`).
- Chaque **test** repart d'une base vide (`truncate` en `afterEach`).
- Exécution **séquentielle** (`--runInBand`) pour une base déterministe.

### Architecture testable

`src/server.js` a été scindé :
- **`src/app.js`** — l'application Express (exportable, sans `listen` ni connexion DB).
- **`src/server.js`** — démarrage (connexion DB + `app.listen`).

Supertest importe `src/app.js` directement, sans ouvrir de port ni dépendre du
démarrage réel.

---

## 🗃️ Migrations Sequelize

Infrastructure `sequelize-cli` configurée via `.sequelizerc` →
`src/config/sequelize-cli.js` (lit `.env` ou `.env.test` selon `NODE_ENV`).

### Commandes

```bash
npm run db:migrate          # applique les migrations en attente (dev)
npm run db:migrate:undo     # annule la dernière migration
npm run db:migrate:status   # liste l'état des migrations
npm run db:migrate:test     # applique sur la base de test (NODE_ENV=test)
```

### Migration baseline

`src/migrations/20260603000000-baseline-schema.js` recrée l'intégralité du schéma
(11 tables) fidèlement aux modèles. `createTable` génère du
`CREATE TABLE IF NOT EXISTS` sous PostgreSQL : sûr sur base vierge **et** existante.

### Adopter une base existante (`bizon_db`)

La base de dev historique a été créée par `sequelize.sync`. Pour la passer sous
contrôle des migrations **sans risque** (éviter un conflit sur les types ENUM
déjà présents), marquer la baseline comme déjà appliquée :

```bash
# Crée la table de suivi et enregistre la baseline comme "déjà exécutée"
psql bizon_db -c 'CREATE TABLE IF NOT EXISTS "SequelizeMeta" (name VARCHAR(255) PRIMARY KEY);'
psql bizon_db -c "INSERT INTO \"SequelizeMeta\"(name) VALUES ('20260603000000-baseline-schema.js') ON CONFLICT DO NOTHING;"
```

Les **futures** migrations (ex. `add-vouchers`, `add-delivery-fields`) s'appliqueront
ensuite normalement via `npm run db:migrate`.

### Créer une nouvelle migration

```bash
npx sequelize-cli migration:generate --name add-vouchers
# éditer le fichier généré dans src/migrations/, puis :
npm run db:migrate
```

> ⚠️ Ne plus utiliser `sequelize.sync({ alter: true })` ni les `ALTER TABLE`
> manuels en production : toute évolution de schéma passe par une migration.
