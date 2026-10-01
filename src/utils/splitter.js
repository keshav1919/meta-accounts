const { formatAccountDelivery } = require('./formatter');

/**
 * Splits customer account deliveries into Telegram message chunks (<4096 chars)
 * Maintains continuous sequential numbering across all messages.
 * @param {Array<object>} accounts
 * @returns {Array<string>} Array of message strings ready to send via Telegram
 */
const splitDeliveryMessages = (accounts) => {
  if (!accounts || accounts.length === 0) return [];

  const formattedItems = accounts.map((acc, idx) => ({
    number: idx + 1,
    text: formatAccountDelivery(acc, idx + 1),
  }));

  const MAX_CHARS_PER_MESSAGE = 3500;
  const chunks = [];
  let currentChunk = [];
  let currentLen = 0;

  for (const item of formattedItems) {
    const itemLen = item.text.length + 2; // account text + \n\n
    if (currentLen + itemLen > MAX_CHARS_PER_MESSAGE && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [item];
      currentLen = itemLen;
    } else {
      currentChunk.push(item);
      currentLen += itemLen;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  const totalParts = chunks.length;

  if (totalParts === 1) {
    return [
      `📦 YOUR ACCOUNTS\n\n${chunks[0].map((item) => item.text).join('\n\n')}`,
    ];
  }

  return chunks.map((chunk, index) => {
    const partNum = index + 1;
    const body = chunk.map((item) => item.text).join('\n\n');
    return `📦 ACCOUNTS — PART ${partNum}/${totalParts}\n\n${body}`;
  });
};

module.exports = {
  splitDeliveryMessages,
};
