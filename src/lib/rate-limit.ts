const attempts = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_ATTEMPTS = 5;

interface RateLimitOptions {
  windowMs?: number;
  maxAttempts?: number;
}

export function checkRateLimit(
  key: string,
  opts?: RateLimitOptions
): { allowed: boolean; retryAfterSeconds?: number } {
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const now = Date.now();
  const entry = attempts.get(key);

  // Clean up expired entry
  if (entry && now >= entry.resetAt) {
    attempts.delete(key);
  }

  const current = attempts.get(key);

  if (!current) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (current.count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  current.count++;
  return { allowed: true };
}

// Periodic cleanup to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of attempts) {
      if (now >= entry.resetAt) {
        attempts.delete(key);
      }
    }
  }, 60 * 1000);
}
