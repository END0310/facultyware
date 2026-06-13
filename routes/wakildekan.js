const express = require('express');
const router = express.Router();
const { isLogin, isRole } = require('../middlewares/auth');
const wakildekanController = require('../controllers/wakildekanController');

router.get('/dashboard', isLogin, isRole('wakildekan'), wakildekanController.dashboard);
router.get('/permohonan', isLogin, isRole('wakildekan'), wakildekanController.listPermohonan);
router.get('/permohonan/:id', isLogin, isRole('wakildekan'), wakildekanController.detailPermohonan);
router.post('/permohonan/:id/approve', isLogin, isRole('wakildekan'), wakildekanController.approvePermohonan);
router.post('/permohonan/:id/reject', isLogin, isRole('wakildekan'), wakildekanController.rejectPermohonan);
router.get('/riwayat', isLogin, isRole('wakildekan'), wakildekanController.riwayatPermohonan);
router.get('/riwayat/download', isLogin, isRole('wakildekan'), wakildekanController.downloadPDF);
router.get('/api/permohonan', isLogin, isRole('wakildekan'), wakildekanController.getPermohonanAPI);

module.exports = router;