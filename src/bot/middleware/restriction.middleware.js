const { getUserByTelegramId } = require('../../services/user.service');

/**
 * Middleware ensuring user is not restricted by admin
 */
const requireNotRestricted = async (ctx, next) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return next();

  const user = await getUserByTelegramId(telegramId);
  if (user && user.isRestricted) {
    const msg = '🚫 Your account is currently restricted. Please contact support.';
    if (ctx.callbackQuery) {
      return ctx.answerCbQuery(msg, { show_alert: true });
    }
    return ctx.reply(msg);
  }

  // Attach user to context for downstream handlers
  ctx.dbUser = user;
  return next();
};

module.exports = {
  requireNotRestricted,
};
