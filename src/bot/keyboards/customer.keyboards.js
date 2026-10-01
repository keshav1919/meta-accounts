const { Markup } = require('telegraf');
const config = require('../../config');

/**
 * Customer Keyboards - React-Router Styled Clean Navigation Flow
 */

/**
 * Channel Join Verification Keyboard
 */
const getChannelJoinKeyboard = () => {
  return Markup.inlineKeyboard([
    [{ text: '📢 Join Official Channel', url: config.channelUsername, style: 'primary' }],
    [{ text: '✅ Check Membership', callback_data: 'check_join', style: 'success' }],
  ]);
};

/**
 * Clean Root Route Keyboard (Main Menu)
 * Only 4 top-level routes:
 * 1. 🛒 Buy Accounts (Green action)
 * 2. 💰 Wallet & Funds | 📋 My Orders (Blue primary routes)
 * 3. 👥 Refer & Earn | 📞 Support (Blue & Red)
 */
const getMainMenuKeyboard = ({ availableStock = 0, isAdmin = false } = {}) => {
  const stockText = availableStock > 0 ? ` [${availableStock} Left]` : ' [0 Left]';

  const buttons = [
    // Route 1: Buy (Featured Action)
    [
      {
        text: `🛒 Buy Accounts (₹3/each)${stockText}`,
        callback_data: 'menu_buy',
        style: 'success',
      },
    ],
    // Route 2 & 3: Wallet & Orders
    [
      {
        text: '💰 Wallet & Funds',
        callback_data: 'menu_wallet',
        style: 'primary',
      },
      {
        text: '📋 My Orders',
        callback_data: 'menu_purchases',
        style: 'primary',
      },
    ],
    // Route 4 & 5: Referrals & Support
    [
      {
        text: '👥 Refer & Earn',
        callback_data: 'menu_referral',
        style: 'primary',
      },
      {
        text: '📞 Support',
        callback_data: 'menu_support',
        style: 'danger',
      },
    ],
  ];

  if (isAdmin) {
    buttons.push([
      {
        text: '🛠 Admin Panel',
        callback_data: 'admin_menu',
      },
    ]);
  }

  return Markup.inlineKeyboard(buttons);
};

/**
 * Sub-Route Keyboard: 💰 Wallet & Funds (/wallet)
 */
const getWalletKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      { text: '➕ Add Funds', callback_data: 'menu_deposit', style: 'success' },
      { text: '💳 Transactions', callback_data: 'menu_transactions', style: 'primary' },
    ],
    [{ text: '🏠 Back to Menu', callback_data: 'main_menu' }],
  ]);
};

/**
 * Sub-Route Keyboard: 📋 Orders (/orders)
 */
const getOrdersKeyboard = () => {
  return Markup.inlineKeyboard([
    [{ text: '🛒 Buy Accounts', callback_data: 'menu_buy', style: 'success' }],
    [{ text: '🏠 Back to Menu', callback_data: 'main_menu' }],
  ]);
};

/**
 * Sub-Route Keyboard: 💳 Transactions (/transactions)
 */
const getTransactionsKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      { text: '💰 Back to Wallet', callback_data: 'menu_wallet', style: 'primary' },
      { text: '🏠 Back to Menu', callback_data: 'main_menu' },
    ],
  ]);
};

/**
 * Clean Persistent 4-Dot Bottom Reply Keyboard (ReplyKeyboardMarkup)
 */
const getBottomReplyKeyboard = (isAdmin = false) => {
  const rows = [
    ['🛒 Buy Accounts', '💰 Wallet & Funds'],
    ['📋 My Orders', '👥 Refer & Earn'],
    ['📞 Support'],
  ];

  if (isAdmin) {
    rows.push(['🛠 Admin Panel']);
  }

  return Markup.keyboard(rows).resize().persistent();
};

/**
 * Deposit payment keyboard (Screenshot only)
 */
const getPaymentMethodKeyboard = () => {
  return Markup.inlineKeyboard([
    [{ text: '🏠 Back to Menu', callback_data: 'main_menu' }],
  ]);
};

/**
 * Buy quantity selector keyboard (multiples of 10 up to available stock)
 */
const getBuyQuantityKeyboard = (availableStock) => {
  const rows = [];
  let currentRow = [];

  const maxQty = Math.min(availableStock, 100);
  for (let q = 10; q <= maxQty; q += 10) {
    currentRow.push({
      text: `${q} Accounts`,
      callback_data: `buy_select_${q}`,
      style: 'success',
    });
    if (currentRow.length === 2) {
      rows.push(currentRow);
      currentRow = [];
    }
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  rows.push([{ text: '🏠 Cancel & Back to Menu', callback_data: 'main_menu' }]);

  return Markup.inlineKeyboard(rows);
};

/**
 * Order confirmation keyboard
 */
const getOrderConfirmationKeyboard = (quantity) => {
  return Markup.inlineKeyboard([
    [
      {
        text: '✅ Confirm Purchase',
        callback_data: `buy_confirm_${quantity}`,
        style: 'success',
      },
      {
        text: '❌ Cancel',
        callback_data: 'main_menu',
        style: 'danger',
      },
    ],
  ]);
};

/**
 * Back to Main Menu keyboard
 */
const getBackToMenuKeyboard = () => {
  return Markup.inlineKeyboard([
    [{ text: '🏠 Back to Menu', callback_data: 'main_menu' }],
  ]);
};

module.exports = {
  getChannelJoinKeyboard,
  getMainMenuKeyboard,
  getWalletKeyboard,
  getOrdersKeyboard,
  getTransactionsKeyboard,
  getBottomReplyKeyboard,
  getPaymentMethodKeyboard,
  getBuyQuantityKeyboard,
  getOrderConfirmationKeyboard,
  getBackToMenuKeyboard,
};
