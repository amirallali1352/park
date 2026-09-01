export class LoginRateLimiter {
  #attempts = new Map();
  #maxAttempts;
  #windowMs;

  constructor({ maxAttempts = 5, windowMs = 60_000 } = {}) {
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 ||
        !Number.isInteger(windowMs) || windowMs < 1) {
      throw new TypeError("Login rate limit settings must be positive integers.");
    }
    this.#maxAttempts = maxAttempts;
    this.#windowMs = windowMs;
  }

  check(key, now = Date.now()) {
    const entries = (this.#attempts.get(key) ?? [])
      .filter((timestamp) => now - timestamp < this.#windowMs);
    this.#attempts.set(key, entries);
    if (entries.length < this.#maxAttempts) return { allowed: true, retryAfterSeconds: 0 };
    const retryAfterSeconds = Math.ceil((entries[0] + this.#windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  recordFailure(key, now = Date.now()) {
    const entries = this.#attempts.get(key) ?? [];
    this.#attempts.set(key, [...entries, now]);
  }

  reset(key) {
    this.#attempts.delete(key);
  }
}
