const { Telegraf } = require('telegraf');
const config = require('../config');
const logger = require('../utils/logger');
const notificationService = require('../services/notification.service');

// Middlewares
const { requireChannelJoin } = require('./middleware/channel.middleware');
const { requireAdmin } = require('./middleware/auth.middleware');
const { requireNotRestricted } = require('./middleware/restriction.middleware');

// Commands
const customerCommands = require('./commands/customer.commands');
const adminCommands = require('./commands/admin.commands');

// Callbacks
const { registerCustomerCallbacks } = require('./callbacks/customer.callbacks');
const { registerAdminCallbacks } = require('./callbacks/admin.callbacks');

// Handlers
const { handleDocumentUpload } = require('./handlers/document.handler');
const { handlePhotoUpload } = require('./handlers/photo.handler');
const { handleTextMessage } = require('./handlers/text.handler');

const initBot = () => {
  if (!config.botToken) {
    logger.error('CRITICAL: BOT_TOKEN is missing in environment variables');
    throw new Error('BOT_TOKEN is required');
  }

  const bot = new Telegraf(config.botToken);

  // Provide bot instance to notification service
  notificationService.setBotInstance(bot);

  // Global Error Handler (Section 48)
  bot.catch((err, ctx) => {
    logger.error(`Unhandled bot error for update ${ctx?.updateType}:`, err.message);
  });

  // Customer Commands
  bot.command('start', customerCommands.handleStart);
  bot.command('balance', requireChannelJoin, customerCommands.handleBalance);
  bot.command('buy', requireChannelJoin, requireNotRestricted, customerCommands.handleBuy);
  bot.command('deposit', requireChannelJoin, requireNotRestricted, customerCommands.handleDeposit);
  bot.command('purchases', requireChannelJoin, customerCommands.handlePurchases);
  bot.command('transactions', requireChannelJoin, customerCommands.handleTransactions);
  bot.command('referral', requireChannelJoin, customerCommands.handleReferral);
  bot.command('help', customerCommands.handleSupport);
  bot.command('support', customerCommands.handleSupport);

  // Admin Commands (Enforce admin authentication)
  bot.command('admin', requireAdmin, adminCommands.handleAdminMenu);
  bot.command('stock', requireAdmin, adminCommands.handleAdminStock);
  bot.command('payments', requireAdmin, adminCommands.handleAdminPayments);
  bot.command('stats', requireAdmin, adminCommands.handleAdminStats);
  bot.command('orders', requireAdmin, adminCommands.handleAdminOrders);
  bot.command('users', requireAdmin, adminCommands.handleAdminUsers);

  // Register Callbacks
  registerCustomerCallbacks(bot);
  registerAdminCallbacks(bot);

  // Media & Message Handlers
  bot.on('document', handleDocumentUpload);
  bot.on('photo', handlePhotoUpload);
  bot.on('text', handleTextMessage);

  return bot;
};

module.exports = {
  initBot,
};
