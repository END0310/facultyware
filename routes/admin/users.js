const express = require('express');
const router = express.Router();
const controller = require('../../controllers/admin/usersController');
const { isAuthenticated } = require('../../middlewares/auth');
const { hasRole } = require('../../middlewares/acl');

router.use(isAuthenticated);
router.use(hasRole(['Admin']));

router.get('/', controller.index);
router.get('/:id/edit', controller.editPage);
router.post('/:id/edit', controller.update);
router.get('/:id/reset-password', controller.resetPasswordPage);
router.post('/:id/reset-password', controller.resetPassword);

module.exports = router;
