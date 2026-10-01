import logging
from aiogram import Router, Bot, F
from aiogram.types import Message, BufferedInputFile
from aiogram.fsm.context import FSMContext

from bot_python.config import config
from bot_python.utils.formatter import parse_rupees_to_paise, format_paise, format_date_ist
from bot_python.utils.qrcode_gen import generate_upi_qr_bytes
from bot_python.services.stock_service import get_available_count
from bot_python.services.user_service import (
    get_user_by_telegram_id,
    search_users,
    get_user_profile_details,
)
from bot_python.services.purchase_service import get_unit_price_paise
from bot_python.services.wallet_service import admin_adjust_balance
from bot_python.services.notification_service import notify_user
from bot_python.keyboards.customer_kb import (
    get_order_confirmation_keyboard,
    get_back_to_menu_keyboard,
    get_payment_method_keyboard,
)
from bot_python.keyboards.admin_kb import (
    get_user_action_keyboard,
    get_back_to_admin_keyboard,
)
from bot_python.states import DepositStates, BuyStates, AdminStates

logger = logging.getLogger(__name__)
text_router = Router()

# Customer Deposit Amount Input
@text_router.message(DepositStates.waiting_for_amount)
async def handle_deposit_amount(message: Message, state: FSMContext):
    text = message.text.strip() if message.text else ""
    parsed = parse_rupees_to_paise(text)

    if not parsed["valid"]:
        return await message.answer(f"❌ {parsed['error']}\n\nPlease enter a valid number (e.g. 50 or 100):", reply_markup=get_back_to_menu_keyboard())

    paise = parsed["paise"]
    if paise < config.min_deposit_paise:
        min_fmt = format_paise(config.min_deposit_paise)
        return await message.answer(f"❌ Minimum deposit is {min_fmt}. Please enter a larger amount:", reply_markup=get_back_to_menu_keyboard())

    # Switch to waiting for screenshot with stored amount
    await state.set_state(DepositStates.waiting_for_screenshot)
    await state.update_data(amount_paise=paise)

    caption = (
        f"💳 *UPI PAYMENT QR CODE*\n\n"
        f"Amount: {format_paise(paise)}\n\n"
        f"UPI ID:\n`{config.payment_upi_id}`\n\n"
        f"Account Name:\n{config.payment_name}\n\n"
        "📲 *Scan this QR code* with PhonePe, GPay, Paytm, or any UPI app to pay.\n\n"
        "📸 After completing payment, *send your payment screenshot image directly in this chat:*"
    )

    try:
        qr_bytes = generate_upi_qr_bytes(
            upi_id=config.payment_upi_id,
            name=config.payment_name,
            amount_paise=paise,
        )
        photo_file = BufferedInputFile(qr_bytes, filename="upi_qr.png")
        await message.answer_photo(
            photo=photo_file,
            caption=caption,
            reply_markup=get_payment_method_keyboard(),
            parse_mode="Markdown",
        )
    except Exception as e:
        logger.error(f"Failed to generate UPI QR code: {e}")
        await message.answer(caption, reply_markup=get_payment_method_keyboard(), parse_mode="Markdown")

# Customer Custom Quantity Input (Multiples of 10)
@text_router.message(BuyStates.waiting_for_custom_quantity)
async def handle_custom_quantity(message: Message, state: FSMContext):
    text = message.text.strip() if message.text else ""
    try:
        quantity = int(text)
    except ValueError:
        return await message.answer(
            "❌ Quantity must be a positive multiple of 10 (e.g. 10, 20, 50, 100).\nPlease try again:",
            reply_markup=get_back_to_menu_keyboard(),
        )

    if quantity < 10 or quantity % 10 != 0:
        return await message.answer(
            "❌ Quantity must be a positive multiple of 10 (e.g. 10, 20, 50, 100).\nPlease try again:",
            reply_markup=get_back_to_menu_keyboard(),
        )

    available_stock = await get_available_count()
    if quantity > available_stock:
        return await message.answer(
            f"❌ Requested quantity ({quantity}) exceeds available stock ({available_stock}).\nPlease enter a smaller multiple of 10:",
            reply_markup=get_back_to_menu_keyboard(),
        )

    await state.clear()
    user = await get_user_by_telegram_id(message.from_user.id)
    unit_price = await get_unit_price_paise()
    total_cost = unit_price * quantity
    has_enough = user.balancePaise >= total_cost

    summary = (
        f"🛒 *ORDER SUMMARY*\n\n"
        f"Quantity: {quantity} Accounts\n"
        f"Price per account: {format_paise(unit_price)}\n"
        f"Total Cost: {format_paise(total_cost)}\n\n"
        f"Your Wallet Balance: {format_paise(user.balancePaise)}\n"
        f"{'⚠️ Insufficient balance! Please add funds in your wallet first.' if not has_enough else '✅ You have sufficient balance to proceed.'}"
    )
    await message.answer(summary, reply_markup=get_order_confirmation_keyboard(quantity), parse_mode="Markdown")

# Admin Search User State
@text_router.message(AdminStates.waiting_for_search_user)
async def handle_admin_search_user(message: Message, state: FSMContext):
    if not config.is_admin(message.from_user.id):
        return
    await state.clear()
    query = message.text.strip() if message.text else ""
    users = await search_users(query)

    if not users:
        return await message.answer(f"🔍 No users found matching \"{query}\".", reply_markup=get_back_to_admin_keyboard())

    for u in users:
        details = await get_user_profile_details(u.id)
        name = f"{u.firstName or ''} {u.lastName or ''}".strip() or "N/A"
        uname = f"@{u.username}" if u.username else "N/A"
        status_text = "🚫 RESTRICTED" if u.isRestricted else "🟢 ACTIVE"

        profile_text = (
            f"👤 *USER PROFILE*\n\n"
            f"Name: {name}\n"
            f"Username: {uname}\n"
            f"Telegram ID: `{u.telegramId}`\n\n"
            f"Balance: {format_paise(u.balancePaise)}\n"
            f"Total Orders: {details['orderCount']}\n"
            f"Purchased Accounts: {details['purchasedAccountsCount']}\n"
            f"Referrals: {details['referralCount']}\n"
            f"Joined: {format_date_ist(u.createdAt)}\n"
            f"Status: {status_text}"
        )
        await message.answer(profile_text, reply_markup=get_user_action_keyboard(u.id, u.isRestricted), parse_mode="Markdown")
