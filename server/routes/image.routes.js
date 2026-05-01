const router = require('express').Router();
const ctrl = require('../controllers/image.controller');
const upload = require('../middleware/upload.middleware');
const { requireAuth } = require('../middleware/auth.middleware');
const { enforcePlanLimits } = require('../middleware/plan.middleware');
const { processing } = require('../middleware/ratelimit.middleware');

/* Image → PDF combines several pictures into one document, like merge,
 * so free users are allowed to upload multiple files here too. */
router.post('/to-pdf', requireAuth, processing, upload.array('files'), enforcePlanLimits({ allowMulti: true }), ctrl.toPdf);

module.exports = router;
