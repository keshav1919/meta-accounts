/**
 * Ultra-fast, lightweight in-memory cache with TTL support
 * Designed for high-concurrency Telegram bots to minimize DB queries and API calls.
 */

class MemoryCache {
  constructor() {
    this.store = new Map();

    // Auto-cleanup expired entries every 60 seconds
    const interval = setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.store.entries()) {
        if (now > item.expiresAt) {
          this.store.delete(key);
        }
      }
    }, 60 * 1000);

    // unref() ensures this interval doesn't hold the Node.js event loop open
    if (interval.unref) {
      interval.unref();
    }
  }

  /**
   * Get cached item or null if expired/non-existent
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  /**
   * Set cache item with time-to-live in milliseconds
   * @param {string} key
   * @param {*} value
   * @param {number} ttlMs (default: 60000ms = 1 min)
   */
  set(key, value, ttlMs = 60000) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Invalidate specific key
   * @param {string} key
   */
  delete(key) {
    this.store.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.store.clear();
  }
}

const cache = new MemoryCache();

module.exports = {
  cache,
  MemoryCache,
};
