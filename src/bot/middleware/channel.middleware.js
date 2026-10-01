const config = require('../../config');
const logger = require('../../utils/logger');
const { cache } = require('../../utils/cache');
const { getChannelJoinKeyboard } = require('../keyboards/customer.keyboards');

/**
 * Check if a Telegram user is a member of the required channel
 * Caches positive verification for 5 minutes to prevent Telegram rate-limiting (429)
 * and provide ultra-fast 0ms response times for active users.
 * 
 * @param {object} ctx - Telegraf context
 * @param {boolean} forceRefresh - If true, bypass cache and re-check with Telegram
 * @returns {Promise<boolean>}
 */
const checkUserChannelJoin = async (ctx, forceRefresh = false) => {
  if (!config.channelId) {
    // If no channel ID configured, bypass check
    return true;
  }

  const userId = ctx.from?.id;
  if (!userId) return false;

  const cacheKey = `channel_member_${userId}`;
  if (!forceRefresh) {
    const cachedStatus = cache.get(cacheKey);
    if (cachedStatus === true) {
      return true;
    }
  }

  try {
    const member = await ctx.telegram.getChatMember(config.channelId, userId);
    const validStatuses = ['member', 'administrator', 'creator'];
    const isJoined = validStatuses.includes(member.status);

    if (isJoined) {
      // Cache verified membership for 5 minutes
      cache.set(cacheKey, true, 5 * 60 * 1000);
    } else {
      cache.delete(cacheKey);
    }

    return isJoined;
  } catch (err) {
    logger.warn(`Channel membership check failed for user ${userId}: ${err.message}`);
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
