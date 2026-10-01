const assert = require('assert');
const { formatPaise, parseRupeesToPaise, formatDateIST, formatAccountDelivery } = require('./src/utils/formatter');
const { parseStockFile } = require('./src/utils/parser');
const { splitDeliveryMessages } = require('./src/utils/splitter');
const config = require('./src/config');

console.log('Running automated verification tests...\n');

// 1. Currency formatting & parsing tests
console.log('Testing Currency Formatter & Parser...');
assert.strictEqual(formatPaise(100n), '₹1.00');
assert.strictEqual(formatPaise(300n), '₹3.00');
assert.strictEqual(formatPaise(5000n), '₹50.00');
assert.strictEqual(formatPaise(100050n), '₹1,000.50');

const p1 = parseRupeesToPaise('50');
assert.strictEqual(p1.valid, true);
assert.strictEqual(p1.paise, 5000n);

const p2 = parseRupeesToPaise('50.25');
assert.strictEqual(p2.valid, true);
assert.strictEqual(p2.paise, 5025n);

const pInvalid = parseRupeesToPaise('-10');
assert.strictEqual(pInvalid.valid, false);

const pZero = parseRupeesToPaise('0');
assert.strictEqual(pZero.valid, false);
console.log('✔ Currency tests passed.\n');

// 2. Date formatting in IST
console.log('Testing IST Date Formatter...');
const dateStr = formatDateIST(new Date('2026-10-01T04:15:00Z'));
assert.ok(dateStr.includes('IST'));
console.log('✔ Date format:', dateStr);
console.log('✔ IST Date test passed.\n');

// 3. Stock TXT Parser tests
console.log('Testing Stock TXT Parser...');
const generateSampleTxt = (count) => {
  let txt = `=========================================\nMETA ACCOUNTS BATCH #16\nTotal Accounts: ${count}\n=========================================\n\n`;
  for (let i = 1; i <= count; i++) {
    txt += `Account #1\n-----------------------------------------\nfull name - User ${i}\nemail - user${i}@legendtech.store\npassword - pass${i}@@\n\ncreated on (29/09/2026, 13:10:02 IST)\n\n`;
  }
  return txt;
};

// Test valid 10 accounts
const validTxt = generateSampleTxt(10);
const res10 = parseStockFile(validTxt);
assert.strictEqual(res10.success, true);
assert.strictEqual(res10.count, 10);
assert.strictEqual(res10.batchNumber, 16);
assert.strictEqual(res10.accounts[0].fullName, 'User 1');
assert.strictEqual(res10.accounts[9].fullName, 'User 10');

// Test 9 accounts (must fail)
const res9 = parseStockFile(generateSampleTxt(9));
assert.strictEqual(res9.success, false);
assert.ok(res9.error.includes('Expected: 10 accounts'));

// Test 11 accounts (must fail)
const res11 = parseStockFile(generateSampleTxt(11));
assert.strictEqual(res11.success, false);
assert.ok(res11.error.includes('Expected: 10 accounts'));

// Test duplicate emails in file
const dupTxt = validTxt + `Account #1\n-----------------------------------------\nfull name - Duplicate\nemail - user1@legendtech.store\npassword - pass@@\n\ncreated on (29/09/2026, 13:10:02 IST)\n\n`;
// Total is now 11 so count will reject, but let's test file duplicates directly
const dupSameCountTxt = `Account #1\n-----------------------------------------\nfull name - User 1\nemail - user1@legendtech.store\npassword - pass1@@\n\ncreated on (29/09/2026, 13:10:02 IST)\n\n`.repeat(10);
const resDup = parseStockFile(dupSameCountTxt);
assert.strictEqual(resDup.success, false);
assert.ok(resDup.error.includes('Duplicate'));
console.log('✔ Stock TXT Parser tests passed.\n');

// 4. Splitter & Delivery Formatting tests
console.log('Testing Telegram Message Splitter...');
const mockAccounts = Array.from({ length: 50 }, (_, i) => ({
  fullName: `Customer Name ${i + 1}`,
  email: `cust${i + 1}@domain.com`,
  password: `SecretPass${i + 1}!`,
  createdOn: '29/09/2026, 13:10:00 IST',
}));

const deliveryMessages = splitDeliveryMessages(mockAccounts);
assert.ok(deliveryMessages.length > 1);
assert.ok(deliveryMessages[0].includes('PART 1/'));
assert.ok(deliveryMessages[deliveryMessages.length - 1].includes(`PART ${deliveryMessages.length}/`));
// Check that Account #1 and Account #50 are present
assert.ok(deliveryMessages[0].includes('Account #1'));
assert.ok(deliveryMessages[deliveryMessages.length - 1].includes('Account #50'));
console.log(`✔ Split 50 accounts into ${deliveryMessages.length} Telegram messages successfully.\n`);

// 5. Admin Authorization tests
console.log('Testing Admin Authorization...');
config.adminIds = ['5232576810', '987654321'];
assert.strictEqual(config.isAdmin(5232576810), true);
assert.strictEqual(config.isAdmin('5232576810'), true);
assert.strictEqual(config.isAdmin('987654321'), true);
assert.strictEqual(config.isAdmin('111111111'), false);
assert.strictEqual(config.isAdmin(null), false);
console.log('✔ Admin check passed.\n');

// 6. Test UPI QR Code Generator
console.log('Testing UPI QR Code Generator...');
const { generateUpiPayString, generateUpiQrBuffer } = require('./src/utils/qrcode');
const payString = generateUpiPayString({
  upiId: 'xdsellerkeshav@fam',
  name: 'LEGEND',
  amountPaise: 5000n,
});
assert.strictEqual(payString, 'upi://pay?pa=xdsellerkeshav@fam&pn=LEGEND&am=50.00&cu=INR');

generateUpiQrBuffer({
  upiId: 'xdsellerkeshav@fam',
  name: 'LEGEND',
  amountPaise: 5000n,
}).then((buf) => {
  assert.ok(Buffer.isBuffer(buf), 'QR result must be a buffer');
  assert.ok(buf.length > 500, 'QR buffer must be non-empty');
  console.log('✔ UPI QR Code tests passed.\n');
  console.log('🎉 ALL AUTOMATED VERIFICATION TESTS PASSED SUCCESSFULLY!');
}).catch((err) => {
  console.error('❌ UPI QR test failed:', err);
  process.exit(1);
});

