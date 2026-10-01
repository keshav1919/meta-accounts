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

const https = require('https');

// Persistent HTTPS keep-alive agent to eliminate repeated TLS handshake latency
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 15000,
  maxSockets: 100,
  maxFreeSockets: 30,
  timeout: 60000,
});

const initBot = () => {
  if (!config.botToken) {
    logger.error('CRITICAL: BOT_TOKEN is missing in environment variables');
    throw new Error('BOT_TOKEN is required');
  }

  const bot = new Telegraf(config.botToken, {
    telegram: {
      agent: httpsAgent,
    },
    handlerTimeout: 90000,
  });

  // Provide bot instance to notification service
  notificationService.setBotInstance(bot);

  // Global Error Handler
  bot.catch((err, ctx) => {
    logger.error(`Unhandled bot error for update ${ctx?.updateType}:`, err.message);
  });

  // Setup Telegram Menu Bar commands (Bottom-left Menu button in Telegram)
  bot.telegram
    .setMyCommands([
      { command: 'start', description: '🏠 Main Store Menu' },
      { command: 'buy', description: '🛒 Buy Accounts (₹3/acc)' },
      { command: 'stock', description: '📦 Check Available Stock' },
      { command: 'balance', description: '💰 Wallet Balance' },
      { command: 'deposit', description: '➕ Add Funds' },
      { command: 'purchases', description: '📋 My Purchased Orders' },
      { command: 'transactions', description: '💳 Transaction Ledger' },
      { command: 'referral', description: '👥 Refer & Earn (₹2/friend)' },
      { command: 'support', description: '📞 Customer Support' },
    ])
    .catch((err) => logger.warn('Could not set bot commands in Telegram:', err.message));

  // Customer Commands
  bot.command('start', customerCommands.handleStart);
  bot.command('balance', requireChannelJoin, customerCommands.handleBalance);
  bot.command('wallet', requireChannelJoin, customerCommands.handleBalance);
  bot.command('buy', requireChannelJoin, requireNotRestricted, customerCommands.handleBuy);
  bot.command('deposit', requireChannelJoin, requireNotRestricted, customerCommands.handleDeposit);
  bot.command('purchases', requireChannelJoin, customerCommands.handlePurchases);
  bot.command('orders', requireChannelJoin, customerCommands.handlePurchases);
  bot.command('transactions', requireChannelJoin, customerCommands.handleTransactions);
  bot.command('referral', requireChannelJoin, customerCommands.handleReferral);
  bot.command('help', customerCommands.handleSupport);
  bot.command('support', customerCommands.handleSupport);

  // Stock command (Shows admin dashboard for admin, customer inventory for customer)
  bot.command('stock', (ctx) => {
    if (config.isAdmin(ctx.from?.id)) {
      return adminCommands.handleAdminStock(ctx);
    }
    return customerCommands.handleCustomerStock(ctx);
  });

  // 4-Dot Bottom Reply Keyboard Handlers
  bot.hears(['🛒 Buy Accounts', '/buy'], requireChannelJoin, requireNotRestricted, customerCommands.handleBuy);
  bot.hears(['💰 Wallet & Funds', '💰 Balance'], requireChannelJoin, customerCommands.handleBalance);
  bot.hears(['📋 My Orders', '📦 My Purchases'], requireChannelJoin, customerCommands.handlePurchases);
  bot.hears(['👥 Refer & Earn'], requireChannelJoin, customerCommands.handleReferral);
  bot.hears(['📞 Support'], customerCommands.handleSupport);
  bot.hears('➕ Add Funds', requireChannelJoin, requireNotRestricted, customerCommands.handleDeposit);
  bot.hears('💳 Transactions', requireChannelJoin, customerCommands.handleTransactions);
  bot.hears('📦 Available Stock', requireChannelJoin, customerCommands.handleCustomerStock);
  bot.hears('🛠 Admin Panel', requireAdmin, adminCommands.handleAdminMenu);

  // Admin Commands (Enforce admin authentication)
  bot.command('admin', requireAdmin, adminCommands.handleAdminMenu);
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
