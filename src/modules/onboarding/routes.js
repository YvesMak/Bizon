const express = require('express');
const router = express.Router();
const OnboardingController = require('./controller');

// Routes publiques (pas de auth nécessaire pour créer un restaurant)
router.post('/quick-start', OnboardingController.quickStart);
router.get('/templates', OnboardingController.getTemplates);

module.exports = router;
