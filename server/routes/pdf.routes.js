const router = require('express').Router();
const ctrl = require('../controllers/pdf.controller');
const upload = require('../middleware/upload.middleware');
const { requireAuth } = require('../middleware/auth.middleware');
const { enforcePlanLimits } = require('../middleware/plan.middleware');
const { processing } = require('../middleware/ratelimit.middleware');

/* Note: merge bypasses the 1-file-on-free rule because combining a
 * single file is meaningless. Other tools obey the default rule. */
router.post('/merge',    requireAuth, processing, upload.array('files'), enforcePlanLimits({ allowMulti: true }),  ctrl.merge);
router.post('/split',    requireAuth, processing, upload.single('file'),  enforcePlanLimits(),                      ctrl.split);
router.post('/compress', requireAuth, processing, upload.single('file'),  enforcePlanLimits(),                      ctrl.compress);
router.post('/to-word',  requireAuth, processing, upload.array('files'),  enforcePlanLimits(),                      ctrl.toWord);
router.post('/to-jpg',   requireAuth, processing, upload.single('file'),  enforcePlanLimits(),                      ctrl.toJpg);

module.exports = router;
