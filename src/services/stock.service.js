const prisma = require('../database/prisma');
const { parseStockFile } = require('../utils/parser');
const logger = require('../utils/logger');
const { cache } = require('../utils/cache');

/**
 * Stock Service - manages inventory batches and accounts
 */

/**
 * Import stock from TXT file content
 * @param {object} params
 * @param {string} params.content - Raw TXT content
 * @param {string} params.fileName - Original file name
 * @param {string} params.adminTelegramId - ID of uploading admin
 */
const importStockTxt = async ({ content, fileName, adminTelegramId }) => {
  // 1. Parse and validate file content
  const parseResult = parseStockFile(content);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error,
    };
  }

  const { accounts, batchNumber } = parseResult;

  // 2. Extract emails and check for existing accounts in DB
  const emails = accounts.map((a) => a.email);
  const existingAccounts = await prisma.account.findMany({
    where: {
      email: { in: emails },
    },
    select: { email: true },
  });

  if (existingAccounts.length > 0) {
    const duplicateEmails = existingAccounts.map((a) => a.email);
    return {
      success: false,
      duplicateCount: duplicateEmails.length,
      error: `⚠️ Duplicate account(s) detected in database (${duplicateEmails.length}):\n${duplicateEmails.join('\n')}\n\nNothing was added. Batch was rejected.`,
    };
  }

  // 3. Insert batch and accounts in a single atomic transaction
  return prisma.$transaction(async (tx) => {
    // Determine batch number if not explicitly specified in header
    let finalBatchNumber = batchNumber;
    if (!finalBatchNumber) {
      const highestBatch = await tx.stockBatch.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { batchNumber: true },
      });
      finalBatchNumber = (highestBatch?.batchNumber || 0) + 1;
    }

    const batch = await tx.stockBatch.create({
      data: {
        batchNumber: finalBatchNumber,
        fileName: fileName || `batch_${finalBatchNumber}.txt`,
        totalAccounts: accounts.length,
      },
    });

    // Create 10 accounts
    await tx.account.createMany({
      data: accounts.map((acc) => ({
        batchId: batch.id,
        fullName: acc.fullName,
        email: acc.email,
        password: acc.password,
        createdOn: acc.createdOn,
        status: 'AVAILABLE',
      })),
    });

    // Count available stock
    const availableCount = await tx.account.count({
      where: { status: 'AVAILABLE' },
    });

    // Log admin action
    await tx.adminAction.create({
      data: {
        adminTelegramId: String(adminTelegramId),
        action: 'IMPORT_STOCK',
        metadata: JSON.stringify({
          batchId: batch.id,
          batchNumber: finalBatchNumber,
          count: accounts.length,
        }),
      },
    });

    logger.info(`Stock imported: Batch #${finalBatchNumber} with ${accounts.length} accounts by admin ${adminTelegramId}`);

    // Invalidate stock cache so fresh count is immediately visible
    cache.delete('stock_available_count');

    return {
      success: true,
      batchNumber: finalBatchNumber,
      totalImported: accounts.length,
      newAccounts: accounts.length,
      duplicateCount: 0,
      availableStock: availableCount,
    };
  });
};

/**
 * Get current stock statistics
 */
const getStockStats = async () => {
  const [available, sold, totalImported, batches] = await Promise.all([
    prisma.account.count({ where: { status: 'AVAILABLE' } }),
    prisma.account.count({ where: { status: 'SOLD' } }),
    prisma.account.count(),
    prisma.stockBatch.count(),
  ]);

  return {
    available,
    sold,
    totalImported,
    batches,
  };
};

/**
 * Get available account count with in-memory TTL caching (4 seconds)
 * Keeps response time instant during high concurrency and eliminates database load
 */
const getAvailableCount = async () => {
  const cached = cache.get('stock_available_count');
  if (typeof cached === 'number') {
    return cached;
  }

  const count = await prisma.account.count({ where: { status: 'AVAILABLE' } });
  cache.set('stock_available_count', count, 4000); // 4 seconds TTL
  return count;
};

const invalidateStockCache = () => {
  cache.delete('stock_available_count');
};

/**
 * Search account by email or fullName
 * @param {string} query
 */
const searchAccounts = async (query) => {
  if (!query) return [];
  const clean = query.trim().toLowerCase();
  return prisma.account.findMany({
    where: {
      OR: [
        { email: { contains: clean, mode: 'insensitive' } },
        { fullName: { contains: clean, mode: 'insensitive' } },
      ],
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      batch: true,
      soldToUser: {
        select: { telegramId: true, username: true, firstName: true },
      },
    },
  });
};

module.exports = {
  importStockTxt,
  getStockStats,
  getAvailableCount,
  invalidateStockCache,
  searchAccounts,
};
