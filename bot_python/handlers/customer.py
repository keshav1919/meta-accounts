import logging
from aiogram import Router, Bot, F
from aiogram.types import Message
from aiogram.filters import Command, CommandStart, CommandObject
from aiogram.fsm.context import FSMContext

from bot_python.config import config
from bot_python.services.user_service import (
    get_or_register_user,
    getUserReferralStats as get_user_referral_stats,
    process_referral_reward,
    get_user_by_telegram_id,
)
from bot_python.services.stock_service import get_available_count
from bot_python.services.purchase_service import get_user_orders
from bot_python.services.wallet_service import get_user_transactions
from bot_python.services.notification_service import notify_new_user_registration
from bot_python.keyboards.customer_kb import (
    get_channel_join_keyboard,
    get_main_menu_keyboard,
    get_buy_quantity_keyboard,
    get_orders_keyboard,
    get_transactions_keyboard,
    get_back_to_menu_keyboard,
)
from bot_python.middleware.channel_middleware import check_user_channel_join
from bot_python.utils.formatter import format_paise, format_date_ist
from bot_python.states import DepositStates

logger = logging.getLogger(__name__)
customer_router = Router()

@customer_router.message(CommandStart())
async def handle_start(message: Message, command: CommandObject, bot: Bot, state: FSMContext):
    await state.clear()
    user_id = message.from_user.id
    payload = command.args

    # Check Channel Membership
    is_joined = await check_user_channel_join(bot, user_id)
    if not is_joined:
        if payload:
            await state.update_data(ref_payload=payload)
        text = (
            f"👋 Hello {message.from_user.first_name}!\n\n"
            "🔒 *Channel Join Required*\n"
            "To use this bot and access the account store, please join our official channel below, then click **Check Membership**."
        )
        return await message.answer(text, reply_markup=get_channel_join_keyboard(), parse_mode="Markdown")

    user, is_new = await get_or_register_user(
        telegram_id=user_id,
        username=message.from_user.username,
        first_name=message.from_user.first_name,
        last_name=message.from_user.last_name,
        start_payload=payload,
    )

    if is_new:
        await notify_new_user_registration(bot, user)
        if user.referredById:
            await process_referral_reward(user.id)

    available_stock = await get_available_count()
    is_admin = config.is_admin(user_id)

    welcome_text = (
        f"⚡ *WELCOME TO META ACCOUNTS STORE*\n\n"
        f"📦 In Stock: {available_stock} Accounts\n"
        f"💰 Price: ₹3.00 / Account\n\n"
        f"💳 Your Balance: {format_paise(user.balancePaise)}\n\n"
        f"{'🎁 ₹3.00 Welcome bonus has been added to your wallet!\n\n' if is_new else ''}"
        "Select an option below to get started:"
    )

    await message.answer(
        welcome_text,
        reply_markup=get_main_menu_keyboard(available_stock=available_stock, is_admin=is_admin),
        parse_mode="Markdown",
    )

@customer_router.message(Command("balance"))
@customer_router.message(Command("wallet"))
async def handle_balance(message: Message, bot: Bot):
    user_id = message.from_user.id
    if not await check_user_channel_join(bot, user_id):
        return await message.answer("🔒 Please join our channel first.", reply_markup=get_channel_join_keyboard())

    user = await get_user_by_telegram_id(user_id)
    if not user:
        return await message.answer("Please send /start first to register.")

    text = (
        f"💰 *YOUR WALLET & FUNDS*\n\n"
        f"Current Balance: {format_paise(user.balancePaise)}\n\n"
        "Need more funds? Click **Add Funds** below to pay via UPI QR code."
    )
    from bot_python.keyboards.customer_kb import get_wallet_keyboard
    await message.answer(text, reply_markup=get_wallet_keyboard(), parse_mode="Markdown")

@customer_router.message(Command("buy"))
async def handle_buy(message: Message, bot: Bot):
    user_id = message.from_user.id
    if not await check_user_channel_join(bot, user_id):
        return await message.answer("🔒 Please join our channel first.", reply_markup=get_channel_join_keyboard())

    user = await get_user_by_telegram_id(user_id)
    if not user:
        return await message.answer("Please send /start first to register.")
    if user.isRestricted:
        return await message.answer("🚫 Your account is currently restricted.")

    available_stock = await get_available_count()
    if available_stock < 10:
        return await message.answer("⚠️ Out of stock! Please check back later or notify admin.", reply_markup=get_back_to_menu_keyboard())

    text = (
        f"🛒 *SELECT PURCHASE QUANTITY*\n\n"
        f"📦 Available Stock: {available_stock} Accounts\n"
        f"💰 Unit Price: ₹3.00 / Account\n"
        f"💳 Your Balance: {format_paise(user.balancePaise)}\n\n"
        f"*(All orders must be multiples of 10)*\n"
        "Choose a quantity preset or enter your custom amount:"
    )
    await message.answer(text, reply_markup=get_buy_quantity_keyboard(available_stock), parse_mode="Markdown")

@customer_router.message(Command("deposit"))
async def handle_deposit(message: Message, bot: Bot, state: FSMContext):
    user_id = message.from_user.id
    if not await check_user_channel_join(bot, user_id):
        return await message.answer("🔒 Please join our channel first.", reply_markup=get_channel_join_keyboard())

    await state.set_state(DepositStates.waiting_for_amount)
    text = (
        "💰 *Add Funds to Wallet*\n\n"
        "Minimum deposit: ₹1.00\n\n"
        "Please enter the amount in ₹ you wish to add (e.g. 50 or 100):"
    )
    await message.answer(text, reply_markup=get_back_to_menu_keyboard(), parse_mode="Markdown")

@customer_router.message(Command("purchases"))
@customer_router.message(Command("orders"))
async def handle_purchases(message: Message, bot: Bot):
    user_id = message.from_user.id
    if not await check_user_channel_join(bot, user_id):
        return await message.answer("🔒 Please join our channel first.", reply_markup=get_channel_join_keyboard())

    user = await get_user_by_telegram_id(user_id)
    if not user:
        return await message.answer("Please send /start first.")

    orders = await get_user_orders(user.id, limit=10)
    if not orders:
        return await message.answer("📋 You have not purchased any accounts yet.", reply_markup=get_orders_keyboard())

    items = []
    for o in orders:
        items.append(
            f"📦 *Order #{o.orderNumber}*\n"
            f"Quantity: {o.quantity} Accounts\n"
            f"Amount: {format_paise(o.totalAmountPaise)}\n"
            f"Status: Delivered\n"
            f"Date: {format_date_ist(o.createdAt)}"
        )
    text = "📋 *My Orders History*\n\n" + "\n\n-------------------------\n\n".join(items)
    await message.answer(text, reply_markup=get_orders_keyboard(), parse_mode="Markdown")

@customer_router.message(Command("transactions"))
async def handle_transactions(message: Message, bot: Bot):
    user_id = message.from_user.id
    if not await check_user_channel_join(bot, user_id):
        return await message.answer("🔒 Please join our channel first.", reply_markup=get_channel_join_keyboard())

    user = await get_user_by_telegram_id(user_id)
    if not user:
        return await message.answer("Please send /start first.")

    txs = await get_user_transactions(user.id, limit=10)
    if not txs:
        return await message.answer("💳 No transactions recorded yet.", reply_markup=get_transactions_keyboard())

    items = []
    for t in txs:
        type_icon = "➕" if t.amountPaise > 0 and t.type in ["DEPOSIT", "WELCOME_BONUS", "REFERRAL_REWARD"] else "➖"
        items.append(
            f"{type_icon} *{t.type}*: {format_paise(t.amountPaise)}\n"
            f"Desc: {t.description}\n"
            f"Balance After: {format_paise(t.balanceAfterPaise)}\n"
            f"Date: {format_date_ist(t.createdAt)}"
        )
    text = "💳 *Wallet Transaction Ledger*\n\n" + "\n\n-------------------------\n\n".join(items)
    await message.answer(text, reply_markup=get_transactions_keyboard(), parse_mode="Markdown")

@customer_router.message(Command("referral"))
async def handle_referral(message: Message, bot: Bot):
    user_id = message.from_user.id
    if not await check_user_channel_join(bot, user_id):
        return await message.answer("🔒 Please join our channel first.", reply_markup=get_channel_join_keyboard())

    user = await get_user_by_telegram_id(user_id)
    if not user:
        return await message.answer("Please send /start first.")

    stats = await get_user_referral_stats(user.id)
    ref_link = f"https://t.me/{config.bot_username}?start={user.referralCode}"

    text = (
        f"👥 *REFER & EARN*\n\n"
        f"Share your referral link with friends. Earn *₹2.00* immediately when they join and verify!\n\n"
        f"🔗 Your Link:\n`{ref_link}`\n\n"
        f"📊 Total Friends Invited: {stats['totalCount']}\n"
        f"💰 Total Referral Earnings: {format_paise(stats['totalEarnedPaise'])}"
    )
    await message.answer(text, reply_markup=get_back_to_menu_keyboard(), parse_mode="Markdown")

@customer_router.message(Command("support"))
@customer_router.message(Command("help"))
async def handle_support(message: Message):
    text = (
        f"📞 *Customer Support & Inquiries*\n\n"
        f"Need help with your account or order?\n"
        f"Contact our official administrator.\n\n"
        f"UPI ID: `{config.payment_upi_id}`\n"
        f"Account Name: {config.payment_name}"
    )
    await message.answer(text, reply_markup=get_back_to_menu_keyboard(), parse_mode="Markdown")

@customer_router.message(Command("stock"))
async def handle_stock(message: Message, bot: Bot):
    if config.is_admin(message.from_user.id):
        from bot_python.handlers.admin import show_admin_stock
        return await show_admin_stock(message)

    available_stock = await get_available_count()
    text = (
        f"📦 *Current Stock Status*\n\n"
        f"Available Accounts: {available_stock}\n"
        f"Price: ₹3.00 / Account\n"
        f"Minimum order: 10 accounts\n\n"
        f"{'🟢 In Stock - Ready for instant delivery!' if available_stock >= 10 else '🔴 Low/No Stock - Please check back soon.'}"
    )
    await message.answer(text, reply_markup=get_back_to_menu_keyboard(), parse_mode="Markdown")
