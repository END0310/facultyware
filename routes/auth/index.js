const express = require('express');
const router = express.Router();
const controller = require('../../controllers/auth/authController');

router.get('/', controller.index);
router.get('/login', controller.loginPage);
router.post('/login', controller.login);
router.get('/logout', controller.logout);

module.exports = router;
