const config = require('../../config');
const logger = require('../../utils/logger');
const { formatPaise, formatDateIST } = require('../../utils/formatter');
const { getStockStats } = require('../../services/stock.service');
const { getAdminStats } = require('../../services/stats.service');
const { getPendingPayments, approvePayment, rejectPayment } = require('../../services/payment.service');
const { getUserProfileDetails, setUserRestriction } = require('../../services/user.service');
const notificationService = require('../../services/notification.service');
const {
  getAdminMenuKeyboard,
  getStockMenuKeyboard,
  getPaymentActionKeyboard,
  getUserActionKeyboard,
  getBackToAdminKeyboard,
} = require('../keyboards/admin.keyboards');
const { setState, clearState } = require('../state');

const registerAdminCallbacks = (bot) => {
  // Admin Authorization check helper
  const checkAdminAuth = async (ctx) => {
    if (!config.isAdmin(ctx.from?.id)) {
      await ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
      return false;
    }
    return true;
  };

  // Admin main menu
  bot.action('admin_menu', async (ctx) => {
    if (!(await checkAdminAuth(ctx))) return;
    await ctx.answerCbQuery();
    clearState(ctx.from.id);

    const text = `🛠 ADMIN PANEL

Welcome to the Admin Control Dashboard.
Select an operation below:`;

    try {
      await ctx.editMessageText(text, getAdminMenuKeyboard());
    } catch {
      await ctx.reply(text, getAdminMenuKeyboard());
    }
  });

  // Stock overview
  bot.action('admin_stock', async (ctx) => {
    if (!(await checkAdminAuth(ctx))) return;
    await ctx.answerCbQuery();

    const stats = await getStockStats();
    const text = `📦 STOCK

Available:
${stats.available}

Sold:
${stats.sold}

Total Imported:
${stats.totalImported}

Batches:
${stats.batches}`;

    await ctx.editMessageText(text, getStockMenuKeyboard());
  });

  // Add stock instructions
  bot.action('admin_add_stock', async (ctx) => {
    if (!(await checkAdminAuth(ctx))) return;
    await ctx.answerCbQuery();

    const text = `➕ IMPORT STOCK VIA TXT

To import new accounts:
Simply attach or forward a .txt file directly to this bot chat.

Format Requirements:
• Exactly 10 accounts per file
• Each account must contain:
  full name - <name>
  email - <email>
  password - <password>
  created on (<timestamp>)

The bot will automatically parse, validate, and store accounts into PostgreSQL.`;

    await ctx.editMessageText(text, getBackToAdminKeyboard());
  });

  // Pending Payments list
  bot.action('admin_payments', async (ctx) => {
    if (!(await checkAdminAuth(ctx))) return;
    await ctx.answerCbQuery();

    const pending = await getPendingPayments(5);
    if (pending.length === 0) {
      return ctx.editMessageText('💳 No pending payments awaiting verification.', getBackToAdminKeyboard());
    }

    await ctx.editMessageText(`Found ${pending.length} pending payment(s). Details below:`);

    for (const pay of pending) {
      const username = pay.user.username ? `@${pay.user.username}` : pay.user.firstName || 'User';
      const msg = `💳 PENDING PAYMENT REQUEST

Payment ID: ${pay.id}
User: ${username} (ID: ${pay.user.telegramId})
Amount: ${formatPaise(pay.amountPaise)}
Method: ${pay.utr ? `UTR (${pay.utr})` : 'Screenshot'}
Time: ${formatDateIST(pay.createdAt)}`;

      if (pay.screenshotFileId) {
        await ctx.replyWithPhoto(pay.screenshotFileId, {
          caption: msg,
          ...getPaymentActionKeyboard(pay.id),
        });
      } else {
        await ctx.reply(msg, getPaymentActionKeyboard(pay.id));
      }
    }
  });

  // Payment Approval Callback (Section 12, 50)
  bot.action(/^pay_approve_([a-zA-Z0-9_-]+)$/, async (ctx) => {
    if (!(await checkAdminAuth(ctx))) return;
    const paymentId = ctx.match[1];

    const result = await approvePayment({
      paymentId,
      adminTelegramId: ctx.from.id,
      adminNote: `Approved by @${ctx.from.username || ctx.from.id}`,
    });

    if (!result.success) {
      return ctx.answerCbQuery(`❌ ${result.error}`, { show_alert: true });
    }

    await ctx.answerCbQuery('✅ Payment approved successfully!');

    // Update admin UI
    const updatedAdminMsg = `✅ PAYMENT APPROVED

Amount: ${formatPaise(result.amountPaise)}
User: @${result.user.username || result.user.telegramId}
New User Balance: ${formatPaise(result.balanceAfter)}
Approved by: @${ctx.from.username || ctx.from.id}
Time: ${formatDateIST(new Date())}`;

    try {
      if (ctx.callbackQuery.message.photo) {
        await ctx.editMessageCaption(updatedAdminMsg);
      } else {
        await ctx.editMessageText(updatedAdminMsg);
      }
    } catch (err) {
      logger.warn('Could not update admin payment message:', err.message);
    }

    // Notify Customer (Section 12)
    const customerMsg = `✅ PAYMENT APPROVED

${formatPaise(result.amountPaise)} has been added to your wallet.

💰 New Balance:
${formatPaise(result.balanceAfter)}`;

    await notificationService.notifyUser(result.user.telegramId, customerMsg);
  });

  // Payment Rejection Callback (Section 13)
  bot.action(/^pay_reject_([a-zA-Z0-9_-]+)$/, async (ctx) => {
    if (!(await checkAdminAuth(ctx))) return;
    const paymentId = ctx.match[1];

    const result = await rejectPayment({
      paymentId,
      adminTelegramId: ctx.from.id,
      reason: 'Payment could not be verified.',
    });

    if (!result.success) {
      return ctx.answerCbQuery(`❌ ${result.error}`, { show_alert: true });
    }

    await ctx.answerCbQuery('❌ Payment rejected.');

    const updatedAdminMsg = `❌ PAYMENT REJECTED

Amount: ${formatPaise(result.payment.amountPaise)}
User: @${result.user.username || result.user.telegramId}
Status: REJECTED
Rejected by: @${ctx.from.username || ctx.from.id}
Time: ${formatDateIST(new Date())}`;

    try {
      if (ctx.callbackQuery.message.photo) {
        await ctx.editMessageCaption(updatedAdminMsg);
      } else {
        await ctx.editMessageText(updatedAdminMsg);
      }
    } catch (err) {
      logger.warn('Could not update admin rejection message:', err.message);
    }

    // Notify Customer (Section 13)
    const customerMsg = `❌ PAYMENT REJECTED

Amount: ${formatPaise(result.payment.amountPaise)}

Reason:
${result.reason}`;

    await notificationService.notifyUser(result.user.telegramId, customerMsg);
  });

  // Statistics
  bot.action('admin_stats', async (ctx) => {
    if (!(await checkAdminAuth(ctx))) return;
    await ctx.answerCbQuery();

    const stats = await getAdminStats();
    const text = `📊 BUSINESS STATISTICS

👥 Total Users: ${stats.totalUsers}
🟢 Active Users: ${stats.activeUsers}

📦 Available Stock: ${stats.availableStock}
📦 Total Sold: ${stats.totalSold}

🛒 Total Orders: ${stats.totalOrders}
💰 Total Revenue: ${formatPaise(stats.totalRevenuePaise)}

💳 Pending Payments: ${stats.pendingPayments}

👥 Successful Referrals: ${stats.successfulReferrals}
💸 Referral Rewards: ${formatPaise(stats.referralRewardsPaise)}
🎁 Welcome Bonuses: ${formatPaise(stats.welcomeBonusPaise)}`;

    await ctx.editMessageText(text, getBackToAdminKeyboard());
  });

  // Users overview / search prompt
  bot.action('admin_users', async (ctx) => {
    if (!(await checkAdminAuth(ctx))) return;
    await ctx.answerCbQuery();

    setState(ctx.from.id, 'AWAITING_ADMIN_SEARCH_USER');

    const text = `👥 USER MANAGEMENT

Please type the Telegram ID, username, or name to search:`;

    await ctx.editMessageText(text, getBackToAdminKeyboard());
  });

  // User Actions: Add balance prompt
  bot.action(/^admin_usr_add_([a-zA-Z0-9_-]+)$/, async (ctx) => {
    if (!(await checkAdminAuth(ctx))) return;
    await ctx.answerCbQuery();
    const userId = ctx.match[1];

    setState(ctx.from.id, 'AWAITING_ADMIN_ADD_BALANCE', { targetUserId: userId });

    const text = '➕ Enter amount in ₹ to ADD to user balance (e.g. 50):';
    await ctx.reply(text, getBackToAdminKeyboard());
  });

  // User Actions: Deduct balance prompt
  bot.action(/^admin_usr_ded_([a-zA-Z0-9_-]+)$/, async (ctx) => {
    if (!(await checkAdminAuth(ctx))) return;
    await ctx.answerCbQuery();
    const userId = ctx.match[1];

    setState(ctx.from.id, 'AWAITING_ADMIN_DED_BALANCE', { targetUserId: userId });

    const text = '➖ Enter amount in ₹ to DEDUCT from user balance (e.g. 20):';
    await ctx.reply(text, getBackToAdminKeyboard());
  });

  // User Actions: Toggle restriction
  bot.action(/^admin_usr_toggle_([a-zA-Z0-9_-]+)$/, async (ctx) => {
    if (!(await checkAdminAuth(ctx))) return;
    const userId = ctx.match[1];

    const profile = await getUserProfileDetails(userId);
    if (!profile) return ctx.answerCbQuery('User not found.');

    const newRestriction = !profile.user.isRestricted;
    await setUserRestriction({
      userId,
      isRestricted: newRestriction,
      adminTelegramId: ctx.from.id,
    });

    await ctx.answerCbQuery(newRestriction ? 'User restricted.' : 'User unrestricted.');

    // Notify user
    const notice = newRestriction
      ? '🚫 Your account has been restricted by an administrator.'
      : '✅ Your account restriction has been lifted.';
    await notificationService.notifyUser(profile.user.telegramId, notice);

    const updatedProfile = await getUserProfileDetails(userId);
    const u = updatedProfile.user;
    const text = `👤 USER PROFILE

Name: ${[u.firstName, u.lastName].filter(Boolean).join(' ') || 'N/A'}
Username: ${u.username ? `@${u.username}` : 'N/A'}
Telegram ID: ${u.telegramId}

Balance: ${formatPaise(u.balancePaise)}
Total Orders: ${updatedProfile.orderCount}
Total Purchased: ${updatedProfile.purchasedAccountsCount}
Referral Count: ${updatedProfile.referralCount}
Joined: ${formatDateIST(u.createdAt)}
Status: ${u.isRestricted ? '🚫 RESTRICTED' : '🟢 ACTIVE'}`;

    await ctx.editMessageText(text, getUserActionKeyboard(u.id, u.isRestricted));
  });
};

module.exports = {
  registerAdminCallbacks,
};
