const config = require('../../config');
const logger = require('../../utils/logger');
const { importStockTxt } = require('../../services/stock.service');
const { getBackToAdminKeyboard } = require('../keyboards/admin.keyboards');

/**
 * Handle document uploads (Admin TXT stock imports)
 * Section 15, 18, 37, 60
 */
const handleDocumentUpload = async (ctx) => {
  const telegramId = ctx.from?.id;
  const doc = ctx.message?.document;

  if (!doc) return;

  // Only admins can import stock (Section 60)
  if (!config.isAdmin(telegramId)) {
    return;
  }

  const fileName = doc.file_name || 'stock.txt';
  const isTxt = fileName.toLowerCase().endsWith('.txt') || doc.mime_type === 'text/plain';

  if (!isTxt) {
    return ctx.reply('⚠️ Only .txt stock files are accepted for inventory import.', getBackToAdminKeyboard());
  }

  const statusMsg = await ctx.reply('📥 Processing stock...\n🔍 Parsing & Validating...');

  try {
    // 1. Download file content from Telegram API
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    const response = await fetch(fileLink.href);

    if (!response.ok) {
      throw new Error(`Failed to download file from Telegram: ${response.statusText}`);
    }

    const content = await response.text();

    // 2. Import stock with validation
    const result = await importStockTxt({
      content,
      fileName,
      adminTelegramId: telegramId,
    });

    if (!result.success) {
      const errorMsg = `❌ STOCK IMPORT FAILED\n\n${result.error}`;
      return ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, errorMsg, getBackToAdminKeyboard());
    }

    // 3. Success notification
    const successMsg = `✅ STOCK ADDED

Batch:
#${result.batchNumber}

Records:
${result.totalImported}

New Accounts:
${result.newAccounts}

Duplicate:
${result.duplicateCount}

Available Stock:
${result.availableStock}`;

    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, successMsg, getBackToAdminKeyboard());
  } catch (err) {
    logger.error('Error during stock file import:', err.message);
    const failMsg = `❌ IMPORT FAILED\n\nAn unexpected error occurred while processing the file: ${err.message}`;
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, failMsg, getBackToAdminKeyboard());
    } catch {
      await ctx.reply(failMsg, getBackToAdminKeyboard());
    }
  }
};

module.exports = {
  handleDocumentUpload,
};
