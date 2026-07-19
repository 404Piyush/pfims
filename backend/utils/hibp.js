const crypto = require('crypto');

// k-anonymity range query against https://api.pwnedpasswords.com/range/{first 5 sha1 chars}.
// We send only the first 5 hex chars; the response is the suffix list. The user
// password NEVER leaves this process — only its first-5-char fingerprint.
//
// Disabled when HIBP_DISABLED=true (e.g. air-gapped dev / CI). Network
// failures are swallowed and treated as "not in breach" so we don't lock
// people out when the network blips. The endpoint pads the response with
// ~800 random lines, which is exactly what enables k-anonymity.

const cache = new Map();           // sha1Prefix -> { at, body }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 4000;

function sha1Hex(s) {
  return crypto.createHash('sha1').update(s, 'utf8').digest('hex').toUpperCase();
}

async function getRangeBody(prefix) {
  const cached = cache.get(prefix);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.body;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let body;
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: 'GET',
      headers: { 'Add-Padding': 'true', 'User-Agent': 'pfims-password-check' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    body = await res.text();
    cache.set(prefix, { at: Date.now(), body });
    return body;
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function rejectedByHIBP(password) {
  if (!password || typeof password !== 'string') return null;
  if (process.env.HIBP_DISABLED === 'true') return null;

  const h = sha1Hex(password);
  const prefix = h.slice(0, 5);
  const suffix = h.slice(5);
  const body = await getRangeBody(prefix);
  if (!body) return null;

  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [s, count] = trimmed.split(':');
    if (s && s.toUpperCase() === suffix) {
      const n = parseInt(count, 10);
      if (Number.isFinite(n) && n > 0) return { count: n };
    }
  }
  return null;
}

module.exports = { rejectedByHIBP };
