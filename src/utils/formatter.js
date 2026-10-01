/**
 * Utility functions for currency, dates, and text formatting
 */

/**
 * Convert integer paise to Indian Rupee string (e.g. 5000 paise -> "₹50.00")
 * @param {number|bigint|string} paise
 * @returns {string}
 */
const formatPaise = (paise) => {
  const bigPaise = BigInt(paise || 0);
  const isNegative = bigPaise < 0n;
  const absPaise = isNegative ? -bigPaise : bigPaise;
  const rupees = absPaise / 100n;
  const remainingPaise = absPaise % 100n;
  const paiseStr = remainingPaise.toString().padStart(2, '0');
  const formatted = `₹${rupees.toLocaleString('en-IN')}.${paiseStr}`;
  return isNegative ? `-${formatted}` : formatted;
};

/**
 * Parse a rupee string or number safely into integer paise BigInt
 * Rejects invalid, negative, zero, or > 2 decimal places.
 * @param {string|number} input
 * @returns {{ valid: boolean, paise?: bigint, error?: string }}
 */
const parseRupeesToPaise = (input) => {
  if (input === null || input === undefined) {
    return { valid: false, error: 'Amount is required' };
  }
  const cleanStr = String(input).trim();
  // Match standard positive decimal e.g. "50", "50.0", "50.25"
  if (!/^\d+(\.\d{1,2})?$/.test(cleanStr)) {
    return { valid: false, error: 'Please enter a valid amount (e.g. 10 or 50.00)' };
  }

  const parts = cleanStr.split('.');
  const whole = BigInt(parts[0]);
  let fraction = 0n;
  if (parts.length > 1) {
    fraction = BigInt(parts[1].padEnd(2, '0').slice(0, 2));
  }
  const totalPaise = whole * 100n + fraction;

  if (totalPaise <= 0n) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }

  return { valid: true, paise: totalPaise };
};

/**
 * Format a Date object into IST (Asia/Kolkata) string: e.g. "01 Oct 2026, 09:30:15 IST"
 * @param {Date|string|number} date
 * @returns {string}
 */
const formatDateIST = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';

  const options = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };

  const formatted = new Intl.DateTimeFormat('en-IN', options).format(d);
  return `${formatted} IST`;
};

/**
 * Format an account record for delivery to customer
 * Adheres strictly to Section 27 and Section 58.
 * @param {object} account
 * @param {number} sequentialNumber
 * @returns {string}
 */
const formatAccountDelivery = (account, sequentialNumber) => {
  const createdOnStr = account.createdOn.startsWith('(') && account.createdOn.endsWith(')')
    ? account.createdOn
    : `(${account.createdOn})`;

  return `Account #${sequentialNumber}
-----------------------------------------
full name - ${account.fullName}
email - ${account.email}
password - ${account.password}

created on ${createdOnStr}`;
};

/**
 * Escape HTML special characters for Telegram HTML mode
 * @param {string} str
 * @returns {string}
 */
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

module.exports = {
  formatPaise,
  parseRupeesToPaise,
  formatDateIST,
  formatAccountDelivery,
  escapeHtml,
};
