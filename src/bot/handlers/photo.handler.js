const config = require('../../config');
const logger = require('../../utils/logger');
const { formatPaise, formatDateIST } = require('../../utils/formatter');
const { getUserByTelegramId } = require('../../services/user.service');
const { createScreenshotPayment } = require('../../services/payment.service');
const notificationService = require('../../services/notification.service');
const { getPaymentActionKeyboard } = require('../keyboards/admin.keyboards');
const { getMainMenuKeyboard } = require('../keyboards/customer.keyboards');
const { getState, clearState } = require('../state');

/**
 * Handle photo uploads (Customer payment screenshot submissions)
 * Section 11
 */
const handlePhotoUpload = async (ctx) => {
  const telegramId = ctx.from?.id;
  const state = getState(telegramId);

  if (!state || state.state !== 'AWAITING_DEPOSIT_SCREENSHOT') {
    return;
  }

  const photos = ctx.message?.photo;
  if (!photos || photos.length === 0) return;

  const user = await getUserByTelegramId(telegramId);
  if (!user) return ctx.reply('Please send /start first.');

  const amountPaise = state.data.amountPaise;
  // Pick highest resolution photo
  const bestPhoto = photos[photos.length - 1];

  const result = await createScreenshotPayment({
    userId: user.id,
    amountPaise,
    screenshotFileId: bestPhoto.file_id,
  });

  clearState(telegramId);

  if (!result.success) {
    return ctx.reply(`❌ ${result.error}`, getMainMenuKeyboard(config.isAdmin(telegramId)));
  }

  // 1. Acknowledge customer
  await ctx.reply(
    `✅ Payment screenshot submitted!\n\nAmount: ${formatPaise(amountPaise)}\n\nOur team is verifying your payment. Your balance will be credited as soon as it is approved.`,
    getMainMenuKeyboard(config.isAdmin(telegramId))
  );

  // 2. Notify all Admins with the photo and action buttons (Section 11)
  const username = user.username ? `@${user.username}` : user.firstName || 'User';
  const adminCaption = `💳 NEW PAYMENT REQUEST

User:
${username} (ID: ${user.telegramId})

Amount:
${formatPaise(amountPaise)}

Payment Method:
Screenshot

Time:
${formatDateIST(result.payment.createdAt)}`;

  await notificationService.notifyAdminsPhoto(
    bestPhoto.file_id,
    adminCaption,
    getPaymentActionKeyboard(result.payment.id)
  );
};

module.exports = {
  handlePhotoUpload,
};
