// Routes webhook PUBLIQUES (pas d'auth JWT, pas de rate-limit).
// La sécurité repose sur la vérification de la signature `verif-hash`
// + la revérification serveur de la transaction auprès de Flutterwave.
const express = require('express');
const router = express.Router();
const PaymentController = require('./controller');

router.post('/flutterwave', PaymentController.flutterwaveWebhook.bind(PaymentController));

module.exports = router;
