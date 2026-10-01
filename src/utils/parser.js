/**
 * Parser for Stock TXT Files
 * Handles varying line endings, repeated headers, missing numbering, and validates exact 10 records.
 */

/**
 * Parses raw TXT content into batch metadata and validated account objects
 * @param {string} content - Raw content of the uploaded TXT file
 * @returns {{
 *   success: boolean,
 *   batchNumber: number | null,
 *   accounts: Array<{ fullName: string, email: string, password: string, createdOn: string }>,
 *   error?: string,
 *   count?: number
 * }}
 */
const parseStockFile = (content) => {
  if (!content || typeof content !== 'string') {
    return {
      success: false,
      error: 'Empty or invalid file content',
      accounts: [],
      count: 0,
    };
  }

  // 1. Extract batch number if present (e.g. "META ACCOUNTS BATCH #16" or "BATCH 16")
  let batchNumber = null;
  const batchMatch = content.match(/BATCH\s*#?\s*(\d+)/i);
  if (batchMatch && batchMatch[1]) {
    batchNumber = parseInt(batchMatch[1], 10);
  }

  // 2. Normalize line breaks to \n
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Find all account segments
  // Each account has "full name -", "email -", "password -", and "created on"
  // We can match them using a robust regular expression that handles optional spacing and newlines
  const regex = /full\s*name\s*[-:]\s*([^\n\r]+)\s*\n\s*email\s*[-:]\s*([^\n\r]+)\s*\n\s*password\s*[-:]\s*([^\n\r]+)\s*[\s\S]*?created\s*on\s*[-:]?\s*\(?([^\n\r()]+)\)?/gi;

  const accounts = [];
  let match;

  while ((match = regex.exec(normalized)) !== null) {
    const fullName = match[1].trim();
    const email = match[2].trim().toLowerCase();
    const password = match[3].trim();
    const createdOn = match[4].trim();

    if (fullName && email && password && createdOn) {
      accounts.push({
        fullName,
        email,
        password,
        createdOn,
      });
    }
  }

  // 4. Validate exact 10 accounts constraint (Section 18)
  if (accounts.length !== 10) {
    return {
      success: false,
      batchNumber,
      count: accounts.length,
      accounts: [],
      error: `Expected: 10 accounts\nDetected: ${accounts.length} accounts\n\nNothing was added.`,
    };
  }

  // 5. Check for intra-file duplicates
  const emailSet = new Set();
  const fileDuplicates = [];
  for (const acc of accounts) {
    if (emailSet.has(acc.email)) {
      fileDuplicates.push(acc.email);
    }
    emailSet.add(acc.email);
  }

  if (fileDuplicates.length > 0) {
    return {
      success: false,
      batchNumber,
      count: accounts.length,
      accounts: [],
      error: `Duplicate accounts found within the same file:\n${fileDuplicates.join(', ')}`,
    };
  }

  return {
    success: true,
    batchNumber,
    count: accounts.length,
    accounts,
  };
};

module.exports = {
  parseStockFile,
};
