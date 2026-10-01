import logging
from typing import Optional, Any
from aiogram import Bot
from bot_python.config import config
from bot_python.utils.formatter import format_paise, format_date_ist

logger = logging.getLogger(__name__)

async def notify_user(bot: Bot, telegram_id: str | int, text: str, reply_markup=None) -> None:
    try:
        await bot.send_message(
            chat_id=int(telegram_id),
            text=text,
            reply_markup=reply_markup,
            parse_mode="Markdown",
        )
    except Exception as e:
        logger.warning(f"Could not notify user {telegram_id}: {e}")

async def notify_admins(bot: Bot, text: str, reply_markup=None) -> None:
    for admin_id in config.admin_ids:
        try:
            await bot.send_message(
                chat_id=int(admin_id),
                text=text,
                reply_markup=reply_markup,
                parse_mode="Markdown",
            )
        except Exception as e:
            logger.warning(f"Could not notify admin {admin_id}: {e}")

async def notify_admins_photo(bot: Bot, photo_file_id: str, caption: str, reply_markup=None) -> None:
    for admin_id in config.admin_ids:
        try:
            await bot.send_photo(
                chat_id=int(admin_id),
                photo=photo_file_id,
                caption=caption,
                reply_markup=reply_markup,
                parse_mode="Markdown",
            )
        except Exception as e:
            logger.warning(f"Could not send photo to admin {admin_id}: {e}")

async def notify_new_user_registration(bot: Bot, user: Any) -> None:
    username_str = f"@{user.username}" if user.username else "N/A"
    name = f"{user.firstName or ''} {user.lastName or ''}".strip() or "User"
    text = (
        f"👤 *NEW USER REGISTERED*\n\n"
        f"Name: {name}\n"
        f"Username: {username_str}\n"
        f"Telegram ID: `{user.telegramId}`\n"
        f"Initial Bonus: {format_paise(config.welcome_bonus_paise)}"
    )
    await notify_admins(bot, text)

async def notify_referral_success(bot: Bot, data: dict) -> None:
    referrer_tid = data.get("referrer_telegram_id")
    reward_paise = data.get("reward_paise")
    new_balance = data.get("new_balance_paise")
    if referrer_tid:
        msg = (
            f"🎉 *REFERRAL REWARD CREDITED!*\n\n"
            f"Your friend joined through your referral link!\n"
            f"💰 Reward Added: {format_paise(reward_paise)}\n"
            f"💵 New Balance: {format_paise(new_balance)}"
        )
        await notify_user(bot, referrer_tid, msg)
