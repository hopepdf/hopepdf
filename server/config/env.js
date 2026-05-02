// Loads .env once at process start. Plan + rate-limit constants are
// removed — every authenticated user has unlimited usage.
require('dotenv').config();

const num = (k, d) => Number(process.env[k] || d);

module.exports = {
  PORT:                num('PORT', 5000),
  NODE_ENV:            process.env.NODE_ENV || 'development',
  GOOGLE_CLIENT_ID:    process.env.GOOGLE_CLIENT_ID || '',
  RAZORPAY_KEY_ID:     process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_SECRET:     process.env.RAZORPAY_SECRET || '',
  ALLOWED_ORIGINS:     (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
};
