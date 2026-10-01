const { formatPaise, formatDateIST } = require('../../utils/formatter');
const { getStockStats } = require('../../services/stock.service');
const { getAdminStats } = require('../../services/stats.service');
const { getPendingPayments } = require('../../services/payment.service');
const prisma = require('../../database/prisma');
const {
  getAdminMenuKeyboard,
  getStockMenuKeyboard,
  getPaymentActionKeyboard,
  getBackToAdminKeyboard,
} = require('../keyboards/admin.keyboards');

/**
 * Admin Commands
 */

const handleAdminMenu = async (ctx) => {
  const text = `🛠 ADMIN PANEL

Welcome to the Admin Control Dashboard.
Select an operation below:`;

  return ctx.reply(text, getAdminMenuKeyboard());
};

const handleAdminStock = async (ctx) => {
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

  return ctx.reply(text, getStockMenuKeyboard());
};

const handleAdminPayments = async (ctx) => {
  const pending = await getPendingPayments(5);

  if (pending.length === 0) {
    return ctx.reply(
      '💳 No pending payments awaiting verification.',
      getBackToAdminKeyboard()
    );
  }

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
};

const handleAdminStats = async (ctx) => {
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

  return ctx.reply(text, getBackToAdminKeyboard());
};

const handleAdminOrders = async (ctx) => {
  const orders = await prisma.order.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { telegramId: true, username: true, firstName: true },
      },
    },
  });

  if (orders.length === 0) {
    return ctx.reply('🛒 No orders placed yet.', getBackToAdminKeyboard());
  }

  const list = orders
    .map((o) => {
      const user = o.user.username ? `@${o.user.username}` : o.user.firstName || o.user.telegramId;
      return `📦 Order ${o.orderNumber}
Customer: ${user}
Quantity: ${o.quantity} accounts
Amount: ${formatPaise(o.totalAmountPaise)}
Date: ${formatDateIST(o.createdAt)}`;
    })
    .join('\n\n-------------------------\n\n');

  return ctx.reply(`🛒 RECENT ORDERS\n\n${list}`, getBackToAdminKeyboard());
};

const handleAdminUsers = async (ctx) => {
  const text = `👥 USER MANAGEMENT

To inspect or search a user, send /search <query> or click below to search.`;

  return ctx.reply(text, getBackToAdminKeyboard());
};

module.exports = {
  handleAdminMenu,
  handleAdminStock,
  handleAdminPayments,
  handleAdminStats,
  handleAdminOrders,
  handleAdminUsers,
};
