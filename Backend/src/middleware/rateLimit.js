function createRateLimit({ windowMs, max, message, keyGenerator }) {
  const attempts = new Map();

  function getEntry(key, now) {
    const existing = attempts.get(key);

    if (!existing || existing.resetAt <= now) {
      const fresh = { count: 0, resetAt: now + windowMs };
      attempts.set(key, fresh);
      return fresh;
    }

    return existing;
  }

  const cleanup = setInterval(() => {
    const now = Date.now();

    for (const [key, entry] of attempts.entries()) {
      if (entry.resetAt <= now) {
        attempts.delete(key);
      }
    }
  }, windowMs);

  cleanup.unref?.();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = keyGenerator ? keyGenerator(req) : req.ip;
    const entry = getEntry(key, now);

    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: message || "Too many requests. Please try again later.",
      });
    }

    next();
  };
}

module.exports = createRateLimit;
