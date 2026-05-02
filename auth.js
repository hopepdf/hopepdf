/* ================================================================
 * H🌸PE PDF — Auth + Plans + Monetization
 *
 * Auth provider:  Google Identity Services (GIS) — google-only login
 * Payments:       Razorpay (₹150/mo, ₹1000/yr)
 * Storage:        localStorage only — no server required to demo.
 *
 * IMPORTANT (production):
 *   • Replace GOOGLE_CLIENT_ID with a real OAuth client ID
 *   • Replace RAZORPAY_KEY_ID with your real public key
 *   • Stand up VERIFY_ENDPOINT to validate the Razorpay HMAC
 *     signature server-side. Without it, anyone can fake an upgrade.
 *
 * Plans:
 *   free            → 20 MB max, 8 jobs/day, 5/hour, ads
 *   premium-monthly → 100 MB max, unlimited usage, no ads, ₹150/mo
 *   premium-yearly  → 100 MB max, unlimited usage, no ads, ₹1000/yr
 * ================================================================ */
window.HopeAuth = (() => {
  // ---------- CONFIG --------------------------------------------------
  const GOOGLE_CLIENT_ID  = '165450201442-6f6ls3vsn41r5qlk3v5089pro7h0l625.apps.googleusercontent.com';
  // SOFT-LAUNCH: payments disabled — Razorpay constants kept only for
  // future re-enablement. startCheckout() is short-circuited below.
  const RAZORPAY_KEY_ID   = 'rzp_test_REPLACE_ME';
  const VERIFY_ENDPOINT   = '/api/razorpay/verify';
  const BACKEND_URL       = 'https://hopepdf.onrender.com';

  const PLANS = {
    free:              { label: 'Free',            maxFileBytes: 20  * 1024 * 1024, hourlyQuota: 5,   dailyQuota: 8,   ads: true,  priceInr: 0    },
    'premium-monthly': { label: 'Premium Monthly', maxFileBytes: 100 * 1024 * 1024, hourlyQuota: 200, dailyQuota: 1e6, ads: false, priceInr: 150,  durationDays: 31  },
    'premium-yearly':  { label: 'Premium Yearly',  maxFileBytes: 100 * 1024 * 1024, hourlyQuota: 200, dailyQuota: 1e6, ads: false, priceInr: 1000, durationDays: 365 }
  };

  const listeners = new Set();

  // ---------- user store ---------------------------------------------
  function getUser() {
    try {
      const raw = localStorage.getItem('hope.user');
      if (!raw) return null;
      const u = JSON.parse(raw);
      // auto-downgrade on expiry
      if (u.expiresAt && Date.now() > u.expiresAt && u.plan !== 'free') {
        u.plan = 'free'; u.expiresAt = null;
        localStorage.setItem('hope.user', JSON.stringify(u));
      }
      return u;
    } catch (_) { return null; }
  }
  function saveUser(u) {
    if (u) localStorage.setItem('hope.user', JSON.stringify(u));
    else   localStorage.removeItem('hope.user');
    listeners.forEach(fn => { try { fn(u); } catch (_) {} });
  }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function plan() { const u = getUser(); return (u && u.plan) || 'free'; }
  function isPremium() { return plan() !== 'free'; }
  function planLimits() { return PLANS[plan()] || PLANS.free; }

  // ---------- file + rate guards (called from script.js run()) -------
  function checkFile(file) {
    const limits = planLimits();
    if (file.size > limits.maxFileBytes) {
      const mb = Math.round(limits.maxFileBytes / 1024 / 1024);
      throw new Error(`${file.name} is too large for the ${limits.label} plan (${mb} MB max)${plan() === 'free' ? ' — upgrade for 100 MB.' : '.'}`);
    }
    return true;
  }
  function buckets() {
    const d = new Date();
    return {
      hour: `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}`,
      day:  `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
    };
  }
  function checkRate() {
    const limits = planLimits();
    const b = buckets();
    let usage; try { usage = JSON.parse(localStorage.getItem('hope.usage') || '{}'); } catch (_) { usage = {}; }
    if (usage.hourBucket !== b.hour) { usage.hourBucket = b.hour; usage.hourCount = 0; }
    if (usage.dayBucket  !== b.day)  { usage.dayBucket  = b.day;  usage.dayCount  = 0; }
    if (usage.hourCount >= limits.hourlyQuota) throw new Error(`Hourly limit reached (${limits.hourlyQuota} jobs)${!isPremium() ? ' — upgrade for unlimited.' : '.'}`);
    if (usage.dayCount  >= limits.dailyQuota)  throw new Error(`Daily limit reached (${limits.dailyQuota} jobs) — try again tomorrow${!isPremium() ? ' or upgrade.' : '.'}`);
    usage.hourCount++; usage.dayCount++;
    localStorage.setItem('hope.usage', JSON.stringify(usage));
  }

  // ---------- Sign-out (only auth helper kept; GIS popup removed) ----
  // Login is now the server-side redirect flow only:
  //   gold button → window.location → BACKEND_URL/auth/google
  // Backend handles Google + JWT, frontend reads ?token=… on return.
  function signOut() {
    saveUser(null);
  }
  function setPlan(p, expiresAt) {
    const u = getUser();
    if (!u) throw new Error('Sign in to change your plan.');
    u.plan = PLANS[p] ? p : 'free';
    u.expiresAt = expiresAt || null;
    saveUser(u);
  }

  // ---------- Razorpay flow (DISABLED for soft-launch) ---------------
  // Every signed-in user is treated as Premium server-side, so the
  // checkout flow is short-circuited. The body is preserved (commented)
  // so re-enabling billing is a single-block uncomment.
  function startCheckout(/* planKey */) {
    return Promise.reject(new Error('Payments are disabled during soft-launch. Sign in with Google for full access.'));
  }
  /* ── original Razorpay flow — re-enable by removing this block wrapper ──
  function _startCheckout_disabled(planKey) {
    return new Promise((resolve, reject) => {
      const cfg = PLANS[planKey];
      if (!cfg || !cfg.priceInr) return reject(new Error('Unknown plan.'));
      const u = getUser();
      if (!u) return reject(new Error('Sign in first.'));

      // Demo mode: if no real key was set, fake a successful payment so
      // the upgrade flow is still demoable end-to-end.
      if (RAZORPAY_KEY_ID.includes('REPLACE')) {
        const expiresAt = Date.now() + cfg.durationDays * 24 * 3600 * 1000;
        setPlan(planKey, expiresAt);
        return resolve({ demo: true });
      }

      if (!window.Razorpay) return reject(new Error('Payment service didn\'t load. Refresh and try again.'));

      const rzp = new window.Razorpay({
        key: RAZORPAY_KEY_ID,
        amount: cfg.priceInr * 100, // in paise
        currency: 'INR',
        name: 'H🌸PE PDF',
        description: cfg.label,
        prefill: { email: u.email, name: u.name },
        theme:   { color: '#e6b352' },
        handler: async (resp) => {
          // SERVER-SIDE VERIFICATION: required in production.
          // Compute HMAC(SHA256, key_secret) over `${order_id}|${payment_id}`
          // server-side and compare with resp.razorpay_signature.
          try {
            const r = await fetch(VERIFY_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...resp, plan: planKey, email: u.email })
            });
            if (!r.ok) throw new Error('Verification failed');
          } catch (_) {
            // dev convenience: grant access optimistically.
            // DELETE this branch in production, keep the throw above.
            console.warn('Razorpay verify endpoint missing; granting access (dev only).');
          }
          const expiresAt = Date.now() + cfg.durationDays * 24 * 3600 * 1000;
          setPlan(planKey, expiresAt);
          resolve(resp);
        },
        modal: { ondismiss: () => reject(new Error('Payment cancelled.')) }
      });
      rzp.on('payment.failed', resp => reject(new Error(resp.error?.description || 'Payment failed.')));
      rzp.open();
    });
  }
  ── end of original Razorpay flow ── */

  return {
    PLANS,
    getUser, plan, isPremium, planLimits,
    checkFile, checkRate,
    signOut, setPlan,
    startCheckout, onChange
  };
})();


/* ================================================================
 * OAuth redirect callback hand-off.
 *
 *   We use the server-side OAuth redirect flow (custom gold button →
 *   backend /auth/google → Google → /auth/google/callback → JWT in
 *   ?token=… query param). On the next page load we decode the token
 *   payload, store the verified user under "hope.user", then strip
 *   the token from the URL so it isn't bookmarked or shared.
 *
 *   GIS popup mode is no longer used — the custom button takes over.
 * ================================================================ */
document.addEventListener("DOMContentLoaded", () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("token");
    if (!token) return;

    const payloadPart = token.split(".")[1];
    if (!payloadPart) return;

    const json    = atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(decodeURIComponent(escape(json)));

    if (payload && payload.email) {
      localStorage.setItem("hope.user", JSON.stringify({
        email:     payload.email,
        name:      payload.name || payload.email,
        picture:   payload.picture || null,
        plan:      payload.plan || "free",
        expiresAt: payload.expiresAt || null,
        role:      payload.role || "user",
        ts:        Date.now()
      }));
      // Notify any HopeAuth.onChange listeners (script.js syncs the UI).
      window.dispatchEvent(new Event("storage"));
    }

    // Strip the token so it isn't bookmarked.
    params.delete("token");
    const clean = window.location.pathname
                + (params.toString() ? `?${params}` : "")
                + window.location.hash;
    window.history.replaceState({}, document.title, clean);
  } catch (_) {
    /* token parse errors are best-effort — ignore */
  }
});
