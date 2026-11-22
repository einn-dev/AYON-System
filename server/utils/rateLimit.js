/* ─────────────────────────────────────────────────────────────
   Limits how often the same person can try something (sign in, ask for a
   reset link...), so a password cannot be guessed by trying thousands of times
   and the email service cannot be flooded.

   Counts are kept in the server's memory: they start again when the server
   restarts, which is fine for one server (Render).

   limit({ name, max, windowMin, by }) gives an Express middleware.
     by: 'ip'        one count per network address
         'ip+email'  one count per network address and email typed in
   Over the limit: 429 with a clear message and a Retry-After header.
   ───────────────────────────────────────────────────────────── */

const buckets = new Map();      // key -> { count, resetAt }

const emailOf = (req) => String((req.body || {}).email || '').trim().toLowerCase().slice(0, 254);

const limit = ({ name, max, windowMin, by = 'ip' }) => (req, res, next) => {
  const now = Date.now();
  const who = by === 'ip+email' ? `${req.ip}|${emailOf(req)}` : String(req.ip);
  const key = `${name}|${who}`;

  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMin * 60 * 1000 };
    buckets.set(key, b);
  }
  b.count += 1;

  if (b.count > max) {
    const wait = Math.max(1, Math.ceil((b.resetAt - now) / 60000));
    res.set('Retry-After', String(Math.ceil((b.resetAt - now) / 1000)));
    return res.status(429).json({
      message: `Too many attempts. Please wait ${wait} minute${wait === 1 ? '' : 's'} and try again.`,
      code: 'TOO_MANY_ATTEMPTS',
    });
  }
  return next();
};

/* forget old counts every 10 minutes so the memory stays small */
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 10 * 60 * 1000).unref();

module.exports = { limit };