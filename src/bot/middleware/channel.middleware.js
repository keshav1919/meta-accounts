const config = require('../../config');
const logger = require('../../utils/logger');
const { getChannelJoinKeyboard } = require('../keyboards/customer.keyboards');

/**
 * Check if a Telegram user is a member of the required channel
 * @param {object} ctx - Telegraf context
 * @returns {Promise<boolean>}
 */
const checkUserChannelJoin = async (ctx) => {
  if (!config.channelId) {
    // If no channel ID configured, bypass check
    return true;
  }

  try {
    const member = await ctx.telegram.getChatMember(config.channelId, ctx.from.id);
    const validStatuses = ['member', 'administrator', 'creator'];
    return validStatuses.includes(member.status);
  } catch (err) {
    logger.warn(`Channel membership check failed for user ${ctx.from.id}: ${err.message}`);
    // If bot isn't admin or cannot check, return false so user is prompted or verify error
    return false;
  }
};

/**
 * Middleware enforcing channel membership for commands and callbacks
 */
const requireChannelJoin = async (ctx, next) => {
  // Allow check_join callback to proceed to its own handler
  if (ctx.callbackQuery && ctx.callbackQuery.data === 'check_join') {
    return next();
  }

  // Admins bypass channel join requirement for testing/maintenance
  if (config.isAdmin(ctx.from?.id)) {
    return next();
  }

  const isJoined = await checkUserChannelJoin(ctx);
  if (isJoined) {
    return next();
  }

  const message = `🔒 Channel Join Required

Please join our official channel before using the bot.`;

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery('Please join our channel first!', { show_alert: true });
    try {
      await ctx.editMessageText(message, getChannelJoinKeyboard());
    } catch {
      await ctx.reply(message, getChannelJoinKeyboard());
    }
  } else {
    await ctx.reply(message, getChannelJoinKeyboard());
  }
};

module.exports = {
  checkUserChannelJoin,
  requireChannelJoin,
};
