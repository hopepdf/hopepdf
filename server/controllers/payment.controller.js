const razorpayService = require('../services/razorpay.service');
const userService = require('../services/user.service');

async function createOrder(req, res, next) {
  try {
    const plan = String(req.body.plan || '').toLowerCase();
    if (!['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({ ok: false, error: 'plan must be "monthly" or "yearly".' });
    }
    const order = await razorpayService.createOrder({ plan, email: req.user.email });
    res.json({ ok: true, order });
  } catch (e) { next(e); }
}

async function verify(req, res, next) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ ok: false, error: 'Missing payment fields.' });
    }
    const ok = razorpayService.verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
    if (!ok) return res.status(400).json({ ok: false, error: 'Signature mismatch.' });

    const planKey = String(plan || '').toLowerCase() === 'yearly' ? 'premium-yearly' : 'premium-monthly';
    const expiresAt = razorpayService.expiryFor(planKey === 'premium-yearly' ? 'yearly' : 'monthly');
    const user = userService.setPlan(req.user.email, planKey, expiresAt);
    res.json({ ok: true, user });
  } catch (e) { next(e); }
}

module.exports = { createOrder, verify };
