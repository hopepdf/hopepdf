const router = require('express').Router();
const ctrl = require('../controllers/word.controller');
const upload = require('../middleware/upload.middleware');
const { requireAuth } = require('../middleware/auth.middleware');
const { enforcePlanLimits } = require('../middleware/plan.middleware');
const { processing } = require('../middleware/ratelimit.middleware');

router.post('/to-pdf', requireAuth, processing, upload.array('files'), enforcePlanLimits, ctrl.toPdf);

module.exports = router;
