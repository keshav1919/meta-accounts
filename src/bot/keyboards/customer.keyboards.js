const { Markup } = require('telegraf');
const config = require('../../config');

/**
 * Customer Keyboards and UI Layouts
 */

/**
 * Channel Join Verification Keyboard (Section 4)
 */
const getChannelJoinKeyboard = () => {
  return Markup.inlineKeyboard([
    [Markup.button.url('📢 Join Channel', config.channelUsername)],
    [Markup.button.callback('✅ Check Join', 'check_join')],
  ]);
};

/**
 * Main Customer Menu Keyboard (Section 33, 34)
 */
const getMainMenuKeyboard = (isAdmin = false) => {
  const buttons = [
    [Markup.button.callback('🛒 Buy Accounts', 'menu_buy')],
    [
      Markup.button.callback('💰 Balance', 'menu_balance'),
      Markup.button.callback('➕ Add Funds', 'menu_deposit'),
    ],
    [
      Markup.button.callback('📦 My Purchases', 'menu_purchases'),
      Markup.button.callback('💳 Transactions', 'menu_transactions'),
    ],
    [Markup.button.callback('👥 Refer & Earn', 'menu_referral')],
    [Markup.button.callback('📞 Support', 'menu_support')],
  ];

  if (isAdmin) {
    buttons.push([Markup.button.callback('🛠 Admin Panel', 'admin_menu')]);
  }

  return Markup.inlineKeyboard(buttons);
};

/**
 * Payment method selection keyboard (Section 9)
 */
const getPaymentMethodKeyboard = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔢 Submit UTR', 'deposit_method_utr')],
    [Markup.button.callback('📷 Upload Screenshot', 'deposit_method_screenshot')],
    [Markup.button.callback('🔙 Back to Menu', 'main_menu')],
  ]);
};

/**
 * Buy quantity selector keyboard (multiples of 10 up to available stock)
 * @param {number} availableStock
 */
const getBuyQuantityKeyboard = (availableStock) => {
  const rows = [];
  let currentRow = [];

  // Quantities in steps of 10, up to availableStock or max reasonable (e.g. 100)
  const maxQty = Math.min(availableStock, 100);
  for (let q = 10; q <= maxQty; q += 10) {
    currentRow.push(Markup.button.callback(`${q}`, `buy_select_${q}`));
    if (currentRow.length === 2) {
      rows.push(currentRow);
      currentRow = [];
    }
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  rows.push([Markup.button.callback('🔙 Back to Menu', 'main_menu')]);

  return Markup.inlineKeyboard(rows);
};

/**
 * Order confirmation keyboard (Section 23)
 * @param {number} quantity
 */
const getOrderConfirmationKeyboard = (quantity) => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Confirm Purchase', `buy_confirm_${quantity}`)],
    [Markup.button.callback('❌ Cancel', 'main_menu')],
  ]);
};

/**
 * Back to Main Menu keyboard
 */
const getBackToMenuKeyboard = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Back to Menu', 'main_menu')],
  ]);
};

module.exports = {
  getChannelJoinKeyboard,
  getMainMenuKeyboard,
  getPaymentMethodKeyboard,
  getBuyQuantityKeyboard,
  getOrderConfirmationKeyboard,
  getBackToMenuKeyboard,
};
