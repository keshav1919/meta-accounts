import logging
import io
from aiogram import Router, Bot, F
from aiogram.types import Message
from aiogram.fsm.context import FSMContext

from bot_python.config import config
from bot_python.services.stock_service import import_stock_txt
from bot_python.services.user_service import get_user_by_telegram_id
from bot_python.services.payment_service import create_screenshot_payment
from bot_python.services.notification_service import notify_admins_photo
from bot_python.keyboards.customer_kb import get_main_menu_keyboard
from bot_python.keyboards.admin_kb import getPaymentActionKeyboard as get_payment_action_keyboard, getBackToAdminKeyboard as get_back_to_admin_keyboard
from bot_python.utils.formatter import format_paise, format_date_ist
from bot_python.states import DepositStates

logger = logging.getLogger(__name__)
media_router = Router()

# 1. Admin TXT Batch File Upload
@media_router.message(F.document)
async def handle_document_upload(message: Message, bot: Bot):
    if not config.is_admin(message.from_user.id):
        return await message.answer("🚫 Unauthorized. Stock file uploads are restricted to admins.")

    doc = message.document
    if not doc.file_name.lower().endswith(".txt"):
        return await message.answer("❌ Only `.txt` files containing account batches are supported.", reply_markup=get_back_to_admin_keyboard())

    # Download file in memory
    file_io = io.BytesIO()
    file_info = await bot.get_file(doc.file_id)
    await bot.download_file(file_info.file_path, destination=file_io)
    content = file_io.getvalue().decode("utf-8", errors="replace")

    result = await import_stock_txt(
        content=content,
        file_name=doc.file_name,
        admin_telegram_id=message.from_user.id,
    )

    if not result["success"]:
        return await message.answer(f"❌ *STOCK IMPORT FAILED*\n\n{result['error']}", reply_markup=get_back_to_admin_keyboard(), parse_mode="Markdown")

    text = (
        f"✅ *STOCK IMPORT SUCCESSFUL!*\n\n"
        f"Batch Number: #{result['batchNumber']}\n"
        f"Accounts Imported: {result['totalImported']}\n"
        f"Total Stock Available: {result['availableStock']} Accounts"
    )
    await message.answer(text, reply_markup=get_back_to_admin_keyboard(), parse_mode="Markdown")

# 2. Customer Payment Screenshot Upload
@media_router.message(F.photo, DepositStates.waiting_for_screenshot)
async def handle_photo_upload(message: Message, bot: Bot, state: FSMContext):
    user_id = message.from_user.id
    user = await get_user_by_telegram_id(user_id)
    if not user:
        return await message.answer("Please send /start first.")

    state_data = await state.get_data()
    amount_paise = state_data.get("amount_paise", 0)
    await state.clear()

    # Pick highest resolution photo
    photo = message.photo[-1]

    result = await create_screenshot_payment(
        user_id=user.id,
        amount_paise=amount_paise,
        screenshot_file_id=photo.file_id,
    )

    if not result["success"]:
        return await message.answer(f"❌ {result['error']}", reply_markup=get_main_menu_keyboard(is_admin=config.is_admin(user_id)))

    # Acknowledge customer
    await message.answer(
        f"✅ *Payment screenshot submitted!*\n\n"
        f"Amount: {format_paise(amount_paise)}\n\n"
        "Our team is verifying your payment. Your balance will be credited as soon as it is approved.",
        reply_markup=get_main_menu_keyboard(is_admin=config.is_admin(user_id)),
        parse_mode="Markdown",
    )

    # Notify admins with photo and [Approve] / [Reject] buttons
    username_str = f"@{user.username}" if user.username else f"ID: {user.telegramId}"
    admin_caption = (
        f"💳 *NEW PAYMENT REQUEST*\n\n"
        f"User: {username_str}\n"
        f"Amount: {format_paise(amount_paise)}\n"
        f"Payment Method: Screenshot Proof\n"
        f"Time: {format_date_ist(result['payment'].createdAt)}"
    )

    await notify_admins_photo(
        bot=bot,
        photo_file_id=photo.file_id,
        caption=admin_caption,
        reply_markup=get_payment_action_keyboard(result["payment"].id),
    )
