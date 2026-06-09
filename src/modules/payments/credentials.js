// Résolution des identifiants de paiement à utiliser pour un restaurant donné.
//
// Modèle B (reversement direct) : chaque restaurant peut renseigner ses propres
// identifiants Campay (stockés chiffrés dans restaurant.settings.payment.campay).
// L'argent encaissé tombe alors directement sur SON compte Campay.
// À défaut de configuration, on retombe sur les identifiants globaux (.env) —
// utile en démo / phase de transition.
const { decrypt } = require('../../utils/secrets');
const campayConfig = require('../../config/campay');

/**
 * @param {object} restaurant instance Sequelize (ou objet) avec .settings
 * @returns {{username, password, baseUrl, webhookKey, source: 'restaurant'|'global'}}
 */
function getRestaurantCampay(restaurant) {
  const pc = restaurant && restaurant.settings && restaurant.settings.payment
    && restaurant.settings.payment.campay;

  if (pc && pc.username && pc.password_enc) {
    const password = decrypt(pc.password_enc);
    if (password) {
      return {
        username: pc.username,
        password,
        baseUrl: pc.base_url || campayConfig.baseUrl,
        webhookKey: pc.webhook_key_enc ? (decrypt(pc.webhook_key_enc) || '') : '',
        source: 'restaurant'
      };
    }
  }

  return {
    username: campayConfig.username,
    password: campayConfig.password,
    baseUrl: campayConfig.baseUrl,
    webhookKey: campayConfig.webhookKey,
    source: 'global'
  };
}

module.exports = { getRestaurantCampay };
