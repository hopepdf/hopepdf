// Loads .env once at process start.
require('dotenv').config();

const num = (k, d) => Number(process.env[k] || d);

module.exports = {
  PORT:                 num('PORT', 5000),
  NODE_ENV:             process.env.NODE_ENV || 'development',
  GOOGLE_CLIENT_ID:     process.env.GOOGLE_CLIENT_ID || '',
  RAZORPAY_KEY_ID:      process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_SECRET:      process.env.RAZORPAY_SECRET || '',
  ALLOWED_ORIGINS:      (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  FREE_MAX_FILE_MB:     num('FREE_MAX_FILE_MB', 20),
  PREMIUM_MAX_FILE_MB:  num('PREMIUM_MAX_FILE_MB', 100),
  FREE_HOURLY_QUOTA:    num('FREE_HOURLY_QUOTA', 5),
  PREMIUM_HOURLY_QUOTA: num('PREMIUM_HOURLY_QUOTA', 200)
};
