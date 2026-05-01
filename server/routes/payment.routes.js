const router = require('express').Router();
const express = require('express');
const ctrl = require('../controllers/payment.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// Auth required for both — we need req.user.email to record the upgrade.
router.post('/create-order', requireAuth, express.json(), ctrl.createOrder);
router.post('/verify',       requireAuth, express.json(), ctrl.verify);

module.exports = router;
