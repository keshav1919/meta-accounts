const config = require('../config');
const logger = require('../utils/logger');
const { formatDateIST, formatPaise } = require('../utils/formatter');

let botInstance = null;

const setBotInstance = (bot) => {
  botInstance = bot;
};

const getTelegram = () => {
  if (!botInstance || !botInstance.telegram) {
    throw new Error('Telegram bot instance not initialized in notification service');
  }
  return botInstance.telegram;
};

/**
 * Send notification to all configured admins
 */
const notifyAdmins = async (message, extra = {}) => {
  if (!config.adminIds || config.adminIds.length === 0) {
    logger.warn('No ADMIN_IDS configured to receive notifications');
    return;
  }

  const telegram = getTelegram();
  const promises = config.adminIds.map(async (adminId) => {
    try {
      await telegram.sendMessage(adminId, message, extra);
    } catch (err) {
      logger.error(`Failed to notify admin ${adminId}:`, err.message);
    }
  });

  await Promise.allSettled(promises);
};

/**
 * Send photo with caption to all configured admins
 */
const notifyAdminsPhoto = async (photoFileId, caption, extra = {}) => {
  if (!config.adminIds || config.adminIds.length === 0) return;

  const telegram = getTelegram();
  const promises = config.adminIds.map(async (adminId) => {
    try {
      await telegram.sendPhoto(adminId, photoFileId, {
        caption,
        ...extra,
      });
    } catch (err) {
      logger.error(`Failed to send photo to admin ${adminId}:`, err.message);
    }
  });

  await Promise.allSettled(promises);
};

/**
 * Send notification to a specific user
 */
const notifyUser = async (telegramId, message, extra = {}) => {
  try {
    const telegram = getTelegram();
    await telegram.sendMessage(telegramId, message, extra);
  } catch (err) {
    logger.error(`Failed to notify user ${telegramId}:`, err.message);
  }
};

/**
 * Notify admins of a genuinely new user registration (Section 6, 38)
 */
const notifyNewUserRegistration = async (user) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';
  const username = user.username ? `@${user.username}` : 'None';
  const registeredAt = formatDateIST(user.createdAt);

  const message = `🔔 NEW CUSTOMER

👤 Name: ${name}
🔹 Username: ${username}
🆔 Telegram ID: ${user.telegramId}

🎁 Welcome Bonus: ₹3

🕐 ${registeredAt}`;

  await notifyAdmins(message);
};

/**
 * Notify admins and referrer about successful referral reward (Section 7, 40)
 */
const notifyReferralSuccess = async ({ referrer, referredUser, rewardPaise, newBalancePaise }) => {
  const referredUsername = referredUser.username ? `@${referredUser.username}` : referredUser.firstName || 'User';
  const referrerUsername = referrer.username ? `@${referrer.username}` : referrer.firstName || 'User';

  // Notify referrer
  const userMsg = `🎉 REFERRAL SUCCESSFUL!

You earned ${formatPaise(rewardPaise)}

👤 New referral:
${referredUsername}

💰 Reward added to your balance.

New Balance: ${formatPaise(newBalancePaise)}`;

  await notifyUser(referrer.telegramId, userMsg);

  // Notify admins
  const adminMsg = `👥 REFERRAL SUCCESS

Referrer: ${referrerUsername} (ID: ${referrer.telegramId})
New User: ${referredUsername} (ID: ${referredUser.telegramId})
Reward: ${formatPaise(rewardPaise)}
Referrer Balance: ${formatPaise(newBalancePaise)}
Time: ${formatDateIST(new Date())}`;

  await notifyAdmins(adminMsg);
};

/**
 * Notify admins of a new completed purchase order (Section 39)
 */
const notifyNewOrder = async ({ order, user, remainingStock }) => {
  const username = user.username ? `@${user.username}` : user.firstName || 'User';
  const msg = `🛒 NEW ORDER

Order:
${order.orderNumber}

Customer:
${username} (ID: ${user.telegramId})

Quantity:
${order.quantity}

Amount:
${formatPaise(order.totalAmountPaise)}

Remaining Stock:
${remainingStock}

Time:
${formatDateIST(order.createdAt)}`;

  await notifyAdmins(msg);
};

module.exports = {
  setBotInstance,
  getTelegram,
  notifyAdmins,
  notifyAdminsPhoto,
  notifyUser,
  notifyNewUserRegistration,
  notifyReferralSuccess,
  notifyNewOrder,
};
