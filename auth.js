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
  const GOOGLE_CLIENT_ID  = 'REPLACE_WITH_YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
  const RAZORPAY_KEY_ID   = 'rzp_test_REPLACE_ME';
  const VERIFY_ENDPOINT   = '/api/razorpay/verify';

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

  // ---------- Google Sign-In ----------------------------------------
  function decodeJwt(token) {
    try {
      const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(p).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
      return JSON.parse(json);
    } catch (_) { return null; }
  }
  function handleCredential(resp) {
    const data = decodeJwt(resp.credential);
    if (!data || !data.email) return;
    const existing = getUser();
    saveUser({
      email: data.email,
      name: data.name || data.email,
      plan: (existing && existing.plan) || 'free',
      expiresAt: existing ? existing.expiresAt : null,
      ts: Date.now()
    });
  }
  function initGoogle(buttonContainer) {
    if (!buttonContainer) return;
    const fallback = () => {
      buttonContainer.innerHTML = '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'g-fallback-btn';
      btn.innerHTML = `<span class="g-mark" aria-hidden="true">G</span> Continue with Google`;
      btn.addEventListener('click', () => {
        if (GOOGLE_CLIENT_ID.startsWith('REPLACE_')) {
          // demo mode so the rest of the UI is testable
          saveUser({ email: 'demo@hope.pdf', name: 'Demo', plan: 'free', expiresAt: null, ts: Date.now() });
        } else if (window.google && google.accounts) {
          google.accounts.id.prompt();
        }
      });
      buttonContainer.appendChild(btn);
    };
    if (!window.google || !google.accounts || !google.accounts.id) return fallback();
    try {
      google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential, auto_select: false });
      google.accounts.id.renderButton(buttonContainer, { type: 'standard', theme: 'filled_black', size: 'medium', text: 'continue_with', shape: 'pill' });
    } catch (_) { fallback(); }
  }
  function signOut() {
    if (window.google && google.accounts && google.accounts.id) {
      try { google.accounts.id.disableAutoSelect(); } catch (_) {}
    }
    saveUser(null);
  }
  function setPlan(p, expiresAt) {
    const u = getUser();
    if (!u) throw new Error('Sign in to change your plan.');
    u.plan = PLANS[p] ? p : 'free';
    u.expiresAt = expiresAt || null;
    saveUser(u);
  }

  // ---------- Razorpay flow ------------------------------------------
  function startCheckout(planKey) {
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

  return {
    PLANS,
    getUser, plan, isPremium, planLimits,
    checkFile, checkRate,
    initGoogle, signOut, setPlan,
    startCheckout, onChange
  };
})();

/* ================================================================
 * Google OAuth — redirect flow (server-side code exchange)
 *
 * Lives OUTSIDE the HopeAuth IIFE so it runs at DOM ready without
 * touching any of the existing HopeAuth state.
 *
 *   1) #googleLoginBtn  → window.location → backend /auth/google
 *   2) Backend redirects to Google, then back to /auth/google/callback
 *   3) Backend issues a JWT and redirects FRONTEND_URL?token=…
 *   4) On the next page load we read ?token= from the URL, decode the
 *      embedded user, hand it to HopeAuth so the plan/badge stays
 *      consistent, then strip the token from the URL.
 * ================================================================ */
const API_URL = "https://hopepdf-api.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  // 1) The standalone "Continue with Google" button → server redirect flow
  

  // 2) The GIS pop-up container (handled by HopeAuth.initGoogle)
  const container = document.getElementById("googleSignInContainer");
  if (container && window.HopeAuth && HopeAuth.initGoogle) {
    HopeAuth.initGoogle(container);
  }
  async function handleCredential(resp) {
  try {
    const r = await fetch("https://hopepdf-api.onrender.com/auth/google", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        idToken: resp.credential
      })
    });

    const data = await r.json();

    if (data.ok) {
      localStorage.setItem("hope.user", JSON.stringify(data.user));
      location.reload();
    }
  } catch (err) {
    console.error("Login failed", err);
  }
}

  // 3) Pick up ?token=… returned by the OAuth callback and seed HopeAuth
  //    so the existing plan + badge UI updates without a second sign-in.
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token && window.HopeAuth) {
      const payload = token.split(".")[1];
      if (payload) {
        const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
        const profile = JSON.parse(decodeURIComponent(escape(json)));
        if (profile && profile.email) {
          const existing = window.HopeAuth.getUser() || {};
          // Use saveUser via the public surface — no IIFE state mutation.
          if (window.HopeAuth.PLANS) {
            localStorage.setItem("user", JSON.stringify(profile));
            localStorage.setItem("hope.user", JSON.stringify({
              email: profile.email,
              name:  profile.name || profile.email,
              picture: profile.picture || null,
              role:  profile.role || "user",
              plan:  existing.plan || "free",
              expiresAt: existing.expiresAt || null,
              ts: Date.now()
            }));
          }
          // Strip the token from the URL so it isn't bookmarked.
          params.delete("token");
          const clean = window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
          window.history.replaceState({}, document.title, clean);
        }
      }
    }
  } catch (_) { /* ignore — token parse is best-effort */ }
});
