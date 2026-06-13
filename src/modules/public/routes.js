const express = require('express');
const router = express.Router();
const PublicController = require('./controller');

router.get('/menu', PublicController.getMenu);
router.get('/whoami', PublicController.whoami);

module.exports = router;
