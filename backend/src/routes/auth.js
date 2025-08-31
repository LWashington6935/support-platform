// backend/src/routes/auth.js
import express from 'express';
import crypto from 'crypto';

/**
 * Magic-link auth router (no router.on usage)
 * Endpoints:
 *  POST /api/auth/magic-link           { email } -> { ok, url, expires_in_seconds }
 *  GET  /api/auth/magic-link/consume?token=...  -> { ok, email } | { ok:false, error }
 *
 * In dev, we return the URL in JSON instead of emailing it.
 * In production, you’d send the link via email and not expose it in the response.
 */

// ---- module-scope token store & cleanup (shared across router instances) ----
const TOKENS = new Map(); // token -> { email, expiresAt, used }
let cleanupStarted = false;
const TTL_MS = 15 * 60 * 1000; // 15 minutes

function startCleanup() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [t, rec] of TOKENS) {
      if (rec.used || now > rec.expiresAt) TOKENS.delete(t);
    }
  }, 60 * 1000);
}

function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

export default function makeAuthRouter(_db, { baseUrl } = {}) {
  const router = express.Router();
  startCleanup();

  // Helper to build absolute URLs (fallback to localhost:4000)
  function abs(path) {
    const root = baseUrl || 'http://localhost:4000';
    return root.replace(/\/+$/, '') + path;
  }

  // Request a magic link
  router.post('/magic-link', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: 'email_required' });

    const token = generateToken();
    TOKENS.set(token, { email, expiresAt: Date.now() + TTL_MS, used: false });

    // In dev we return the URL; in prod you'd email it.
    const url = abs(`/portal-login.html?token=${encodeURIComponent(token)}`);
    return res.json({ ok: true, url, expires_in_seconds: TTL_MS / 1000 });
  });

  // Consume a magic link (one-time)
  router.get('/magic-link/consume', (req, res) => {
    const token = String(req.query.token || '');
    const rec = TOKENS.get(token);
    if (!rec) return res.status(400).json({ ok: false, error: 'invalid_or_expired' });

    if (rec.used) {
      TOKENS.delete(token);
      return res.status(400).json({ ok: false, error: 'already_used' });
    }
    if (Date.now() > rec.expiresAt) {
      TOKENS.delete(token);
      return res.status(400).json({ ok: false, error: 'expired' });
    }

    rec.used = true;
    TOKENS.delete(token); // one-time use
    return res.json({ ok: true, email: rec.email });
  });

  return router;
}
