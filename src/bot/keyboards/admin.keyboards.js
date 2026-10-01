const { Markup } = require('telegraf');

/**
 * Admin Panel Keyboards
 */

const getAdminMenuKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📦 Stock', 'admin_stock'),
      Markup.button.callback('➕ Add Stock', 'admin_add_stock'),
    ],
    [
      Markup.button.callback('💳 Pending Payments', 'admin_payments'),
      Markup.button.callback('👥 Users', 'admin_users'),
    ],
    [
      Markup.button.callback('📊 Statistics', 'admin_stats'),
      Markup.button.callback('🛒 Orders', 'admin_orders'),
    ],
    [Markup.button.callback('⚙️ Settings', 'admin_settings')],
    [Markup.button.callback('🔙 Return to User Menu', 'main_menu')],
  ]);
};

const getStockMenuKeyboard = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Add Stock', 'admin_add_stock')],
    [Markup.button.callback('🔍 Search Account', 'admin_search_account')],
    [Markup.button.callback('🔙 Admin Menu', 'admin_menu')],
  ]);
};

const getPaymentActionKeyboard = (paymentId) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Approve', `pay_approve_${paymentId}`),
      Markup.button.callback('❌ Reject', `pay_reject_${paymentId}`),
    ],
  ]);
};

const getUserActionKeyboard = (userId, isRestricted) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('➕ Add Balance', `admin_usr_add_${userId}`),
      Markup.button.callback('➖ Deduct Balance', `admin_usr_ded_${userId}`),
    ],
    [
      Markup.button.callback(
        isRestricted ? '✅ Unrestrict User' : '🚫 Restrict User',
        `admin_usr_toggle_${userId}`
      ),
    ],
    [Markup.button.callback('🔙 Back to Users', 'admin_users')],
  ]);
};

const getBackToAdminKeyboard = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Back to Admin Menu', 'admin_menu')],
  ]);
};

module.exports = {
  getAdminMenuKeyboard,
  getStockMenuKeyboard,
  getPaymentActionKeyboard,
  getUserActionKeyboard,
  getBackToAdminKeyboard,
};
