const prisma = require('../database/prisma');
const config = require('../config');
const logger = require('../utils/logger');
const { splitDeliveryMessages } = require('../utils/splitter');

/**
 * Purchase Service - atomic stock allocation and order processing
 */

/**
 * Fetch current unit price per account in paise
 */
const getUnitPricePaise = async () => {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'ACCOUNT_PRICE_PAISE' },
  });

  if (setting && setting.value) {
    return BigInt(setting.value);
  }

  return config.accountPricePaise;
};

/**
 * Validate requested quantity (must be multiple of 10)
 * @param {number} quantity
 */
const validateQuantity = (quantity) => {
  const q = parseInt(quantity, 10);
  if (isNaN(q) || q < 10 || q % 10 !== 0) {
    return false;
  }
  return true;
};

/**
 * Execute atomic purchase of accounts
 * @param {object} params
 * @param {string} params.userId - Internal user ID
 * @param {number} params.quantity - Number of accounts to buy (e.g. 10, 20, 30...)
 * @returns {Promise<{
 *   success: boolean,
 *   order?: object,
 *   accounts?: Array<object>,
 *   messages?: Array<string>,
 *   error?: string
 * }>}
 */
const executePurchase = async ({ userId, quantity }) => {
  if (!validateQuantity(quantity)) {
    return {
      success: false,
      error: 'Quantity must be a positive multiple of 10 (e.g. 10, 20, 30).',
    };
  }

  const unitPrice = await getUnitPricePaise();
  const totalAmountPaise = unitPrice * BigInt(quantity);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify user exists and check restrictions
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      if (user.isRestricted) {
        throw new Error('USER_RESTRICTED');
      }

      // 2. Verify sufficient balance
      if (user.balancePaise < totalAmountPaise) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      // 3. Select and lock available accounts using FOR UPDATE SKIP LOCKED
      // Prevents race conditions and duplicate allocations
      const accounts = await tx.$queryRaw`
        SELECT id, "batchId", "fullName", email, password, "createdOn"
        FROM "Account"
        WHERE status = 'AVAILABLE'::"AccountStatus"
        ORDER BY "createdAt" ASC, id ASC
        LIMIT ${quantity}
        FOR UPDATE SKIP LOCKED
      `;

      if (!accounts || accounts.length < quantity) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      const accountIds = accounts.map((a) => a.id);
      const balanceBefore = user.balancePaise;
      const balanceAfter = balanceBefore - totalAmountPaise;

      // 4. Deduct balance from user
      await tx.user.update({
        where: { id: userId },
        data: { balancePaise: balanceAfter },
      });

      // 5. Mark accounts SOLD
      const now = new Date();
      await tx.account.updateMany({
        where: { id: { in: accountIds } },
        data: {
          status: 'SOLD',
          soldToUserId: userId,
          soldAt: now,
        },
      });

      // 6. Generate unique order number: #ORD-XXXXXX
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      const orderNumber = `#ORD-${randomSuffix}`;

      // 7. Create Order record
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          quantity,
          totalAmountPaise,
          status: 'DELIVERED',
        },
      });

      // 8. Create OrderItem records
      await tx.orderItem.createMany({
        data: accountIds.map((accId) => ({
          orderId: order.id,
          accountId: accId,
        })),
      });

      // 9. Create WalletTransaction
      await tx.walletTransaction.create({
        data: {
          userId,
          type: 'PURCHASE',
          amountPaise: totalAmountPaise,
          balanceBeforePaise: balanceBefore,
          balanceAfterPaise: balanceAfter,
          referenceId: order.id,
          description: `Purchased ${quantity} accounts (${orderNumber})`,
        },
      });

      return {
        order,
        accounts,
        balanceAfter,
        unitPrice,
        totalAmountPaise,
      };
    });

    // 10. Prepare delivery message parts for Telegram
    const deliveryMessages = splitDeliveryMessages(result.accounts);

    logger.info(`Order completed: ${result.order.orderNumber} for user ${userId} (${quantity} accounts)`);

    return {
      success: true,
      order: result.order,
      accounts: result.accounts,
      deliveryMessages,
      balanceAfter: result.balanceAfter,
      totalAmountPaise: result.totalAmountPaise,
      unitPrice: result.unitPrice,
    };
  } catch (err) {
    logger.error('Purchase execution error:', err.message);

    if (err.message === 'INSUFFICIENT_BALANCE') {
      return { success: false, error: 'Insufficient wallet balance. Please add funds first.' };
    }
    if (err.message === 'INSUFFICIENT_STOCK') {
      return { success: false, error: 'Sorry, insufficient stock available. Please try a smaller quantity.' };
    }
    if (err.message === 'USER_RESTRICTED') {
      return { success: false, error: 'Your account is currently restricted.' };
    }
    if (err.message === 'USER_NOT_FOUND') {
      return { success: false, error: 'User profile not found.' };
    }

    return { success: false, error: 'An error occurred while processing your order. Please try again.' };
  }
};

/**
 * Get customer orders list
 * @param {string} userId
 * @param {number} limit
 */
const getUserOrders = async (userId, limit = 10) => {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
};

module.exports = {
  getUnitPricePaise,
  validateQuantity,
  executePurchase,
  getUserOrders,
};
