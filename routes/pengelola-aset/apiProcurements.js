const express = require('express');
const router = express.Router();
const controller = require('../../controllers/pengelola-aset/apiProcurementController');
const { isAuthenticated } = require('../../middlewares/auth');
const { hasRole } = require('../../middlewares/acl');

router.use(isAuthenticated);
router.use(hasRole(['Pengelola Aset', 'Pengelola Sistem', 'Wakil Dekan']));

router.get('/procurement-items', controller.listProcurementItems);

module.exports = router;
