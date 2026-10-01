import logging
from typing import Optional
from aiogram import Bot
from bot_python.config import config
from bot_python.utils.cache import cache

logger = logging.getLogger(__name__)

async def check_user_channel_join(bot: Bot, user_id: int, force_refresh: bool = False) -> bool:
    if not config.channel_id:
        return True

    if config.is_admin(user_id):
        return True

    cache_key = f"channel_member_{user_id}"
    if not force_refresh:
        cached_status = cache.get(cache_key)
        if cached_status is True:
            return True

    try:
        member = await bot.get_chat_member(chat_id=config.channel_id, user_id=user_id)
        is_joined = member.status in ["member", "administrator", "creator"]
        if is_joined:
            cache.set(cache_key, True, ttl_seconds=300.0) # 5 minutes
        else:
            cache.delete(cache_key)
        return is_joined
    except Exception as e:
        logger.warning(f"Channel membership check failed for user {user_id}: {e}")
        return False
