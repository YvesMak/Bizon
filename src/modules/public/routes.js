const express = require('express');
const router = express.Router();
const PublicController = require('./controller');

router.get('/menu', PublicController.getMenu);

module.exports = router;
