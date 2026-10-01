const { Markup } = require('telegraf');

/**
 * Admin Panel Keyboards with Multi-Color Styles
 * - style: 'success' -> Green
 * - style: 'primary' -> Blue
 * - style: 'danger'  -> Red
 */

const getAdminMenuKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      { text: '📦 Stock', callback_data: 'admin_stock', style: 'primary' },
      { text: '➕ Add Stock', callback_data: 'admin_add_stock', style: 'success' },
    ],
    [
      { text: '💳 Pending Payments', callback_data: 'admin_payments', style: 'primary' },
      { text: '👥 Users', callback_data: 'admin_users', style: 'primary' },
    ],
    [
      { text: '📊 Statistics', callback_data: 'admin_stats', style: 'primary' },
      { text: '🛒 Orders', callback_data: 'admin_orders', style: 'primary' },
    ],
    [{ text: '⚙️ Settings', callback_data: 'admin_settings', style: 'primary' }],
    [{ text: '🏠 Return to User Menu', callback_data: 'main_menu' }],
  ]);
};

const getStockMenuKeyboard = () => {
  return Markup.inlineKeyboard([
    [{ text: '➕ Add Stock (TXT)', callback_data: 'admin_add_stock', style: 'success' }],
    [{ text: '🔍 Search Account', callback_data: 'admin_search_account', style: 'primary' }],
    [{ text: '🔙 Admin Menu', callback_data: 'admin_menu' }],
  ]);
};

const getPaymentActionKeyboard = (paymentId) => {
  return Markup.inlineKeyboard([
    [
      { text: '✅ Approve', callback_data: `pay_approve_${paymentId}`, style: 'success' },
      { text: '❌ Reject', callback_data: `pay_reject_${paymentId}`, style: 'danger' },
    ],
  ]);
};

const getUserActionKeyboard = (userId, isRestricted) => {
  return Markup.inlineKeyboard([
    [
      { text: '➕ Add Balance', callback_data: `admin_usr_add_${userId}`, style: 'success' },
      { text: '➖ Deduct Balance', callback_data: `admin_usr_ded_${userId}`, style: 'danger' },
    ],
    [
      {
        text: isRestricted ? '✅ Unrestrict User' : '🚫 Restrict User',
        callback_data: `admin_usr_toggle_${userId}`,
        style: isRestricted ? 'success' : 'danger',
      },
    ],
    [{ text: '🔙 Back to Users', callback_data: 'admin_users' }],
  ]);
};

const getBackToAdminKeyboard = () => {
  return Markup.inlineKeyboard([
    [{ text: '🔙 Back to Admin Menu', callback_data: 'admin_menu' }],
  ]);
};

module.exports = {
  getAdminMenuKeyboard,
  getStockMenuKeyboard,
  getPaymentActionKeyboard,
  getUserActionKeyboard,
  getBackToAdminKeyboard,
};
