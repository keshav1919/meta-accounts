import logging
from aiogram import Router, Bot, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext

from bot_python.config import config
from bot_python.services.stock_service import get_stock_stats
from bot_python.services.payment_service import get_pending_payments, approve_payment, reject_payment, get_payment_by_id
from bot_python.services.user_service import get_user_profile_details, set_user_restriction, get_user_by_id
from bot_python.services.notification_service import notify_user
from bot_python.keyboards.admin_kb import (
    get_admin_menu_keyboard,
    get_stock_menu_keyboard,
    get_payment_action_keyboard,
    get_user_action_keyboard,
    get_back_to_admin_keyboard,
)
from bot_python.utils.formatter import format_paise, format_date_ist
from bot_python.states import AdminStates

logger = logging.getLogger(__name__)
admin_router = Router()

async def show_admin_stock(message_or_call: Message | CallbackQuery):
    stats = await get_stock_stats()
    text = (
        f"📦 *INVENTORY STOCK OVERVIEW*\n\n"
        f"🟢 Available Accounts: {stats['available']}\n"
        f"🔴 Sold Accounts: {stats['sold']}\n"
        f"📁 Total Imported Accounts: {stats['totalImported']}\n"
        f"📦 Total Stock Batches: {stats['batches']}\n\n"
        "To add new stock, forward or send a `.txt` batch file containing 10 accounts."
    )
    if isinstance(message_or_call, CallbackQuery):
        await message_or_call.message.edit_text(text, reply_markup=get_stock_menu_keyboard(), parse_mode="Markdown")
    else:
        await message_or_call.answer(text, reply_markup=get_stock_menu_keyboard(), parse_mode="Markdown")

@admin_router.message(Command("admin"))
async def handle_admin_command(message: Message):
    if not config.is_admin(message.from_user.id):
        return await message.answer("🚫 Unauthorized access.")
    text = "🛠 *ADMIN CONTROL PANEL*\n\nSelect a management module below:"
    await message.answer(text, reply_markup=get_admin_menu_keyboard(), parse_mode="Markdown")

@admin_router.callback_query(F.data == "admin_menu")
async def cb_admin_menu(call: CallbackQuery, state: FSMContext):
    await state.clear()
    if not config.is_admin(call.from_user.id):
        return await call.answer("🚫 Unauthorized", show_alert=True)
    await call.answer()
    text = "🛠 *ADMIN CONTROL PANEL*\n\nSelect a management module below:"
    try:
        await call.message.edit_text(text, reply_markup=get_admin_menu_keyboard(), parse_mode="Markdown")
    except Exception:
        await call.message.answer(text, reply_markup=get_admin_menu_keyboard(), parse_mode="Markdown")

@admin_router.callback_query(F.data == "admin_stock")
async def cb_admin_stock(call: CallbackQuery):
    if not config.is_admin(call.from_user.id):
        return await call.answer("🚫 Unauthorized", show_alert=True)
    await call.answer()
    await show_admin_stock(call)

@admin_router.callback_query(F.data == "admin_add_stock")
async def cb_admin_add_stock(call: CallbackQuery):
    if not config.is_admin(call.from_user.id):
        return await call.answer("🚫 Unauthorized", show_alert=True)
    await call.answer()
    text = (
        "📥 *Upload Stock Batch File*\n\n"
        "Please send your `.txt` stock file directly into this chat.\n"
        "*(File must contain exactly 10 account records with full name, email, password, and created on)*"
    )
    await call.message.edit_text(text, reply_markup=get_back_to_admin_keyboard(), parse_mode="Markdown")

@admin_router.callback_query(F.data == "admin_payments")
async def cb_admin_payments(call: CallbackQuery):
    if not config.is_admin(call.from_user.id):
        return await call.answer("🚫 Unauthorized", show_alert=True)
    await call.answer()
    pending = await get_pending_payments(limit=5)
    if not pending:
        return await call.message.edit_text("💳 *Pending Payments*\n\nNo pending payment requests right now.", reply_markup=get_back_to_admin_keyboard(), parse_mode="Markdown")

    await call.message.edit_text(f"💳 *Pending Payments ({len(pending)})*", reply_markup=get_back_to_admin_keyboard(), parse_mode="Markdown")

    for pay in pending:
        user = await get_user_by_id(pay.userId)
        uname = f"@{user.username}" if (user and user.username) else f"ID: {user.telegramId}" if user else "Unknown"
        cap = (
            f"💳 *PAYMENT REQUEST*\n\n"
            f"User: {uname}\n"
            f"Amount: {format_paise(pay.amountPaise)}\n"
            f"Date: {format_date_ist(pay.createdAt)}"
        )
        if pay.screenshotFileId:
            await call.message.answer_photo(
                photo=pay.screenshotFileId,
                caption=cap,
                reply_markup=get_payment_action_keyboard(pay.id),
                parse_mode="Markdown",
            )
        else:
            await call.message.answer(
                cap,
                reply_markup=get_payment_action_keyboard(pay.id),
                parse_mode="Markdown",
            )

@admin_router.callback_query(F.data.startswith("pay_approve_"))
async def cb_pay_approve(call: CallbackQuery, bot: Bot):
    if not config.is_admin(call.from_user.id):
        return await call.answer("🚫 Unauthorized", show_alert=True)
    pay_id = call.data.replace("pay_approve_", "")
    res = await approve_payment(pay_id, call.from_user.id)
    if not res["success"]:
        return await call.answer(f"❌ {res['error']}", show_alert=True)

    await call.answer("✅ Payment approved and credited!")
    user = res["user"]
    amt_text = format_paise(res["amountPaise"])
    bal_text = format_paise(res["newBalance"])

    # Notify customer
    await notify_user(
        bot,
        user.telegramId,
        f"✅ *PAYMENT APPROVED!*\n\nYour deposit of {amt_text} has been credited to your wallet!\n💵 Current Balance: {bal_text}",
    )

    await call.message.edit_reply_markup(reply_markup=None)
    await call.message.answer(f"✅ Approved deposit of {amt_text} for user `{user.telegramId}`.")

@admin_router.callback_query(F.data.startswith("pay_reject_"))
async def cb_pay_reject(call: CallbackQuery, bot: Bot):
    if not config.is_admin(call.from_user.id):
        return await call.answer("🚫 Unauthorized", show_alert=True)
    pay_id = call.data.replace("pay_reject_", "")
    res = await reject_payment(pay_id, call.from_user.id, "Declined by administrator")
    if not res["success"]:
        return await call.answer(f"❌ {res['error']}", show_alert=True)

    await call.answer("❌ Payment rejected.")
    user = res["user"]
    if user:
        await notify_user(
            bot,
            user.telegramId,
            "❌ *Payment Request Declined*\n\nYour submitted payment screenshot was not verified. Please contact support if you believe this is an error.",
        )

    await call.message.edit_reply_markup(reply_markup=None)
    await call.message.answer(f"❌ Rejected payment for user `{user.telegramId if user else 'N/A'}`.")

@admin_router.callback_query(F.data == "admin_stats")
async def cb_admin_stats(call: CallbackQuery):
    if not config.is_admin(call.from_user.id):
        return await call.answer("🚫 Unauthorized", show_alert=True)
    await call.answer()
    stats = await get_stock_stats()
    text = (
        f"📊 *SYSTEM STATISTICS*\n\n"
        f"📦 Accounts Available: {stats['available']}\n"
        f"🛒 Accounts Sold: {stats['sold']}\n"
        f"📥 Total Uploaded: {stats['totalImported']}\n"
        f"📁 Stock Batches: {stats['batches']}"
    )
    await call.message.edit_text(text, reply_markup=get_back_to_admin_keyboard(), parse_mode="Markdown")

@admin_router.callback_query(F.data == "admin_users")
async def cb_admin_users(call: CallbackQuery, state: FSMContext):
    if not config.is_admin(call.from_user.id):
        return await call.answer("🚫 Unauthorized", show_alert=True)
    await call.answer()
    await state.set_state(AdminStates.waiting_for_search_user)
    text = (
        "🔍 *Search Users*\n\n"
        "Enter Telegram ID, @username, or name to search:"
    )
    await call.message.edit_text(text, reply_markup=get_back_to_admin_keyboard(), parse_mode="Markdown")

@admin_router.callback_query(F.data.startswith("admin_usr_toggle_"))
async def cb_admin_user_toggle(call: CallbackQuery):
    if not config.is_admin(call.from_user.id):
        return await call.answer("🚫 Unauthorized", show_alert=True)
    user_id = call.data.replace("admin_usr_toggle_", "")
    user = await get_user_by_id(user_id)
    if not user:
        return await call.answer("User not found", show_alert=True)

    new_state = not user.isRestricted
    await set_user_restriction(user_id, new_state, call.from_user.id)
    status_str = "restricted" if new_state else "unrestricted"
    await call.answer(f"User is now {status_str}!")
    await call.message.edit_reply_markup(reply_markup=get_user_action_keyboard(user.id, new_state))
