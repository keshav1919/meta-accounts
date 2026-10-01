import asyncio
import logging
import sys
from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import BotCommand
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from bot_python.config import config
from bot_python.handlers.customer import customer_router
from bot_python.handlers.callbacks import callbacks_router
from bot_python.handlers.admin import admin_router
from bot_python.handlers.media import media_router
from bot_python.handlers.text import text_router

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

async def setup_bot_commands(bot: Bot):
    commands = [
        BotCommand(command="start", description="🏠 Main Store Menu"),
        BotCommand(command="buy", description="🛒 Buy Accounts (₹3/each)"),
        BotCommand(command="stock", description="📦 Check Available Stock"),
        BotCommand(command="balance", description="💰 Wallet Balance"),
        BotCommand(command="deposit", description="➕ Add Funds"),
        BotCommand(command="purchases", description="📋 My Purchased Orders"),
        BotCommand(command="transactions", description="💳 Transaction Ledger"),
        BotCommand(command="referral", description="👥 Refer & Earn (₹2/friend)"),
        BotCommand(command="support", description="📞 Customer Support"),
    ]
    try:
        await bot.set_my_commands(commands)
    except Exception as e:
        logger.warning(f"Could not set bot commands: {e}")

async def main():
    if not config.bot_token:
        logger.critical("BOT_TOKEN is missing in .env file!")
        sys.exit(1)

    logger.info("Starting META ACCOUNTS BOT (Python Edition)...")

    bot = Bot(
        token=config.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    storage = MemoryStorage()
    dp = Dispatcher(storage=storage)

    # Register routers in priority order
    dp.include_router(admin_router)
    dp.include_router(customer_router)
    dp.include_router(callbacks_router)
    dp.include_router(media_router)
    dp.include_router(text_router)

    await setup_bot_commands(bot)
    logger.info(f"Bot initialized successfully. Running in Polling mode on Supabase DB.")

    try:
        await dp.start_polling(
            bot,
            drop_pending_updates=False,
            allowed_updates=["message", "callback_query"],
        )
    finally:
        await bot.session.close()

if __name__ == "__main__":
    # Windows Selector loop factory for psycopg async compatibility
    if sys.platform == "win32":
        asyncio.run(main(), loop_factory=asyncio.SelectorEventLoop)
    else:
        asyncio.run(main())
