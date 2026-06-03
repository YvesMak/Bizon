const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Créer le répertoire des logs s'il n'existe pas
const logsDir = path.join(__dirname, '../../logs');

// Format personnalisé pour les logs
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Format console lisible pour le développement
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Configuration des transports
const transports = [];

// Console (toujours actif en développement)
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug'
    })
  );
}

// Fichiers rotatifs pour tous les logs
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: customFormat,
    level: 'info'
  })
);

// Fichier séparé pour les erreurs
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: customFormat,
    level: 'error'
  })
);

// Créer le logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports,
  exitOnError: false,
  // En test : pas de bruit console ni d'écriture de fichiers de log.
  silent: process.env.NODE_ENV === 'test'
});

/**
 * Log une opération critique (commande, paiement)
 */
logger.logOperation = function(operation, details) {
  this.info({
    type: 'operation',
    operation,
    ...details
  });
};

/**
 * Log une erreur métier
 */
logger.logError = function(context, error, details = {}) {
  this.error({
    type: 'business_error',
    context,
    error: error.message,
    stack: error.stack,
    ...details
  });
};

/**
 * Log un accès utilisateur
 */
logger.logAccess = function(action, userId, restaurantId, details = {}) {
  this.info({
    type: 'access',
    action,
    user_id: userId,
    restaurant_id: restaurantId,
    ...details
  });
};

/**
 * Log une transaction financière
 */
logger.logTransaction = function(type, amount, details) {
  this.info({
    type: 'transaction',
    transaction_type: type,
    amount,
    ...details
  });
};

/**
 * Compatibilité avec l'ancien logger (logger.critical)
 */
logger.critical = function(event, details) {
  this.warn({
    type: 'critical',
    event,
    ...details
  });
};

// NB : ne PAS surcharger `logger.log`. Winston expose déjà
// `logger.log(level, message, meta)` ; le redéfinir pour appeler
// `this[level](...)` provoque une récursion infinie (les méthodes de niveau
// de winston appellent `this.log(...)` en interne) → "Maximum call stack size
// exceeded" dès qu'une erreur est journalisée (ex. échec de paiement).

module.exports = logger;
