module.exports = {
  testEnvironment: 'node',
  // Charge .env.test avant tout (DB de test, secrets de test)
  setupFiles: ['<rootDir>/tests/load-env.js'],
  // Setup/teardown de la base entre les tests
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // Les tests d'intégration ouvrent des connexions DB : on évite le parallélisme
  // pour garder une base déterministe et éviter les contentions.
  maxWorkers: 1,
  testTimeout: 15000,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/utils/logger*.js',
    '!src/**/*.old.js'
  ],
  verbose: true
};
