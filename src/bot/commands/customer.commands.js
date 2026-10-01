const { Markup } = require('telegraf');
const config = require('../../config');
const logger = require('../../utils/logger');
const { formatPaise, formatDateIST } = require('../../utils/formatter');
const { getOrRegisterUser, getUserByTelegramId } = require('../../services/user.service');
const { checkUserChannelJoin } = require('../middleware/channel.middleware');
const { processReferralReward, getUserReferralStats } = require('../../services/referral.service');
const { getBalanceSummary, getUserTransactions } = require('../../services/wallet.service');
const { getAvailableCount } = require('../../services/stock.service');
const { getUnitPricePaise, getUserOrders } = require('../../services/purchase.service');
const {
  getChannelJoinKeyboard,
  getMainMenuKeyboard,
  getBottomReplyKeyboard,
  getBuyQuantityKeyboard,
  getBackToMenuKeyboard,
} = require('../keyboards/customer.keyboards');
const { setState, clearState } = require('../state');

/**
 * Handle /start command
 */
const handleStart = async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username || null;
  const firstName = ctx.from.first_name || '';
  const lastName = ctx.from.last_name || '';
  const startPayload = ctx.message?.text?.split(' ')[1] || null;

  // 1. Channel membership check
  const isJoined = await checkUserChannelJoin(ctx);
  if (!isJoined && !config.isAdmin(telegramId)) {
    if (startPayload) {
      setState(telegramId, 'PENDING_JOIN_REF', { payload: startPayload });
    }

    const message = `🔒 Channel Join Required

Please join our official channel before using the bot.`;

    return ctx.reply(message, getChannelJoinKeyboard());
  }

  // 2. Register or get existing user
  const { user, isNew } = await getOrRegisterUser({
    telegramId,
    username,
    firstName,
    lastName,
    startPayload,
  });

  // 3. Process referral reward if new
  if (isNew && user.referredById) {
    await processReferralReward(user.id);
  }

  clearState(telegramId);

  const isAdmin = config.isAdmin(telegramId);
  const availableStock = await getAvailableCount();
  const unitPrice = await getUnitPricePaise();

  // 4. Send persistent 4-dot bottom reply keyboard
  await ctx.reply('⚡ Menu options available below (tap the 4 dots at bottom):', getBottomReplyKeyboard(isAdmin));

  // 5. Send main interactive dashboard with live stock
  const welcomeText = `🏪 META ACCOUNTS STORE

📦 Available Stock: ${availableStock} Accounts
💰 Price: ${formatPaise(unitPrice)} / Account
🎁 Welcome Bonus: ₹3.00

${isNew ? '🎁 ₹3.00 Welcome bonus has been credited to your wallet!\n\n' : ''}👤 Customer: ${firstName || 'User'}
💰 Wallet Balance: ${formatPaise(user.balancePaise)}

Choose an option below:`;

  return ctx.reply(welcomeText, getMainMenuKeyboard({ availableStock, isAdmin }));
};

/**
 * Handle Stock display for customer (/stock)
 */
const handleCustomerStock = async (ctx) => {
  const telegramId = ctx.from.id;
  const availableStock = await getAvailableCount();
  const unitPrice = await getUnitPricePaise();

  const text = `📦 LIVE STOCK INVENTORY

🟢 Available Accounts: ${availableStock}
💰 Unit Price: ${formatPaise(unitPrice)} / account
🛒 Minimum Order: 10 Accounts (${formatPaise(unitPrice * 10n)})

⚡ All accounts are verified and legally authorized.
⚡ Delivered instantly into your Telegram chat upon purchase.`;

  const keyboard = Markup.inlineKeyboard([
    [{ text: '🛒 Buy Accounts Now', callback_data: 'menu_buy', style: 'success' }],
    [{ text: '🏠 Back to Menu', callback_data: 'main_menu' }],
  ]);

  return ctx.reply(text, keyboard);
};

/**
 * Handle /balance command
 */
const handleBalance = async (ctx) => {
  const telegramId = ctx.from.id;
  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return ctx.reply('Please send /start first to register.');
  }

  const summary = await getBalanceSummary(user.id);
  const availableStock = await getAvailableCount();

  const text = `💰 Balance

Wallet Balance:
${formatPaise(summary.balancePaise)}

Total Deposited:
${formatPaise(summary.totalDeposited)}

Total Spent:
${formatPaise(summary.totalSpent)}

Referral Earnings:
${formatPaise(summary.referralEarnings)}

Welcome Bonus:
${formatPaise(summary.welcomeBonus)}`;

  return ctx.reply(text, getMainMenuKeyboard({ availableStock, isAdmin: config.isAdmin(telegramId) }));
};

/**
 * Handle /buy command
 */
const handleBuy = async (ctx) => {
  const telegramId = ctx.from.id;
  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return ctx.reply('Please send /start first to register.');
  }

  if (user.isRestricted) {
    return ctx.reply('🚫 Your account is currently restricted.');
  }

  const availableStock = await getAvailableCount();
  const unitPrice = await getUnitPricePaise();

  if (availableStock < 10) {
    return ctx.reply(
      '❌ Sorry, stock is currently unavailable. Please check back later.',
      getMainMenuKeyboard({ availableStock, isAdmin: config.isAdmin(telegramId) })
    );
  }

  const text = `🛒 Buy Accounts

📦 Available Stock: ${availableStock} Accounts
💰 Price per account: ${formatPaise(unitPrice)}

Select quantity below (multiples of 10):`;

  return ctx.reply(text, getBuyQuantityKeyboard(availableStock));
};

/**
 * Handle /deposit command
 */
const handleDeposit = async (ctx) => {
  const telegramId = ctx.from.id;
  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return ctx.reply('Please send /start first to register.');
  }

  if (user.isRestricted) {
    return ctx.reply('🚫 Your account is currently restricted.');
  }

  setState(telegramId, 'AWAITING_DEPOSIT_AMOUNT');

  const text = `💰 Add Funds

Minimum manual deposit: ₹1.00

Enter the amount in ₹ you wish to add (e.g. 50 or 100):`;

  return ctx.reply(text, getBackToMenuKeyboard());
};

/**
 * Handle /purchases command
 */
const handlePurchases = async (ctx) => {
  const telegramId = ctx.from.id;
  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return ctx.reply('Please send /start first to register.');
  }

  const availableStock = await getAvailableCount();
  const orders = await getUserOrders(user.id, 10);
  if (orders.length === 0) {
    return ctx.reply(
      '📦 You have not purchased any accounts yet.',
      getMainMenuKeyboard({ availableStock, isAdmin: config.isAdmin(telegramId) })
    );
  }

  const list = orders
    .map((o) => {
      return `📦 ORDER ${o.orderNumber}
Quantity: ${o.quantity}
Amount: ${formatPaise(o.totalAmountPaise)}
Status: ${o.status === 'DELIVERED' ? 'Delivered' : o.status}
Date: ${formatDateIST(o.createdAt)}`;
    })
    .join('\n\n-------------------------\n\n');

  return ctx.reply(`📦 My Purchases\n\n${list}`, getMainMenuKeyboard({ availableStock, isAdmin: config.isAdmin(telegramId) }));
};

/**
 * Handle /transactions command
 */
const handleTransactions = async (ctx) => {
  const telegramId = ctx.from.id;
  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return ctx.reply('Please send /start first to register.');
  }

  const availableStock = await getAvailableCount();
  const transactions = await getUserTransactions(user.id, 10);
  if (transactions.length === 0) {
    return ctx.reply(
      '💳 No transactions recorded yet.',
      getMainMenuKeyboard({ availableStock, isAdmin: config.isAdmin(telegramId) })
    );
  }

  const list = transactions
    .map((t) => {
      const isPositive = ['WELCOME_BONUS', 'DEPOSIT', 'REFERRAL_REWARD', 'REFUND'].includes(t.type);
      const sign = isPositive ? '+' : '-';
      return `${sign} ${formatPaise(t.amountPaise)} (${t.description})\n🕐 ${formatDateIST(t.createdAt)}`;
    })
    .join('\n\n');

  return ctx.reply(`💳 Transactions\n\n${list}`, getMainMenuKeyboard({ availableStock, isAdmin: config.isAdmin(telegramId) }));
};

/**
 * Handle /referral command
 */
const handleReferral = async (ctx) => {
  const telegramId = ctx.from.id;
  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return ctx.reply('Please send /start first to register.');
  }

  const availableStock = await getAvailableCount();
  const stats = await getUserReferralStats(user.id);
  const botUser = config.botUsername || ctx.botInfo?.username || 'bot';
  const referralLink = `https://t.me/${botUser}?start=${user.referralCode}`;

  const text = `👥 Refer & Earn

Earn ${formatPaise(config.referralRewardPaise)} for every friend who joins!

🔗 Your Referral Link:
${referralLink}

📊 Your Referrals: ${stats.totalCount}
💰 Total Earned: ${formatPaise(stats.totalEarnedPaise)}`;

  return ctx.reply(text, getMainMenuKeyboard({ availableStock, isAdmin: config.isAdmin(telegramId) }));
};

/**
 * Handle /help and /support command
 */
const handleSupport = async (ctx) => {
  const availableStock = await getAvailableCount();
  const text = `📞 Support & Assistance

Need help with your account or order?
Please contact our official administrator.

UPI ID: ${config.paymentUpiId}
Account Name: ${config.paymentName}`;

  return ctx.reply(text, getMainMenuKeyboard({ availableStock, isAdmin: config.isAdmin(ctx.from?.id) }));
};

module.exports = {
  handleStart,
  handleCustomerStock,
  handleBalance,
  handleBuy,
  handleDeposit,
  handlePurchases,
  handleTransactions,
  handleReferral,
  handleSupport,
};
