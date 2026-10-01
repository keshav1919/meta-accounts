/**
 * In-memory conversational state manager for interactive multi-step flows
 * Equipped with automatic TTL cleanup to maintain minimal memory footprint under heavy load.
 */

const userStates = new Map();
const STATE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL for abandoned flows

const setState = (telegramId, state, data = {}) => {
  const key = String(telegramId);
  userStates.set(key, { state, data, timestamp: Date.now() });
};

const getState = (telegramId) => {
  const key = String(telegramId);
  const userState = userStates.get(key);
  if (!userState) return null;
  if (Date.now() - userState.timestamp > STATE_TTL_MS) {
    userStates.delete(key);
    return null;
  }
  return userState;
};

const clearState = (telegramId) => {
  const key = String(telegramId);
  userStates.delete(key);
};

// Periodic auto-cleanup every 5 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of userStates.entries()) {
    if (now - val.timestamp > STATE_TTL_MS) {
      userStates.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

module.exports = {
  setState,
  getState,
  clearState,
};
