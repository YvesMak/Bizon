const express = require('express');
const router = express.Router();
const AuthController = require('./controller');
const auth = require('../../middlewares/auth');

// Routes publiques
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

// Routes protégées
router.get('/profile', auth, AuthController.getProfile);
router.put('/profile', auth, AuthController.updateProfile);
router.post('/change-password', auth, AuthController.changePassword);

module.exports = router;
