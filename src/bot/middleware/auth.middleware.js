const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Admin authorization middleware
 */
const requireAdmin = async (ctx, next) => {
  const telegramId = ctx.from?.id;

  if (!config.isAdmin(telegramId)) {
    logger.warn(`Unauthorized admin attempt by user ID: ${telegramId}`);
    if (ctx.callbackQuery) {
      return ctx.answerCbQuery('⛔ Unauthorized access.', { show_alert: true });
    }
    return ctx.reply('⛔ Unauthorized: This area is restricted to administrators.');
  }

  return next();
};

module.exports = {
  requireAdmin,
};
