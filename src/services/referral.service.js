const crypto = require('crypto');
const prisma = require('../database/prisma');
const config = require('../config');
const logger = require('../utils/logger');
const notificationService = require('./notification.service');

/**
 * Referral Service - handles referral code generation and atomic reward distribution
 */

/**
 * Generate a random unique referral code
 * @param {string} telegramId
 */
const generateReferralCode = (telegramId) => {
  const hash = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `REF${telegramId.slice(-4)}${hash}`;
};

/**
 * Process referral reward when a referred user successfully completes channel verification
 * Ensures idempotency: reward is only given once ever per referred user.
 * @param {string} referredUserId - The newly joined user's DB ID
 */
const processReferralReward = async (referredUserId) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch referred user
      const user = await tx.user.findUnique({
        where: { id: referredUserId },
        include: { referredBy: true },
      });

      if (!user) return null;
      if (!user.referredById || !user.referredBy) return null;
      if (user.referralRewardGiven) return null; // already rewarded

      // Prevent self referral
      if (user.referredById === user.id || user.referredBy.telegramId === user.telegramId) {
        logger.warn(`Self-referral attempted by ${user.telegramId}`);
        return null;
      }

      // Check if a Referral record already exists for this referred user
      const existingRef = await tx.referral.findUnique({
        where: { referredUserId: user.id },
      });

      if (existingRef) {
        return null;
      }

      const rewardPaise = config.referralRewardPaise;
      const referrer = user.referredBy;
      const balanceBefore = referrer.balancePaise;
      const balanceAfter = balanceBefore + rewardPaise;

      // 2. Credit reward to referrer
      await tx.user.update({
        where: { id: referrer.id },
        data: { balancePaise: balanceAfter },
      });

      // 3. Mark referred user as rewarded
      await tx.user.update({
        where: { id: user.id },
        data: { referralRewardGiven: true },
      });

      // 4. Create Referral record
      const referralRecord = await tx.referral.create({
        data: {
          referrerId: referrer.id,
          referredUserId: user.id,
          rewardPaise,
          status: 'COMPLETED',
        },
      });

      // 5. Create WalletTransaction for referrer
      await tx.walletTransaction.create({
        data: {
          userId: referrer.id,
          type: 'REFERRAL_REWARD',
          amountPaise: rewardPaise,
          balanceBeforePaise: balanceBefore,
          balanceAfterPaise: balanceAfter,
          referenceId: referralRecord.id,
          description: `Referral reward for inviting @${user.username || user.telegramId}`,
        },
      });

      logger.info(`Referral reward of ${rewardPaise} credited to ${referrer.telegramId} for inviting ${user.telegramId}`);

      return {
        referrer,
        referredUser: user,
        rewardPaise,
        newBalancePaise: balanceAfter,
      };
    });

    if (result) {
      // Send notifications
      await notificationService.notifyReferralSuccess(result);
    }

    return result;
  } catch (err) {
    logger.error(`Error processing referral reward for user ${referredUserId}:`, err.message);
    return null;
  }
};

/**
 * Get referral statistics for a user
 * @param {string} userId
 */
const getUserReferralStats = async (userId) => {
  const [totalCount, rewardSum] = await Promise.all([
    prisma.user.count({ where: { referredById: userId } }),
    prisma.referral.aggregate({
      where: { referrerId: userId, status: 'COMPLETED' },
      _sum: { rewardPaise: true },
    }),
  ]);

  return {
    totalCount,
    totalEarnedPaise: rewardSum._sum.rewardPaise || 0n,
  };
};

module.exports = {
  generateReferralCode,
  processReferralReward,
  getUserReferralStats,
};
