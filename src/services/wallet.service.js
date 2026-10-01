const prisma = require('../database/prisma');
const logger = require('../utils/logger');

/**
 * Wallet Service - handles all financial calculations in integer paise
 */

/**
 * Get user balance summary for display
 * @param {string} userId
 */
const getBalanceSummary = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balancePaise: true, welcomeBonusGiven: true },
  });

  if (!user) throw new Error('User not found');

  const transactions = await prisma.walletTransaction.findMany({
    where: { userId },
    select: { type: true, amountPaise: true },
  });

  let totalDeposited = 0n;
  let totalSpent = 0n;
  let referralEarnings = 0n;
  let welcomeBonus = 0n;

  for (const tx of transactions) {
    if (tx.type === 'DEPOSIT') {
      totalDeposited += tx.amountPaise;
    } else if (tx.type === 'PURCHASE') {
      totalSpent += tx.amountPaise;
    } else if (tx.type === 'REFERRAL_REWARD') {
      referralEarnings += tx.amountPaise;
    } else if (tx.type === 'WELCOME_BONUS') {
      welcomeBonus += tx.amountPaise;
    }
  }

  return {
    balancePaise: user.balancePaise,
    totalDeposited,
    totalSpent,
    referralEarnings,
    welcomeBonus,
  };
};

/**
 * Get recent transactions for a user
 * @param {string} userId
 * @param {number} limit
 */
const getUserTransactions = async (userId, limit = 10) => {
  return prisma.walletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
};

/**
 * Admin manual balance adjustment (Add or Deduct)
 * @param {object} params
 * @param {string} params.adminTelegramId
 * @param {string} params.targetUserId
 * @param {bigint} params.amountPaise
 * @param {'ADD'|'DEDUCT'} params.actionType
 * @param {string} params.reason
 */
const adminAdjustBalance = async ({ adminTelegramId, targetUserId, amountPaise, actionType, reason }) => {
  if (amountPaise <= 0n) {
    throw new Error('Adjustment amount must be positive');
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) throw new Error('Target user not found');

    const balanceBefore = user.balancePaise;
    let balanceAfter;

    if (actionType === 'ADD') {
      balanceAfter = balanceBefore + amountPaise;
    } else if (actionType === 'DEDUCT') {
      if (balanceBefore < amountPaise) {
        throw new Error(`Insufficient user balance (Available: ${balanceBefore} paise)`);
      }
      balanceAfter = balanceBefore - amountPaise;
    } else {
      throw new Error('Invalid adjustment action type');
    }

    // Update user balance
    const updatedUser = await tx.user.update({
      where: { id: targetUserId },
      data: { balancePaise: balanceAfter },
    });

    // Create wallet transaction
    const walletTx = await tx.walletTransaction.create({
      data: {
        userId: targetUserId,
        type: 'ADMIN_ADJUSTMENT',
        amountPaise,
        balanceBeforePaise: balanceBefore,
        balanceAfterPaise: balanceAfter,
        description: `Admin ${actionType === 'ADD' ? 'Credit' : 'Debit'}: ${reason || 'Manual Adjustment'}`,
      },
    });

    // Create admin action log
    await tx.adminAction.create({
      data: {
        adminTelegramId: String(adminTelegramId),
        action: actionType === 'ADD' ? 'ADD_BALANCE' : 'DEDUCT_BALANCE',
        targetUserId,
        metadata: JSON.stringify({
          amountPaise: amountPaise.toString(),
          reason,
          balanceBefore: balanceBefore.toString(),
          balanceAfter: balanceAfter.toString(),
        }),
      },
    });

    logger.info(`Admin ${adminTelegramId} adjusted balance for user ${targetUserId}: ${actionType} ${amountPaise} paise`);

    return {
      user: updatedUser,
      walletTx,
      balanceBefore,
      balanceAfter,
    };
  });
};

module.exports = {
  getBalanceSummary,
  getUserTransactions,
  adminAdjustBalance,
};
