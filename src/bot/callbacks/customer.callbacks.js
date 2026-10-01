const config = require('../../config');
const logger = require('../../utils/logger');
const { formatPaise, formatDateIST } = require('../../utils/formatter');
const { checkUserChannelJoin } = require('../middleware/channel.middleware');
const { getOrRegisterUser, getUserByTelegramId } = require('../../services/user.service');
const { processReferralReward, getUserReferralStats } = require('../../services/referral.service');
const { getBalanceSummary, getUserTransactions } = require('../../services/wallet.service');
const { getAvailableCount } = require('../../services/stock.service');
const { getUnitPricePaise, executePurchase, getUserOrders } = require('../../services/purchase.service');
const notificationService = require('../../services/notification.service');
const {
  getMainMenuKeyboard,
  getBuyQuantityKeyboard,
  getOrderConfirmationKeyboard,
  getPaymentMethodKeyboard,
  getBackToMenuKeyboard,
} = require('../keyboards/customer.keyboards');
const { getState, setState, clearState } = require('../state');

const registerCustomerCallbacks = (bot) => {
  // Check Channel Join Callback (Section 4)
  bot.action('check_join', async (ctx) => {
    const telegramId = ctx.from.id;
    const isJoined = await checkUserChannelJoin(ctx);

    if (!isJoined && !config.isAdmin(telegramId)) {
      return ctx.answerCbQuery('❌ You have not joined yet. Please join the channel first!', {
        show_alert: true,
      });
    }

    await ctx.answerCbQuery('✅ Membership verified!');

    // Check if there was a pending referral payload in state
    const pendingState = getState(telegramId);
    const startPayload = pendingState?.state === 'PENDING_JOIN_REF' ? pendingState.data.payload : null;

    const { user, isNew } = await getOrRegisterUser({
      telegramId,
      username: ctx.from.username || null,
      firstName: ctx.from.first_name || '',
      lastName: ctx.from.last_name || '',
      startPayload,
    });

    if (isNew && user.referredById) {
      await processReferralReward(user.id);
    }

    clearState(telegramId);

    const isAdmin = config.isAdmin(telegramId);
    const text = `🎉 Welcome to META ACCOUNTS!

Your account is verified and ready.
${isNew ? '🎁 ₹3.00 Welcome bonus has been credited to your wallet!\n\n' : ''}Choose an option below:`;

    try {
      await ctx.editMessageText(text, getMainMenuKeyboard(isAdmin));
    } catch {
      await ctx.reply(text, getMainMenuKeyboard(isAdmin));
    }
  });

  // Main menu navigation
  bot.action('main_menu', async (ctx) => {
    await ctx.answerCbQuery();
    clearState(ctx.from.id);
    const isAdmin = config.isAdmin(ctx.from.id);
    const text = '🏠 Main Menu\n\nPlease select an option below:';
    try {
      await ctx.editMessageText(text, getMainMenuKeyboard(isAdmin));
    } catch {
      await ctx.reply(text, getMainMenuKeyboard(isAdmin));
    }
  });

  // Buy Accounts menu
  bot.action('menu_buy', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user) return ctx.reply('Please send /start first.');
    if (user.isRestricted) return ctx.reply('🚫 Your account is currently restricted.');

    const available = await getAvailableCount();
    const unitPrice = await getUnitPricePaise();

    if (available < 10) {
      return ctx.editMessageText(
        '❌ Sorry, stock is currently unavailable. Please check back later.',
        getMainMenuKeyboard(config.isAdmin(ctx.from.id))
      );
    }

    const text = `🛒 Buy Accounts

Available Stock:
${available} Accounts

Price per account: ${formatPaise(unitPrice)}

Select quantity (multiples of 10):`;

    await ctx.editMessageText(text, getBuyQuantityKeyboard(available));
  });

  // Select Quantity -> Order Summary
  bot.action(/^buy_select_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const quantity = parseInt(ctx.match[1], 10);
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user) return ctx.reply('Please send /start first.');
    if (user.isRestricted) return ctx.reply('🚫 Your account is currently restricted.');

    const unitPrice = await getUnitPricePaise();
    const totalCost = unitPrice * BigInt(quantity);

    const text = `🛒 ORDER SUMMARY

Quantity: ${quantity} Accounts

Price per account: ${formatPaise(unitPrice)}

Total: ${formatPaise(totalCost)}

Your Wallet Balance: ${formatPaise(user.balancePaise)}
${user.balancePaise < totalCost ? '\n⚠️ Insufficient balance! Please add funds before confirming.' : ''}`;

    await ctx.editMessageText(text, getOrderConfirmationKeyboard(quantity));
  });

  // Confirm Purchase (Atomic execution)
  bot.action(/^buy_confirm_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('Processing order...');
    const quantity = parseInt(ctx.match[1], 10);
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user) return ctx.reply('Please send /start first.');

    const purchaseResult = await executePurchase({
      userId: user.id,
      quantity,
    });

    if (!purchaseResult.success) {
      return ctx.editMessageText(
        `❌ ${purchaseResult.error}`,
        getMainMenuKeyboard(config.isAdmin(ctx.from.id))
      );
    }

    // 1. Deliver account credentials directly as Telegram text messages (Section 27, 28, 59)
    for (const msg of purchaseResult.deliveryMessages) {
      await ctx.reply(msg);
    }

    // 2. Send purchase success receipt (Section 29)
    const successMsg = `✅ PURCHASE SUCCESSFUL

Quantity:
${quantity} Accounts

Amount Paid:
${formatPaise(purchaseResult.totalAmountPaise)}

Remaining Balance:
${formatPaise(purchaseResult.balanceAfter)}

Order ID:
${purchaseResult.order.orderNumber}

Your account data has been delivered above.`;

    await ctx.reply(successMsg, getMainMenuKeyboard(config.isAdmin(ctx.from.id)));

    // 3. Notify Admin of new order (Section 39)
    const remainingStock = await getAvailableCount();
    await notificationService.notifyNewOrder({
      order: purchaseResult.order,
      user,
      remainingStock,
    });
  });

  // Balance
  bot.action('menu_balance', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user) return ctx.reply('Please send /start first.');

    const summary = await getBalanceSummary(user.id);
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

    await ctx.editMessageText(text, getMainMenuKeyboard(config.isAdmin(ctx.from.id)));
  });

  // Deposit Funds
  bot.action('menu_deposit', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user) return ctx.reply('Please send /start first.');
    if (user.isRestricted) return ctx.reply('🚫 Your account is currently restricted.');

    setState(ctx.from.id, 'AWAITING_DEPOSIT_AMOUNT');

    const text = `💰 Add Funds

Minimum manual deposit: ₹1.00

Enter the amount in ₹ you wish to add (e.g. 50 or 100):`;

    await ctx.editMessageText(text, getBackToMenuKeyboard());
  });



  // Purchases list
  bot.action('menu_purchases', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user) return ctx.reply('Please send /start first.');

    const orders = await getUserOrders(user.id, 10);
    if (orders.length === 0) {
      return ctx.editMessageText('📦 You have not purchased any accounts yet.', getMainMenuKeyboard(config.isAdmin(ctx.from.id)));
    }

    const list = orders
      .map((o) => `📦 ORDER ${o.orderNumber}\nQuantity: ${o.quantity}\nAmount: ${formatPaise(o.totalAmountPaise)}\nStatus: Delivered\nDate: ${formatDateIST(o.createdAt)}`)
      .join('\n\n-------------------------\n\n');

    await ctx.editMessageText(`📦 My Purchases\n\n${list}`, getMainMenuKeyboard(config.isAdmin(ctx.from.id)));
  });

  // Transactions list
  bot.action('menu_transactions', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user) return ctx.reply('Please send /start first.');

    const transactions = await getUserTransactions(user.id, 10);
    if (transactions.length === 0) {
      return ctx.editMessageText('💳 No transactions recorded yet.', getMainMenuKeyboard(config.isAdmin(ctx.from.id)));
    }

    const list = transactions
      .map((t) => {
        const isPositive = ['WELCOME_BONUS', 'DEPOSIT', 'REFERRAL_REWARD', 'REFUND'].includes(t.type);
        const sign = isPositive ? '+' : '-';
        return `${sign} ${formatPaise(t.amountPaise)} (${t.description})\n🕐 ${formatDateIST(t.createdAt)}`;
      })
      .join('\n\n');

    await ctx.editMessageText(`💳 Transactions\n\n${list}`, getMainMenuKeyboard(config.isAdmin(ctx.from.id)));
  });

  // Referral link & stats
  bot.action('menu_referral', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user) return ctx.reply('Please send /start first.');

    const stats = await getUserReferralStats(user.id);
    const botUser = config.botUsername || ctx.botInfo?.username || 'bot';
    const referralLink = `https://t.me/${botUser}?start=${user.referralCode}`;

    const text = `👥 Refer & Earn

Earn ${formatPaise(config.referralRewardPaise)} for every friend who joins!

🔗 Your Referral Link:
${referralLink}

📊 Your Referrals: ${stats.totalCount}
💰 Total Earned: ${formatPaise(stats.totalEarnedPaise)}`;

    await ctx.editMessageText(text, getMainMenuKeyboard(config.isAdmin(ctx.from.id)));
  });

  // Support
  bot.action('menu_support', async (ctx) => {
    await ctx.answerCbQuery();
    const text = `📞 Support & Assistance

Need help with your account or order?
Please contact our official administrator.

UPI ID: ${config.paymentUpiId}
Account Name: ${config.paymentName}`;

    await ctx.editMessageText(text, getMainMenuKeyboard(config.isAdmin(ctx.from.id)));
  });
};

module.exports = {
  registerCustomerCallbacks,
};
