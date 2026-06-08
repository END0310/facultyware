const express = require('express');
const router = express.Router();
const controller = require('../controllers/apiProcurementController');
const { isAuthenticated } = require('../middlewares/auth');
const { hasRole } = require('../middlewares/acl');

router.use(isAuthenticated);
router.use(hasRole(['Pengelola Aset', 'Pengelola Sistem', 'Admin', 'Wakil Dekan']));

router.get('/procurements', controller.listProcurements);
router.get('/procurements/:id', controller.detailProcurement);
router.get('/procurements/:id/items', controller.procurementItems);
router.get('/procurement-assets', controller.procurementAssets);
router.get('/procurement-summary', controller.summary);

module.exports = router;
