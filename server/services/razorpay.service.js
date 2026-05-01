/* Razorpay order creation + signature verification.
 *
 *   amounts: paise (₹150 → 15000, ₹1000 → 100000)
 *   verify():  HMAC SHA256 over `${order_id}|${payment_id}` with key_secret.
 */
const crypto = require('crypto');
const Razorpay = require('razorpay');
const env = require('../config/env');

const PRICE_INR = { 'monthly': 150, 'yearly': 1000 };
const DURATION_DAYS = { 'monthly': 31, 'yearly': 365 };

const client = (env.RAZORPAY_KEY_ID && env.RAZORPAY_SECRET)
  ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_SECRET })
  : null;

async function createOrder({ plan, email }) {
  if (!client) throw Object.assign(new Error('Razorpay is not configured on the server.'), { status: 503 });
  const inr = PRICE_INR[plan];
  if (!inr) throw Object.assign(new Error('Unknown plan'), { status: 400 });
  const order = await client.orders.create({
    amount:   inr * 100,
    currency: 'INR',
    receipt:  `hope-${plan}-${Date.now()}`,
    notes:    { plan, email: email || '' }
  });
  return {
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: env.RAZORPAY_KEY_ID,
    plan
  };
}

function verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!env.RAZORPAY_SECRET) throw Object.assign(new Error('Razorpay secret missing.'), { status: 503 });
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  return expected === razorpay_signature;
}

function expiryFor(plan) {
  const days = DURATION_DAYS[plan];
  if (!days) return null;
  return Date.now() + days * 24 * 3600 * 1000;
}

module.exports = { createOrder, verifySignature, expiryFor, PRICE_INR };
