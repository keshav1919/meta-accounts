const { Markup } = require('telegraf');
const config = require('../../config');

/**
 * Customer Keyboards and Multi-Color Inline Button Layouts
 * Uses Telegram Bot API 9.4 native button styles:
 * - style: 'success' -> Green background
 * - style: 'primary' -> Blue background
 * - style: 'danger'  -> Red background
 * - default          -> Dark grey background
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
 * Main Customer Multi-Color Inline Menu Keyboard
 * Matches the reference image layout:
 * - Green full-width header action button (style: 'success')
 * - Blue information and balance buttons (style: 'primary')
 * - Green funding button (style: 'success')
 * - Red support button (style: 'danger')
 * - Dark standard main menu button
 */
const getMainMenuKeyboard = ({ availableStock = 0, isAdmin = false } = {}) => {
  const stockText = availableStock > 0 ? ` [${availableStock} Left]` : ' [0 Left]';

  const buttons = [
    // Top Green Button (Action)
    [
      {
        text: `🛒 Buy Accounts (₹3/each)${stockText}`,
        callback_data: 'menu_buy',
        style: 'success',
      },
    ],
    // Blue Buttons (Stock & Balance)
    [
      {
        text: `📦 Available Stock: ${availableStock}`,
        callback_data: 'menu_stock',
        style: 'primary',
      },
      {
        text: '💰 Balance',
        callback_data: 'menu_balance',
        style: 'primary',
      },
    ],
    // Green Add Funds & Blue Purchases
    [
      {
        text: '➕ Add Funds',
        callback_data: 'menu_deposit',
        style: 'success',
      },
      {
        text: '📋 My Purchases',
        callback_data: 'menu_purchases',
        style: 'primary',
      },
    ],
    // Blue Ledger & Referrals
    [
      {
        text: '💳 Transactions',
        callback_data: 'menu_transactions',
        style: 'primary',
      },
      {
        text: '👥 Refer & Earn',
        callback_data: 'menu_referral',
        style: 'primary',
      },
    ],
    // Red Support & Dark Home Button
    [
      {
        text: '📞 Support',
        callback_data: 'menu_support',
        style: 'danger',
      },
      {
        text: '🏠 Main Menu',
        callback_data: 'main_menu',
      },
    ],
  ];

  if (isAdmin) {
    buttons.push([
      {
        text: '🛠 Admin Control Panel',
        callback_data: 'admin_menu',
        style: 'primary',
      },
    ]);
  }

  return Markup.inlineKeyboard(buttons);
};

/**
 * Persistent 4-Dot Bottom Reply Keyboard (ReplyKeyboardMarkup)
 * Renders the 4-dots grid icon at the bottom of the Telegram chat bar
 */
const getBottomReplyKeyboard = (isAdmin = false) => {
  const rows = [
    ['🛒 Buy Accounts', '📦 Available Stock'],
    ['💰 Balance', '➕ Add Funds'],
    ['📦 My Purchases', '💳 Transactions'],
    ['👥 Refer & Earn', '📞 Support'],
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
 * Multi-color green options with dark cancel button
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
 * Order confirmation keyboard with multi-color buttons:
 * - Green confirm button (style: 'success')
 * - Red cancel button (style: 'danger')
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
  getBottomReplyKeyboard,
  getPaymentMethodKeyboard,
  getBuyQuantityKeyboard,
  getOrderConfirmationKeyboard,
  getBackToMenuKeyboard,
};
