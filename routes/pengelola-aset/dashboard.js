const express = require('express');
const router = express.Router();
const controller = require('../../controllers/pengelola-aset/dashboardController');
const { isAuthenticated } = require('../../middlewares/auth');

router.get('/home', isAuthenticated, controller.home);

module.exports = router;
