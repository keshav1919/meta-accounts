const config = require('../../config');
const logger = require('../../utils/logger');
const { formatPaise, parseRupeesToPaise, formatDateIST } = require('../../utils/formatter');
const { getUserByTelegramId, searchUsers, getUserProfileDetails } = require('../../services/user.service');
const { createUtrPayment } = require('../../services/payment.service');
const { adminAdjustBalance } = require('../../services/wallet.service');
const notificationService = require('../../services/notification.service');
const { getPaymentMethodKeyboard, getMainMenuKeyboard, getBackToMenuKeyboard } = require('../keyboards/customer.keyboards');
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

  // 1. Customer Deposit Amount Input
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

    setState(telegramId, 'AWAITING_PAYMENT_PROOF', { amountPaise: parseRes.paise });

    const payMsg = `💳 PAYMENT INSTRUCTIONS

Amount: ${formatPaise(parseRes.paise)}

UPI ID:
\`${config.paymentUpiId}\`

Account Name:
${config.paymentName}

After completing your payment, select how you want to submit proof:`;

    return ctx.reply(payMsg, {
      parse_mode: 'Markdown',
      ...getPaymentMethodKeyboard(),
    });
  }

  // 2. Customer UTR Submission
  if (state === 'AWAITING_DEPOSIT_UTR') {
    const cleanUtr = text.trim();
    if (cleanUtr.length < 6 || cleanUtr.length > 30) {
      return ctx.reply('❌ Please enter a valid 12-digit UPI Reference Number / UTR:');
    }

    const user = await getUserByTelegramId(telegramId);
    if (!user) return ctx.reply('Please send /start first.');

    const amountPaise = data.amountPaise;
    const result = await createUtrPayment({
      userId: user.id,
      amountPaise,
      utr: cleanUtr,
    });

    clearState(telegramId);

    if (!result.success) {
      return ctx.reply(`❌ ${result.error}`, getMainMenuKeyboard(config.isAdmin(telegramId)));
    }

    // Acknowledge customer
    await ctx.reply(
      `✅ Payment request submitted!\n\nUTR: \`${cleanUtr}\`\nAmount: ${formatPaise(amountPaise)}\n\nYour balance will be updated automatically upon admin approval.`,
      {
        parse_mode: 'Markdown',
        ...getMainMenuKeyboard(config.isAdmin(telegramId)),
      }
    );

    // Notify all Admins with Approve/Reject buttons (Section 10)
    const username = user.username ? `@${user.username}` : user.firstName || 'User';
    const adminMsg = `💳 NEW PAYMENT REQUEST

User:
${username} (ID: ${user.telegramId})

Amount:
${formatPaise(amountPaise)}

Payment Method:
UTR

UTR:
\`${cleanUtr}\`

Time:
${formatDateIST(result.payment.createdAt)}`;

    await notificationService.notifyAdmins(adminMsg, {
      parse_mode: 'Markdown',
      ...getPaymentActionKeyboard(result.payment.id),
    });

    return;
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
