/**
 * Service de logging structuré pour Bizon
 * Permet de tracer les actions critiques et déboguer facilement
 */

const fs = require('fs').promises;
const path = require('path');

class Logger {
  constructor() {
    this.logDir = process.env.LOG_DIR || './logs';
    this.logFile = 'bizon.log';
    this.errorFile = 'errors.log';
  }

  /**
   * Initialiser le dossier de logs
   */
  async init() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Erreur création dossier logs:', error);
    }
  }

  /**
   * Formater un log
   */
  format(level, message, data = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data
    }) + '\n';
  }

  /**
   * Écrire dans un fichier
   */
  async write(filename, content) {
    try {
      const filePath = path.join(this.logDir, filename);
      await fs.appendFile(filePath, content);
    } catch (error) {
      console.error('Erreur écriture log:', error);
    }
  }

  /**
   * Log INFO
   */
  async info(message, data = {}) {
    const log = this.format('INFO', message, data);
    console.log(`ℹ️  ${message}`, data);
    await this.write(this.logFile, log);
  }

  /**
   * Log WARNING
   */
  async warn(message, data = {}) {
    const log = this.format('WARN', message, data);
    console.warn(`⚠️  ${message}`, data);
    await this.write(this.logFile, log);
  }

  /**
   * Log ERROR
   */
  async error(message, error, data = {}) {
    const log = this.format('ERROR', message, {
      error: error.message,
      stack: error.stack,
      ...data
    });
    console.error(`❌ ${message}`, error);
    await this.write(this.errorFile, log);
  }

  /**
   * Log action critique (commande, paiement, etc.)
   */
  async critical(action, data = {}) {
    const log = this.format('CRITICAL', action, data);
    console.log(`🔒 ${action}`, data);
    await this.write(this.logFile, log);
  }

  /**
   * Log action utilisateur
   */
  async audit(userId, restaurantId, action, details = {}) {
    const log = this.format('AUDIT', action, {
      user_id: userId,
      restaurant_id: restaurantId,
      ...details
    });
    console.log(`📝 ${action} by ${userId}`);
    await this.write('audit.log', log);
  }
}

// Singleton
const logger = new Logger();
logger.init();

module.exports = logger;
