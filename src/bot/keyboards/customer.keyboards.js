const { Markup } = require('telegraf');
const config = require('../../config');

/**
 * Clean Single-Page Style Inline Keyboards
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
 * Minimalist Clean Main Menu Keyboard (Inline Only)
 */
const getMainMenuKeyboard = ({ availableStock = 0, isAdmin = false } = {}) => {
  const stockText = availableStock > 0 ? ` [${availableStock} Left]` : ' [0 Left]';

  const buttons = [
    // Top Green Action Button
    [
      {
        text: `🛒 Buy Accounts (₹3/each)${stockText}`,
        callback_data: 'menu_buy',
        style: 'success',
      },
    ],
    // Blue Sub-Routes
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
    // Blue Referral & Red Support
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
 * Sub-Route Keyboard: 💰 Wallet & Funds
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
 * Sub-Route Keyboard: 📋 Orders
 */
const getOrdersKeyboard = () => {
  return Markup.inlineKeyboard([
    [{ text: '🛒 Buy Accounts', callback_data: 'menu_buy', style: 'success' }],
    [{ text: '🏠 Back to Menu', callback_data: 'main_menu' }],
  ]);
};

/**
 * Sub-Route Keyboard: 💳 Transactions
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
 * Deposit payment keyboard
 */
const getPaymentMethodKeyboard = () => {
  return Markup.inlineKeyboard([
    [{ text: '🏠 Back to Menu', callback_data: 'main_menu' }],
  ]);
};

/**
 * Multiples of 10 Buy Quantity Keyboard
 * Supports quick-select presets, max buy, and custom input for any multiple of 10
 */
const getBuyQuantityKeyboard = (availableStock) => {
  const rows = [];
  const maxMultipleOf10 = Math.floor(availableStock / 10) * 10;

  // Presets of 10s based on available stock
  const candidateQtys = [10, 20, 30, 50, 100, 200, 500].filter((q) => q <= availableStock);

  let currentRow = [];
  for (const q of candidateQtys) {
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

  // Max Available button if > 30 and not already exact preset
  if (maxMultipleOf10 > 30 && !candidateQtys.includes(maxMultipleOf10)) {
    rows.push([
      {
        text: `⚡ Buy Max (${maxMultipleOf10} Accounts)`,
        callback_data: `buy_select_${maxMultipleOf10}`,
        style: 'success',
      },
    ]);
  }

  // Custom Quantity Button (Allows entering any multiple of 10)
  rows.push([
    {
      text: '✏️ Enter Custom Quantity (Multiples of 10)',
      callback_data: 'buy_custom_qty',
      style: 'primary',
    },
  ]);

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
  getPaymentMethodKeyboard,
  getBuyQuantityKeyboard,
  getOrderConfirmationKeyboard,
  getBackToMenuKeyboard,
};
