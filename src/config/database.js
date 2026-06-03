const { Sequelize } = require('sequelize');
require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';

// En test, on cible une base dédiée et isolée pour ne jamais toucher aux données réelles.
const dbName = isTest
  ? (process.env.DB_NAME_TEST || 'bizon_test')
  : process.env.DB_NAME;

// Configuration de la connexion PostgreSQL
const sequelize = new Sequelize(
  dbName,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    }
  }
);

// Test de connexion
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion PostgreSQL établie avec succès');
  } catch (error) {
    console.error('❌ Erreur de connexion PostgreSQL:', error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, testConnection };
