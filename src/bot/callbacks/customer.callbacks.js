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
  getWalletKeyboard,
  getOrdersKeyboard,
  getTransactionsKeyboard,
  getBuyQuantityKeyboard,
  getOrderConfirmationKeyboard,
  getPaymentMethodKeyboard,
  getBackToMenuKeyboard,
} = require('../keyboards/customer.keyboards');
const { getState, setState, clearState } = require('../state');

const registerCustomerCallbacks = (bot) => {
  // Check Channel Join Callback
  bot.action('check_join', async (ctx) => {
    const telegramId = ctx.from.id;
    const isJoined = await checkUserChannelJoin(ctx);

    if (!isJoined && !config.isAdmin(telegramId)) {
      return ctx.answerCbQuery('❌ You have not joined yet. Please join the channel first!', {
        show_alert: true,
      });
    }

    await ctx.answerCbQuery('✅ Membership verified!');

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
    const availableStock = await getAvailableCount();
    const text = `🎉 Welcome to META ACCOUNTS!

📦 In Stock: ${availableStock} Accounts
💰 Price: ₹3.00 / Account
${isNew ? '🎁 ₹3.00 Welcome bonus has been credited to your wallet!\n\n' : ''}Choose an option below:`;

    try {
      await ctx.editMessageText(text, getMainMenuKeyboard({ availableStock, isAdmin }));
    } catch {
      await ctx.reply(text, getMainMenuKeyboard({ availableStock, isAdmin }));
    }
  });

  // Home Route (Main menu navigation)
  bot.action('main_menu', async (ctx) => {
    await ctx.answerCbQuery();
    clearState(ctx.from.id);
    const isAdmin = config.isAdmin(ctx.from.id);
    const availableStock = await getAvailableCount();
    const user = await getUserByTelegramId(ctx.from.id);

    const text = `🏪 META ACCOUNTS STORE

📦 Available Stock: ${availableStock} Accounts
💰 Price: ₹3.00 / Account
💳 Wallet Balance: ${formatPaise(user?.balancePaise || 0n)}

Select a destination below:`;

    try {
      await ctx.editMessageText(text, getMainMenuKeyboard({ availableStock, isAdmin }));
    } catch {
      await ctx.reply(text, getMainMenuKeyboard({ availableStock, isAdmin }));
    }
  });

  // Stock Sub-Route
  bot.action('menu_stock', async (ctx) => {
    await ctx.answerCbQuery();
    const available = await getAvailableCount();
    const unitPrice = await getUnitPricePaise();

    const text = `📦 LIVE STOCK INVENTORY

🟢 Available Accounts: ${available}
💰 Price per Account: ${formatPaise(unitPrice)}
🛒 Minimum Order: 10 Accounts (${formatPaise(unitPrice * 10n)})

⚡ Verified authorized accounts with instant delivery!`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '🛒 Buy Accounts Now', callback_data: 'menu_buy', style: 'success' }],
        [{ text: '🏠 Back to Menu', callback_data: 'main_menu' }],
      ],
    };

    try {
      await ctx.editMessageText(text, { reply_markup: keyboard });
    } catch {
      await ctx.reply(text, { reply_markup: keyboard });
    }
  });

  // Buy Route (/buy)
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
        getMainMenuKeyboard({ availableStock: available, isAdmin: config.isAdmin(ctx.from.id) })
      );
    }

    const text = `🛒 Buy Accounts

📦 Available Stock: ${available} Accounts
💰 Price per account: ${formatPaise(unitPrice)}

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
Total Cost: ${formatPaise(totalCost)}

Your Wallet Balance: ${formatPaise(user.balancePaise)}
${user.balancePaise < totalCost ? '\n⚠️ Insufficient balance! Please add funds in your wallet first.' : ''}`;

    await ctx.editMessageText(text, getOrderConfirmationKeyboard(quantity));
  });

  // Custom Quantity Action
  bot.action('buy_custom_qty', async (ctx) => {
    await ctx.answerCbQuery();
    const available = await getAvailableCount();
    const unitPrice = await getUnitPricePaise();

    setState(ctx.from.id, 'AWAITING_BUY_CUSTOM_QUANTITY', { availableStock: available });

    const text = `✏️ Custom Quantity Purchase

📦 In Stock: ${available} Accounts
💰 Price: ${formatPaise(unitPrice)} / account

Type and send the quantity you want to purchase:
• Must be in multiples of 10 (e.g. 10, 40, 150, 500)
• Maximum available: ${available} Accounts`;

    const cancelKb = {
      inline_keyboard: [
        [{ text: '🏠 Cancel & Back to Menu', callback_data: 'main_menu' }],
      ],
    };

    try {
      await ctx.editMessageText(text, { reply_markup: cancelKb });
    } catch {
      await ctx.reply(text, { reply_markup: cancelKb });
    }
  });

  // Confirm Purchase
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
        getWalletKeyboard()
      );
    }

    // Deliver accounts
    for (const msg of purchaseResult.deliveryMessages) {
      await ctx.reply(msg);
    }

    // Receipt
    const successMsg = `✅ PURCHASE SUCCESSFUL

Quantity: ${quantity} Accounts
Amount Paid: ${formatPaise(purchaseResult.totalAmountPaise)}
Remaining Balance: ${formatPaise(purchaseResult.balanceAfter)}
Order ID: ${purchaseResult.order.orderNumber}

Your accounts have been delivered above!`;

    await ctx.reply(successMsg, getOrdersKeyboard());

    // Notify Admin
    const remainingStock = await getAvailableCount();
    await notificationService.notifyNewOrder({
      order: purchaseResult.order,
      user,
      remainingStock,
    });
  });

  // Wallet Route (/wallet)
  bot.action(['menu_wallet', 'menu_balance'], async (ctx) => {
    await ctx.answerCbQuery();
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user) return ctx.reply('Please send /start first.');

    const summary = await getBalanceSummary(user.id);
    const text = `💰 WALLET & FUNDS

Wallet Balance:
${formatPaise(summary.balancePaise)}

Total Deposited: ${formatPaise(summary.totalDeposited)}
Total Spent: ${formatPaise(summary.totalSpent)}
Referral Earnings: ${formatPaise(summary.referralEarnings)}
Welcome Bonus: ${formatPaise(summary.welcomeBonus)}

Select an option below:`;

    await ctx.editMessageText(text, getWalletKeyboard());
  });

  // Deposit Route (/deposit)
  bot.action('menu_deposit', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user) return ctx.reply('Please send /start first.');
    if (user.isRestricted) return ctx.reply('🚫 Your account is currently restricted.');

    setState(ctx.from.id, 'AWAITING_DEPOSIT_AMOUNT');

    const text = `💰 Add Funds to Wallet

Minimum manual deposit: ₹1.00

Enter the amount in ₹ you wish to add (e.g. 30, 50, or 100):`;

    await ctx.editMessageText(text, getBackToMenuKeyboard());
  });

  // Orders Route (/orders)
  bot.action('menu_purchases', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user) return ctx.reply('Please send /start first.');

    const orders = await getUserOrders(user.id, 10);
    if (orders.length === 0) {
      return ctx.editMessageText('📋 You have not purchased any accounts yet.', getOrdersKeyboard());
    }

    const list = orders
      .map((o) => `📦 Order ${o.orderNumber}\nQuantity: ${o.quantity} Accounts\nAmount: ${formatPaise(o.totalAmountPaise)}\nStatus: Delivered\nDate: ${formatDateIST(o.createdAt)}`)
      .join('\n\n-------------------------\n\n');

    await ctx.editMessageText(`📋 My Orders\n\n${list}`, getOrdersKeyboard());
  });

  // Transactions Route (/transactions)
  bot.action('menu_transactions', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user) return ctx.reply('Please send /start first.');

    const transactions = await getUserTransactions(user.id, 10);
    if (transactions.length === 0) {
      return ctx.editMessageText('💳 No transactions recorded yet.', getTransactionsKeyboard());
    }

    const list = transactions
      .map((t) => {
        const isPositive = ['WELCOME_BONUS', 'DEPOSIT', 'REFERRAL_REWARD', 'REFUND'].includes(t.type);
        const sign = isPositive ? '+' : '-';
        return `${sign} ${formatPaise(t.amountPaise)} (${t.description})\n🕐 ${formatDateIST(t.createdAt)}`;
      })
      .join('\n\n');

    await ctx.editMessageText(`💳 Transactions Ledger\n\n${list}`, getTransactionsKeyboard());
  });

  // Referral Route (/referral)
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

📊 Total Referrals: ${stats.totalCount}
💰 Total Earned: ${formatPaise(stats.totalEarnedPaise)}`;

    await ctx.editMessageText(text, getBackToMenuKeyboard());
  });

  // Support Route (/support)
  bot.action('menu_support', async (ctx) => {
    await ctx.answerCbQuery();
    const text = `📞 Customer Support

Need help with your account or order?
Please contact our official administrator.

UPI ID: ${config.paymentUpiId}
Account Name: ${config.paymentName}`;

    await ctx.editMessageText(text, getBackToMenuKeyboard());
  });
};

module.exports = {
  registerCustomerCallbacks,
};
