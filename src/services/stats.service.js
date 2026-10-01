const prisma = require('../database/prisma');

/**
 * Statistics Service - aggregated metrics for admin dashboard
 */

const getAdminStats = async () => {
  const [
    totalUsers,
    activeUsers,
    availableStock,
    totalSold,
    totalOrders,
    revenueAgg,
    pendingPayments,
    successfulReferrals,
    referralRewardsAgg,
    welcomeBonusAgg,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isRestricted: false } }),
    prisma.account.count({ where: { status: 'AVAILABLE' } }),
    prisma.account.count({ where: { status: 'SOLD' } }),
    prisma.order.count({ where: { status: 'DELIVERED' } }),
    prisma.order.aggregate({
      where: { status: 'DELIVERED' },
      _sum: { totalAmountPaise: true },
    }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
    prisma.referral.count({ where: { status: 'COMPLETED' } }),
    prisma.referral.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { rewardPaise: true },
    }),
    prisma.walletTransaction.aggregate({
      where: { type: 'WELCOME_BONUS' },
      _sum: { amountPaise: true },
    }),
  ]);

  return {
    totalUsers,
    activeUsers,
    availableStock,
    totalSold,
    totalOrders,
    totalRevenuePaise: revenueAgg._sum.totalAmountPaise || 0n,
    pendingPayments,
    successfulReferrals,
    referralRewardsPaise: referralRewardsAgg._sum.rewardPaise || 0n,
    welcomeBonusPaise: welcomeBonusAgg._sum.amountPaise || 0n,
  };
};

module.exports = {
  getAdminStats,
};
