const prisma = require('../database/prisma');
const logger = require('../utils/logger');

/**
 * Payment Service - handles deposits, UTR/screenshot proofs, and admin approval workflows
 */

/**
 * Create a new payment request with UTR
 * @param {object} params
 * @param {string} params.userId
 * @param {bigint} params.amountPaise
 * @param {string} params.utr
 */
const createUtrPayment = async ({ userId, amountPaise, utr }) => {
  const cleanUtr = utr.trim().toUpperCase();

  // Check duplicate UTR
  const existing = await prisma.payment.findFirst({
    where: {
      utr: cleanUtr,
      status: { in: ['PENDING', 'APPROVED'] },
    },
  });

  if (existing) {
    return {
      success: false,
      error: 'This UTR has already been submitted for another payment.',
    };
  }

  const payment = await prisma.payment.create({
    data: {
      userId,
      amountPaise,
      utr: cleanUtr,
      status: 'PENDING',
    },
    include: {
      user: true,
    },
  });

  logger.info(`Payment created with UTR: ${cleanUtr} for user ${userId} (${amountPaise} paise)`);

  return {
    success: true,
    payment,
  };
};

/**
 * Create a new payment request with Screenshot
 * @param {object} params
 * @param {string} params.userId
 * @param {bigint} params.amountPaise
 * @param {string} params.screenshotFileId
 */
const createScreenshotPayment = async ({ userId, amountPaise, screenshotFileId }) => {
  const payment = await prisma.payment.create({
    data: {
      userId,
      amountPaise,
      screenshotFileId,
      status: 'PENDING',
    },
    include: {
      user: true,
    },
  });

  logger.info(`Payment created with Screenshot for user ${userId} (${amountPaise} paise)`);

  return {
    success: true,
    payment,
  };
};

/**
 * Approve a pending payment idempotently within a transaction
 * @param {object} params
 * @param {string} params.paymentId
 * @param {string} params.adminTelegramId
 * @param {string} [params.adminNote]
 */
const approvePayment = async ({ paymentId, adminTelegramId, adminNote }) => {
  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch payment with lock
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { user: true },
      });

      if (!payment) {
        return { success: false, error: 'Payment record not found' };
      }

      if (payment.status === 'APPROVED') {
        return { success: false, error: 'Payment already approved.', alreadyProcessed: true };
      }

      if (payment.status === 'REJECTED') {
        return { success: false, error: 'Payment was previously rejected.', alreadyProcessed: true };
      }

      const balanceBefore = payment.user.balancePaise;
      const balanceAfter = balanceBefore + payment.amountPaise;

      // 2. Mark payment approved
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'APPROVED',
          reviewedBy: String(adminTelegramId),
          reviewedAt: new Date(),
          adminNote: adminNote || 'Approved by Admin',
        },
      });

      // 3. Add to user balance
      await tx.user.update({
        where: { id: payment.userId },
        data: { balancePaise: balanceAfter },
      });

      // 4. Create wallet transaction
      const description = payment.utr
        ? `Deposit approved (UTR: ${payment.utr})`
        : 'Deposit approved (Screenshot)';

      await tx.walletTransaction.create({
        data: {
          userId: payment.userId,
          type: 'DEPOSIT',
          amountPaise: payment.amountPaise,
          balanceBeforePaise: balanceBefore,
          balanceAfterPaise: balanceAfter,
          referenceId: payment.id,
          description,
        },
      });

      // 5. Create admin action log
      await tx.adminAction.create({
        data: {
          adminTelegramId: String(adminTelegramId),
          action: 'APPROVE_PAYMENT',
          targetUserId: payment.userId,
          metadata: JSON.stringify({
            paymentId: payment.id,
            amountPaise: payment.amountPaise.toString(),
            utr: payment.utr,
          }),
        },
      });

      logger.info(`Payment ${paymentId} approved by admin ${adminTelegramId} for user ${payment.userId}`);

      return {
        success: true,
        payment: updatedPayment,
        user: payment.user,
        amountPaise: payment.amountPaise,
        balanceBefore,
        balanceAfter,
      };
    });
  } catch (err) {
    logger.error(`Error approving payment ${paymentId}:`, err.message);
    return { success: false, error: 'Failed to approve payment. Please try again.' };
  }
};

/**
 * Reject a pending payment idempotently
 * @param {object} params
 * @param {string} params.paymentId
 * @param {string} params.adminTelegramId
 * @param {string} [params.reason]
 */
const rejectPayment = async ({ paymentId, adminTelegramId, reason }) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true },
    });

    if (!payment) {
      return { success: false, error: 'Payment record not found' };
    }

    if (payment.status !== 'PENDING') {
      return {
        success: false,
        error: `Payment is already marked as ${payment.status}.`,
        alreadyProcessed: true,
      };
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'REJECTED',
        reviewedBy: String(adminTelegramId),
        reviewedAt: new Date(),
        adminNote: reason || 'Payment could not be verified.',
      },
    });

    await prisma.adminAction.create({
      data: {
        adminTelegramId: String(adminTelegramId),
        action: 'REJECT_PAYMENT',
        targetUserId: payment.userId,
        metadata: JSON.stringify({
          paymentId: payment.id,
          reason,
        }),
      },
    });

    logger.info(`Payment ${paymentId} rejected by admin ${adminTelegramId}`);

    return {
      success: true,
      payment: updatedPayment,
      user: payment.user,
      reason: reason || 'Payment could not be verified.',
    };
  } catch (err) {
    logger.error(`Error rejecting payment ${paymentId}:`, err.message);
    return { success: false, error: 'Failed to reject payment.' };
  }
};

/**
 * Get pending payments list
 * @param {number} limit
 */
const getPendingPayments = async (limit = 10) => {
  return prisma.payment.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: true },
  });
};

/**
 * Get payment by ID
 * @param {string} paymentId
 */
const getPaymentById = async (paymentId) => {
  return prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: true },
  });
};

module.exports = {
  createUtrPayment,
  createScreenshotPayment,
  approvePayment,
  rejectPayment,
  getPendingPayments,
  getPaymentById,
};
