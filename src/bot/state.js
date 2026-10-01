/**
 * In-memory conversational state manager for interactive multi-step flows
 */

const userStates = new Map();

const setState = (telegramId, state, data = {}) => {
  const key = String(telegramId);
  userStates.set(key, { state, data, timestamp: Date.now() });
};

const getState = (telegramId) => {
  const key = String(telegramId);
  return userStates.get(key) || null;
};

const clearState = (telegramId) => {
  const key = String(telegramId);
  userStates.delete(key);
};

module.exports = {
  setState,
  getState,
  clearState,
};
