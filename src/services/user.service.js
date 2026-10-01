const prisma = require('../database/prisma');
const config = require('../config');
const logger = require('../utils/logger');
const { generateReferralCode } = require('./referral.service');
const notificationService = require('./notification.service');

/**
 * User Service - handles customer profiles, registration, and admin user management
 */

/**
 * Get or register user on /start
 * Ensures welcome bonus and notifications are ONLY executed on genuine first registration.
 * @param {object} params
 * @param {number|string} params.telegramId
 * @param {string} [params.username]
 * @param {string} [params.firstName]
 * @param {string} [params.lastName]
 * @param {string} [params.startPayload] - Optional referral code from /start <payload>
 */
const getOrRegisterUser = async ({ telegramId, username, firstName, lastName, startPayload }) => {
  const strTelegramId = String(telegramId);

  // Check if user already exists
  let existingUser = await prisma.user.findUnique({
    where: { telegramId: strTelegramId },
  });

  if (existingUser) {
    // Update profile fields if changed
    if (
      existingUser.username !== username ||
      existingUser.firstName !== firstName ||
      existingUser.lastName !== lastName
    ) {
      existingUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: { username, firstName, lastName },
      });
    }
    return { user: existingUser, isNew: false };
  }

  // Find referrer if payload provided
  let referrer = null;
  if (startPayload && typeof startPayload === 'string') {
    const cleanCode = startPayload.trim();
    const potentialReferrer = await prisma.user.findUnique({
      where: { referralCode: cleanCode },
    });

    // Prevent self referral
    if (potentialReferrer && potentialReferrer.telegramId !== strTelegramId) {
      referrer = potentialReferrer;
    }
  }

  const welcomeBonusPaise = config.welcomeBonusPaise; // 300 paise = ₹3
  const referralCode = generateReferralCode(strTelegramId);

  // Register new user inside transaction
  const newUser = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        telegramId: strTelegramId,
        username,
        firstName,
        lastName,
        referralCode,
        referredById: referrer ? referrer.id : null,
        balancePaise: welcomeBonusPaise,
        welcomeBonusGiven: true,
      },
    });

    // Create initial wallet transaction for welcome bonus
    await tx.walletTransaction.create({
      data: {
        userId: created.id,
        type: 'WELCOME_BONUS',
        amountPaise: welcomeBonusPaise,
        balanceBeforePaise: 0n,
        balanceAfterPaise: welcomeBonusPaise,
        description: 'Welcome Bonus',
      },
    });

    return created;
  });

  logger.info(`New user registered: ${strTelegramId} (@${username || 'none'}), bonus: ${welcomeBonusPaise} paise`);

  // Send admin notification
  await notificationService.notifyNewUserRegistration(newUser);

  return { user: newUser, isNew: true };
};

/**
 * Find user by Telegram ID
 * @param {string|number} telegramId
 */
const getUserByTelegramId = async (telegramId) => {
  return prisma.user.findUnique({
    where: { telegramId: String(telegramId) },
  });
};

/**
 * Find user by DB ID
 * @param {string} id
 */
const getUserById = async (id) => {
  return prisma.user.findUnique({
    where: { id },
  });
};

/**
 * Search users by query (Telegram ID, username, name)
 * @param {string} query
 */
const searchUsers = async (query) => {
  if (!query) return [];
  const clean = query.trim();

  return prisma.user.findMany({
    where: {
      OR: [
        { telegramId: { contains: clean } },
        { username: { contains: clean, mode: 'insensitive' } },
        { firstName: { contains: clean, mode: 'insensitive' } },
        { lastName: { contains: clean, mode: 'insensitive' } },
      ],
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });
};

/**
 * Get comprehensive user profile stats for admin
 * @param {string} userId
 */
const getUserProfileDetails = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      referredBy: {
        select: { telegramId: true, username: true, firstName: true },
      },
    },
  });

  if (!user) return null;

  const [orderCount, purchasedAccountsCount, referralCount] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.account.count({ where: { soldToUserId: userId } }),
    prisma.user.count({ where: { referredById: userId } }),
  ]);

  return {
    user,
    orderCount,
    purchasedAccountsCount,
    referralCount,
  };
};

/**
 * Restrict or unrestrict a user
 * @param {object} params
 * @param {string} params.userId
 * @param {boolean} params.isRestricted
 * @param {string} params.adminTelegramId
 */
const setUserRestriction = async ({ userId, isRestricted, adminTelegramId }) => {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isRestricted },
  });

  await prisma.adminAction.create({
    data: {
      adminTelegramId: String(adminTelegramId),
      action: isRestricted ? 'RESTRICT_USER' : 'UNRESTRICT_USER',
      targetUserId: userId,
    },
  });

  logger.info(`User ${userId} restriction set to ${isRestricted} by admin ${adminTelegramId}`);

  return updated;
};

module.exports = {
  getOrRegisterUser,
  getUserByTelegramId,
  getUserById,
  searchUsers,
  getUserProfileDetails,
  setUserRestriction,
};
