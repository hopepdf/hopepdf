const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.post('/google', ctrl.login);
router.get('/me', requireAuth, ctrl.me);

module.exports = router;
