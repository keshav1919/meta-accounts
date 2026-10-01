const { Markup } = require('telegraf');
const config = require('../../config');

/**
 * Customer Keyboards and UI Layouts
 */

/**
 * Channel Join Verification Keyboard
 */
const getChannelJoinKeyboard = () => {
  return Markup.inlineKeyboard([
    [Markup.button.url('📢 Join Channel', config.channelUsername)],
    [Markup.button.callback('✅ Check Join', 'check_join')],
  ]);
};

/**
 * Main Customer Inline Menu Keyboard
 * Styled with green (🟢), blue (🔵), and red (🔴) matching the custom UI theme
 * @param {object} params
 * @param {number} params.availableStock
 * @param {boolean} params.isAdmin
 */
const getMainMenuKeyboard = ({ availableStock = 0, isAdmin = false } = {}) => {
  const stockText = availableStock > 0 ? ` (${availableStock} Avail)` : ' (0 Avail)';
  
  const buttons = [
    [Markup.button.callback(`🟢 🛒 Buy Accounts${stockText}`, 'menu_buy')],
    [Markup.button.callback(`🔵 📦 Available Stock: ${availableStock}`, 'menu_stock')],
    [
      Markup.button.callback('🔵 💰 Balance', 'menu_balance'),
      Markup.button.callback('🟢 ➕ Add Funds', 'menu_deposit'),
    ],
    [
      Markup.button.callback('🔵 📦 My Purchases', 'menu_purchases'),
      Markup.button.callback('🔵 💳 Transactions', 'menu_transactions'),
    ],
    [
      Markup.button.callback('🔵 👥 Refer & Earn', 'menu_referral'),
      Markup.button.callback('🔴 📞 Support', 'menu_support'),
    ],
  ];

  // If a web app URL is available (e.g. from Render or local URL), add WebApp button
  const webAppUrl = config.webhookUrl ? `${config.webhookUrl.replace(/\/$/, '')}/webapp` : null;
  if (webAppUrl) {
    buttons.push([Markup.button.webApp('📱 Open Colored UI Menu', webAppUrl)]);
  }

  if (isAdmin) {
    buttons.push([Markup.button.callback('🛠 Admin Panel', 'admin_menu')]);
  }

  return Markup.inlineKeyboard(buttons);
};

/**
 * Persistent 4-Dot Bottom Reply Keyboard (ReplyKeyboardMarkup)
 * Renders the 4-dots grid icon at the bottom of the Telegram chat bar
 * @param {boolean} isAdmin
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

  const maxQty = Math.min(availableStock, 100);
  for (let q = 10; q <= maxQty; q += 10) {
    currentRow.push(Markup.button.callback(`🟢 ${q} Accounts`, `buy_select_${q}`));
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
 * Order confirmation keyboard
 * @param {number} quantity
 */
const getOrderConfirmationKeyboard = (quantity) => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🟢 ✅ Confirm Purchase', `buy_confirm_${quantity}`)],
    [Markup.button.callback('🔴 ❌ Cancel', 'main_menu')],
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
  getBottomReplyKeyboard,
  getPaymentMethodKeyboard,
  getBuyQuantityKeyboard,
  getOrderConfirmationKeyboard,
  getBackToMenuKeyboard,
};
