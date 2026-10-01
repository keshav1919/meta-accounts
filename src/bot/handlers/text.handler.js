const config = require('../../config');
const logger = require('../../utils/logger');
const { formatPaise, parseRupeesToPaise, formatDateIST } = require('../../utils/formatter');
const { getUserByTelegramId, searchUsers, getUserProfileDetails } = require('../../services/user.service');
const { adminAdjustBalance } = require('../../services/wallet.service');
const { getAvailableCount } = require('../../services/stock.service');
const { getUnitPricePaise } = require('../../services/purchase.service');
const notificationService = require('../../services/notification.service');
const {
  getPaymentMethodKeyboard,
  getMainMenuKeyboard,
  getBackToMenuKeyboard,
  getOrderConfirmationKeyboard,
} = require('../keyboards/customer.keyboards');
const { getPaymentActionKeyboard, getUserActionKeyboard, getBackToAdminKeyboard } = require('../keyboards/admin.keyboards');
const { getState, setState, clearState } = require('../state');

/**
 * Handle incoming text messages for interactive flows
 */
const handleTextMessage = async (ctx) => {
  const telegramId = ctx.from?.id;
  const text = ctx.message?.text?.trim();

  if (!text || text.startsWith('/')) {
    return;
  }

  const userState = getState(telegramId);
  if (!userState) {
    // Normal text without active state
    return;
  }

  const { state, data } = userState;

  // 1. Customer Deposit Amount Input -> directly prompt for screenshot
  if (state === 'AWAITING_DEPOSIT_AMOUNT') {
    const parseRes = parseRupeesToPaise(text);
    if (!parseRes.valid) {
      return ctx.reply(`❌ ${parseRes.error}\n\nPlease enter a valid number (e.g. 50 or 100):`, getBackToMenuKeyboard());
    }

    if (parseRes.paise < config.minDepositPaise) {
      return ctx.reply(
        `❌ Minimum deposit is ${formatPaise(config.minDepositPaise)}. Please enter a larger amount:`,
        getBackToMenuKeyboard()
      );
    }

    // Set state directly to awaiting screenshot proof
    setState(telegramId, 'AWAITING_DEPOSIT_SCREENSHOT', { amountPaise: parseRes.paise });

    const payMsg = `💳 PAYMENT INSTRUCTIONS

Amount: ${formatPaise(parseRes.paise)}

UPI ID:
\`${config.paymentUpiId}\`

Account Name:
${config.paymentName}

📸 Please make the payment and send your payment screenshot image directly in this chat:`;

    return ctx.reply(payMsg, {
      parse_mode: 'Markdown',
      ...getPaymentMethodKeyboard(),
    });
  }

  // 2. Customer Custom Quantity Input (Multiples of 10)
  if (state === 'AWAITING_BUY_CUSTOM_QUANTITY') {
    const q = parseInt(text, 10);
    const availableStock = await getAvailableCount();

    if (isNaN(q) || q < 10 || q % 10 !== 0) {
      return ctx.reply(
        '❌ Quantity must be a positive multiple of 10 (e.g. 10, 20, 50, 100, 250).\nPlease try again:',
        getBackToMenuKeyboard()
      );
    }

    if (q > availableStock) {
      return ctx.reply(
        `❌ Requested quantity (${q}) exceeds available stock (${availableStock}).\nPlease enter a smaller multiple of 10:`,
        getBackToMenuKeyboard()
      );
    }

    clearState(telegramId);

    const user = await getUserByTelegramId(telegramId);
    const unitPrice = await getUnitPricePaise();
    const totalCost = unitPrice * BigInt(q);

    const summaryText = `🛒 ORDER SUMMARY

Quantity: ${q} Accounts
Price per account: ${formatPaise(unitPrice)}
Total Cost: ${formatPaise(totalCost)}

Your Wallet Balance: ${formatPaise(user.balancePaise)}
${user.balancePaise < totalCost ? '\n⚠️ Insufficient balance! Please add funds in your wallet first.' : ''}`;

    return ctx.reply(summaryText, getOrderConfirmationKeyboard(q));
  }

  // 3. Admin Search User
  if (state === 'AWAITING_ADMIN_SEARCH_USER' && config.isAdmin(telegramId)) {
    clearState(telegramId);
    const users = await searchUsers(text);

    if (users.length === 0) {
      return ctx.reply(`🔍 No users found matching "${text}".`, getBackToAdminKeyboard());
    }

    for (const u of users) {
      const details = await getUserProfileDetails(u.id);
      const profileText = `👤 USER

Name: ${[u.firstName, u.lastName].filter(Boolean).join(' ') || 'N/A'}
Username: ${u.username ? `@${u.username}` : 'N/A'}
Telegram ID: ${u.telegramId}

Balance: ${formatPaise(u.balancePaise)}
Total Orders: ${details.orderCount}
Total Purchased: ${details.purchasedAccountsCount}
Referral Count: ${details.referralCount}
Joined: ${formatDateIST(u.createdAt)}
Status: ${u.isRestricted ? '🚫 RESTRICTED' : '🟢 ACTIVE'}`;

      await ctx.reply(profileText, getUserActionKeyboard(u.id, u.isRestricted));
    }

    return;
  }

  // 4. Admin Add Balance
  if (state === 'AWAITING_ADMIN_ADD_BALANCE' && config.isAdmin(telegramId)) {
    const parseRes = parseRupeesToPaise(text);
    if (!parseRes.valid) {
      return ctx.reply('❌ Please enter a valid rupee amount (e.g. 50):');
    }

    const { targetUserId } = data;
    clearState(telegramId);

    try {
      const result = await adminAdjustBalance({
        adminTelegramId: telegramId,
        targetUserId,
        amountPaise: parseRes.paise,
        actionType: 'ADD',
        reason: 'Admin Manual Credit',
      });

      await ctx.reply(
        `✅ Credited ${formatPaise(parseRes.paise)} to user ${result.user.telegramId}.\nNew Balance: ${formatPaise(result.balanceAfter)}`,
        getBackToAdminKeyboard()
      );

      // Notify customer
      await notificationService.notifyUser(
        result.user.telegramId,
        `💰 Admin has credited ${formatPaise(parseRes.paise)} to your wallet.\nNew Balance: ${formatPaise(result.balanceAfter)}`
      );
    } catch (err) {
      ctx.reply(`❌ Adjustment failed: ${err.message}`, getBackToAdminKeyboard());
    }

    return;
  }

  // 5. Admin Deduct Balance
  if (state === 'AWAITING_ADMIN_DED_BALANCE' && config.isAdmin(telegramId)) {
    const parseRes = parseRupeesToPaise(text);
    if (!parseRes.valid) {
      return ctx.reply('❌ Please enter a valid rupee amount (e.g. 20):');
    }

    const { targetUserId } = data;
    clearState(telegramId);

    try {
      const result = await adminAdjustBalance({
        adminTelegramId: telegramId,
        targetUserId,
        amountPaise: parseRes.paise,
        actionType: 'DEDUCT',
        reason: 'Admin Manual Debit',
      });

      await ctx.reply(
        `✅ Deducted ${formatPaise(parseRes.paise)} from user ${result.user.telegramId}.\nNew Balance: ${formatPaise(result.balanceAfter)}`,
        getBackToAdminKeyboard()
      );

      // Notify customer
      await notificationService.notifyUser(
        result.user.telegramId,
        `⚠️ Admin has deducted ${formatPaise(parseRes.paise)} from your wallet.\nNew Balance: ${formatPaise(result.balanceAfter)}`
      );
    } catch (err) {
      ctx.reply(`❌ Adjustment failed: ${err.message}`, getBackToAdminKeyboard());
    }

    return;
  }
};

module.exports = {
  handleTextMessage,
};
