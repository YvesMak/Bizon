const webpush = require('web-push');
const { PushSubscription } = require('../../models');
const logger = require('../../utils/logger');

let configured = false;
(function configure() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:contact@bizon.cm';
  if (pub && priv) {
    try {
      webpush.setVapidDetails(subject, pub, priv);
      configured = true;
    } catch (err) {
      logger.error(`VAPID mal configuré: ${err.message}`);
    }
  }
})();

class NotificationService {
  isConfigured() {
    return configured;
  }

  getPublicKey() {
    return process.env.VAPID_PUBLIC_KEY || null;
  }

  /**
   * Enregistre (ou met à jour) l'abonnement push d'un appareil client.
   */
  async subscribe(customerId, restaurantId, subscription) {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw new Error('Abonnement push invalide');
    }
    const { endpoint, keys } = subscription;
    if (!keys.p256dh || !keys.auth) throw new Error('Clés d\'abonnement manquantes');

    const existing = await PushSubscription.findOne({ where: { endpoint } });
    if (existing) {
      await existing.update({
        customer_id: customerId,
        restaurant_id: restaurantId,
        p256dh: keys.p256dh,
        auth: keys.auth
      });
      return existing;
    }
    return PushSubscription.create({
      customer_id: customerId,
      restaurant_id: restaurantId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth
    });
  }

  async unsubscribe(endpoint) {
    if (!endpoint) return 0;
    return PushSubscription.destroy({ where: { endpoint } });
  }

  /**
   * Envoie une notification à tous les appareils d'un client.
   * Les abonnements expirés (404/410) sont supprimés automatiquement.
   */
  async sendToCustomer(customerId, payload) {
    if (!configured || !customerId) return { sent: 0, removed: 0 };

    const subs = await PushSubscription.findAll({ where: { customer_id: customerId } });
    if (!subs.length) return { sent: 0, removed: 0 };

    const body = JSON.stringify(payload);
    let sent = 0;
    let removed = 0;

    await Promise.all(subs.map(async (sub) => {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      };
      try {
        await webpush.sendNotification(pushSub, body);
        sent += 1;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await sub.destroy();
          removed += 1;
        } else {
          logger.error(`Push échoué (${err.statusCode || '?'}): ${err.message}`);
        }
      }
    }));

    return { sent, removed };
  }

  /**
   * Notification de changement de statut de commande (réutilisable).
   */
  async notifyOrderStatus(customerId, { orderNumber, status }) {
    const labels = {
      confirmed: { title: 'Commande confirmée ✅', body: `Votre commande ${orderNumber} est confirmée.` },
      preparing: { title: 'En préparation 👨‍🍳', body: `Votre commande ${orderNumber} est en cours de préparation.` },
      ready: { title: 'Commande prête 🛎️', body: `Votre commande ${orderNumber} est prête !` },
      delivering: { title: 'En livraison 🛵', body: `Votre commande ${orderNumber} est en route.` },
      completed: { title: 'Commande terminée 🎉', body: `Merci ! Votre commande ${orderNumber} est terminée.` },
      cancelled: { title: 'Commande annulée', body: `Votre commande ${orderNumber} a été annulée.` }
    };
    const msg = labels[status];
    if (!msg) return { sent: 0, removed: 0 };
    return this.sendToCustomer(customerId, {
      title: msg.title,
      body: msg.body,
      tag: `order-${orderNumber}`,
      data: { url: '/', orderNumber, status }
    });
  }

  /**
   * Campagne marketing : envoie une notification push aux clients d'un
   * restaurant (tous les abonnés, ou un segment top/inactif).
   * @returns {{ targeted:number, reached:number, notifications:number }}
   */
  async sendCampaign(restaurantId, { title, body, url, segment } = {}) {
    if (!configured) throw new Error('Notifications push non configurées (VAPID manquant)');
    if (!title || !String(title).trim()) throw new Error('Titre requis');
    if (!body || !String(body).trim()) throw new Error('Message requis');

    let customerIds;
    if (segment === 'top' || segment === 'inactive') {
      // eslint-disable-next-line global-require
      const RestaurantService = require('../restaurants/service');
      const list = await RestaurantService.listCustomers(restaurantId, { segment });
      customerIds = list.map((c) => c.id);
    } else {
      const subs = await PushSubscription.findAll({
        where: { restaurant_id: restaurantId }, attributes: ['customer_id']
      });
      customerIds = [...new Set(subs.map((s) => s.customer_id).filter(Boolean))];
    }

    const payload = {
      title: String(title).trim(),
      body: String(body).trim(),
      tag: `campaign-${Date.now()}`,
      data: { url: url || '/' }
    };

    let reached = 0;
    let notifications = 0;
    for (const id of customerIds) {
      const res = await this.sendToCustomer(id, payload);
      if (res.sent > 0) { reached += 1; notifications += res.sent; }
    }
    return { targeted: customerIds.length, reached, notifications };
  }
}

module.exports = new NotificationService();
