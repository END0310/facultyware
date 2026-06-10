const express = require('express');
const router = express.Router();
const controller = require('../../controllers/admin/dashboardController');
const { isAuthenticated } = require('../../middlewares/auth');
const { hasRole } = require('../../middlewares/acl');

router.get('/', isAuthenticated, hasRole(['Admin']), controller.index);

module.exports = router;
