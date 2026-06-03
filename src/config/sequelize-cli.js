// Configuration consommée par sequelize-cli (db:migrate, etc.)
// Charge .env.test en environnement de test, .env sinon.
const path = require('path');
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

const base = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD || null,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  logging: false
};

module.exports = {
  development: { ...base, database: process.env.DB_NAME },
  test: { ...base, database: process.env.DB_NAME_TEST || 'bizon_test' },
  production: {
    ...base,
    database: process.env.DB_NAME,
    dialectOptions: process.env.DB_SSL === 'true'
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {}
  }
};
