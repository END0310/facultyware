const express = require('express');
const router = express.Router();
const controller = require('../controllers/procurementController');
const { isAuthenticated } = require('../middlewares/auth');
const { hasRole } = require('../middlewares/acl');

const asetRoles = ['Pengelola Aset', 'Pengelola Sistem', 'Admin'];
const decisionRoles = ['Wakil Dekan', 'Admin'];

router.use(isAuthenticated);

router.get('/report/export', hasRole(asetRoles), controller.exportReportCsv);
router.get('/report', hasRole(asetRoles), controller.report);

router.get('/requests', hasRole(asetRoles), controller.listRequests);
router.get('/requests/:id', hasRole(asetRoles), controller.detailRequest);
router.post('/requests/:id/status', hasRole(asetRoles), controller.updateRequestStatus);

router.get('/create', hasRole(asetRoles), controller.showCreateProcurement);
router.post('/', hasRole(asetRoles), controller.createProcurement);
router.get('/', hasRole(asetRoles), controller.listProcurements);
router.get('/:id', hasRole(['Pengelola Aset', 'Pengelola Sistem', 'Admin', 'Wakil Dekan']), controller.detailProcurement);
router.post('/:id/submit', hasRole(asetRoles), controller.submitProcurement);
router.post('/:id/decision', hasRole(decisionRoles), controller.decideProcurement);
router.get('/:id/add-asset', hasRole(asetRoles), controller.showAddAsset);
router.post('/:id/add-asset', hasRole(asetRoles), controller.addAssetFromProcurement);

module.exports = router;
