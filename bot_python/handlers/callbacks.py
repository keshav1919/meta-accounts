import logging
from aiogram import Router, Bot, F
from aiogram.types import CallbackQuery
from aiogram.fsm.context import FSMContext

from bot_python.config import config
from bot_python.services.user_service import (
    get_or_register_user,
    process_referral_reward,
    get_user_by_telegram_id,
    get_user_referral_stats,
)
from bot_python.services.stock_service import get_available_count
from bot_python.services.purchase_service import execute_purchase, get_unit_price_paise, get_user_orders
from bot_python.services.wallet_service import get_user_transactions
from bot_python.services.notification_service import notify_new_user_registration
from bot_python.keyboards.customer_kb import (
    get_main_menu_keyboard,
    get_buy_quantity_keyboard,
    get_wallet_keyboard,
    get_orders_keyboard,
    get_transactions_keyboard,
    get_order_confirmation_keyboard,
    get_back_to_menu_keyboard,
)
from bot_python.middleware.channel_middleware import check_user_channel_join
from bot_python.utils.formatter import format_paise, format_date_ist
from bot_python.states import DepositStates, BuyStates

logger = logging.getLogger(__name__)
callbacks_router = Router()

@callbacks_router.callback_query(F.data == "check_join")
async def cb_check_join(call: CallbackQuery, bot: Bot, state: FSMContext):
    user_id = call.from_user.id
    is_joined = await check_user_channel_join(bot, user_id, force_refresh=True)

    if not is_joined and not config.is_admin(user_id):
        return await call.answer("❌ You have not joined yet. Please join the channel first!", show_alert=True)

    await call.answer("✅ Membership verified!")

    state_data = await state.get_data()
    ref_payload = state_data.get("ref_payload")
    await state.clear()

    user, is_new = await get_or_register_user(
        telegram_id=user_id,
        username=call.from_user.username,
        first_name=call.from_user.first_name,
        last_name=call.from_user.last_name,
        start_payload=ref_payload,
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
        "Choose an option below:"
    )

    try:
        await call.message.edit_text(
            welcome_text,
            reply_markup=get_main_menu_keyboard(available_stock=available_stock, is_admin=is_admin),
            parse_mode="Markdown",
        )
    except Exception:
        await call.message.answer(
            welcome_text,
            reply_markup=get_main_menu_keyboard(available_stock=available_stock, is_admin=is_admin),
            parse_mode="Markdown",
        )

@callbacks_router.callback_query(F.data == "main_menu")
async def cb_main_menu(call: CallbackQuery, bot: Bot, state: FSMContext):
    await state.clear()
    await call.answer()
    user_id = call.from_user.id
    user = await get_user_by_telegram_id(user_id)
    balance = user.balancePaise if user else 0
    available_stock = await get_available_count()
    is_admin = config.is_admin(user_id)

    text = (
        f"⚡ *META ACCOUNTS STORE*\n\n"
        f"📦 In Stock: {available_stock} Accounts\n"
        f"💰 Price: ₹3.00 / Account\n"
        f"💳 Your Balance: {format_paise(balance)}\n\n"
        "Choose an option below:"
    )

    try:
        await call.message.edit_text(
            text,
            reply_markup=get_main_menu_keyboard(available_stock=available_stock, is_admin=is_admin),
            parse_mode="Markdown",
        )
    except Exception:
        await call.message.answer(
            text,
            reply_markup=get_main_menu_keyboard(available_stock=available_stock, is_admin=is_admin),
            parse_mode="Markdown",
        )

@callbacks_router.callback_query(F.data == "menu_buy")
async def cb_menu_buy(call: CallbackQuery, bot: Bot):
    await call.answer()
    user_id = call.from_user.id
    if not await check_user_channel_join(bot, user_id):
        return await call.answer("🔒 Please join our channel first!", show_alert=True)

    user = await get_user_by_telegram_id(user_id)
    if not user:
        return await call.message.answer("Please send /start first.")
    if user.isRestricted:
        return await call.answer("🚫 Your account is restricted.", show_alert=True)

    available_stock = await get_available_count()
    if available_stock < 10:
        return await call.message.edit_text("⚠️ Out of stock! Please check back later.", reply_markup=get_back_to_menu_keyboard())

    text = (
        f"🛒 *SELECT PURCHASE QUANTITY*\n\n"
        f"📦 Available Stock: {available_stock} Accounts\n"
        f"💰 Unit Price: ₹3.00 / Account\n"
        f"💳 Your Balance: {format_paise(user.balancePaise)}\n\n"
        "*(All orders must be multiples of 10)*\n"
        "Select a quantity preset or enter your custom amount:"
    )
    await call.message.edit_text(text, reply_markup=get_buy_quantity_keyboard(available_stock), parse_mode="Markdown")

@callbacks_router.callback_query(F.data == "menu_wallet")
async def cb_menu_wallet(call: CallbackQuery, bot: Bot):
    await call.answer()
    user_id = call.from_user.id
    user = await get_user_by_telegram_id(user_id)
    if not user:
        return await call.message.answer("Please send /start first.")

    text = (
        f"💰 *YOUR WALLET & FUNDS*\n\n"
        f"Current Balance: {format_paise(user.balancePaise)}\n\n"
        "Deposit funds via instant UPI QR code by tapping **Add Funds** below."
    )
    await call.message.edit_text(text, reply_markup=get_wallet_keyboard(), parse_mode="Markdown")

@callbacks_router.callback_query(F.data == "menu_deposit")
async def cb_menu_deposit(call: CallbackQuery, bot: Bot, state: FSMContext):
    await call.answer()
    user_id = call.from_user.id
    if not await check_user_channel_join(bot, user_id):
        return await call.answer("🔒 Please join our channel first!", show_alert=True)

    await state.set_state(DepositStates.waiting_for_amount)
    text = (
        "💰 *Add Funds to Wallet*\n\n"
        "Minimum manual deposit: ₹1.00\n\n"
        "Enter the amount in ₹ you wish to add (e.g. 50 or 100):"
    )
    await call.message.edit_text(text, reply_markup=get_back_to_menu_keyboard(), parse_mode="Markdown")

@callbacks_router.callback_query(F.data == "menu_purchases")
async def cb_menu_purchases(call: CallbackQuery, bot: Bot):
    await call.answer()
    user_id = call.from_user.id
    user = await get_user_by_telegram_id(user_id)
    if not user:
        return await call.message.answer("Please send /start first.")

    orders = await get_user_orders(user.id, limit=10)
    if not orders:
        return await call.message.edit_text("📋 You have not purchased any accounts yet.", reply_markup=get_orders_keyboard())

    items = []
    for o in orders:
        items.append(
            f"📦 *Order #{o.orderNumber}*\n"
            f"Quantity: {o.quantity} Accounts\n"
            f"Amount: {format_paise(o.totalAmountPaise)}\n"
            f"Status: Delivered\n"
            f"Date: {format_date_ist(o.createdAt)}"
        )
    text = "📋 *My Orders*\n\n" + "\n\n-------------------------\n\n".join(items)
    await call.message.edit_text(text, reply_markup=get_orders_keyboard(), parse_mode="Markdown")

@callbacks_router.callback_query(F.data == "menu_transactions")
async def cb_menu_transactions(call: CallbackQuery, bot: Bot):
    await call.answer()
    user_id = call.from_user.id
    user = await get_user_by_telegram_id(user_id)
    if not user:
        return await call.message.answer("Please send /start first.")

    txs = await get_user_transactions(user.id, limit=10)
    if not txs:
        return await call.message.edit_text("💳 No transactions recorded yet.", reply_markup=get_transactions_keyboard())

    items = []
    for t in txs:
        type_icon = "➕" if t.amountPaise > 0 and t.type in ["DEPOSIT", "WELCOME_BONUS", "REFERRAL_REWARD"] else "➖"
        items.append(
            f"{type_icon} *{t.type}*: {format_paise(t.amountPaise)}\n"
            f"Desc: {t.description}\n"
            f"Balance After: {format_paise(t.balanceAfterPaise)}\n"
            f"Date: {format_date_ist(t.createdAt)}"
        )
    text = "💳 *Transaction Ledger*\n\n" + "\n\n-------------------------\n\n".join(items)
    await call.message.edit_text(text, reply_markup=get_transactions_keyboard(), parse_mode="Markdown")

@callbacks_router.callback_query(F.data == "menu_referral")
async def cb_menu_referral(call: CallbackQuery, bot: Bot):
    await call.answer()
    user_id = call.from_user.id
    user = await get_user_by_telegram_id(user_id)
    if not user:
        return await call.message.answer("Please send /start first.")

    stats = await get_user_referral_stats(user.id)
    ref_link = f"https://t.me/{config.bot_username}?start={user.referralCode}"

    text = (
        f"👥 *REFER & EARN*\n\n"
        f"Share your referral link with friends. Earn *₹2.00* directly into your wallet when they join and verify!\n\n"
        f"🔗 Your Link:\n`{ref_link}`\n\n"
        f"📊 Total Friends Invited: {stats['totalCount']}\n"
        f"💰 Total Referral Earnings: {format_paise(stats['totalEarnedPaise'])}"
    )
    await call.message.edit_text(text, reply_markup=get_back_to_menu_keyboard(), parse_mode="Markdown")

@callbacks_router.callback_query(F.data == "menu_support")
async def cb_menu_support(call: CallbackQuery):
    await call.answer()
    text = (
        f"📞 *Customer Support & Inquiries*\n\n"
        f"Need help with your account or order?\n"
        f"Contact our official administrator.\n\n"
        f"UPI ID: `{config.payment_upi_id}`\n"
        f"Account Name: {config.payment_name}"
    )
    await call.message.edit_text(text, reply_markup=get_back_to_menu_keyboard(), parse_mode="Markdown")

# Purchase Preset Selection
@callbacks_router.callback_query(F.data.startswith("buy_select_"))
async def cb_buy_select(call: CallbackQuery):
    await call.answer()
    qty_str = call.data.replace("buy_select_", "")
    try:
        quantity = int(qty_str)
    except ValueError:
        return

    user_id = call.from_user.id
    user = await get_user_by_telegram_id(user_id)
    unit_price = await get_unit_price_paise()
    total_cost = unit_price * quantity

    has_enough = user.balancePaise >= total_cost

    text = (
        f"🛒 *ORDER SUMMARY*\n\n"
        f"Quantity: {quantity} Accounts\n"
        f"Price per account: {format_paise(unit_price)}\n"
        f"Total Cost: {format_paise(total_cost)}\n\n"
        f"Your Wallet Balance: {format_paise(user.balancePaise)}\n"
        f"{'⚠️ Insufficient balance! Please add funds in your wallet first.' if not has_enough else '✅ You have sufficient balance to proceed.'}"
    )
    await call.message.edit_text(text, reply_markup=get_order_confirmation_keyboard(quantity), parse_mode="Markdown")

@callbacks_router.callback_query(F.data == "buy_custom_qty")
async def cb_buy_custom(call: CallbackQuery, state: FSMContext):
    await call.answer()
    await state.set_state(BuyStates.waiting_for_custom_quantity)
    available = await get_available_count()
    text = (
        f"✏️ *Enter Custom Quantity*\n\n"
        f"Available Stock: {available} Accounts\n"
        f"Price: ₹3.00 / Account\n\n"
        "Please type the number of accounts you want to buy.\n"
        "*(Must be a multiple of 10, e.g. 10, 20, 50, 100, 250):*"
    )
    await call.message.edit_text(text, reply_markup=get_back_to_menu_keyboard(), parse_mode="Markdown")

@callbacks_router.callback_query(F.data.startswith("buy_confirm_"))
async def cb_buy_confirm(call: CallbackQuery, bot: Bot):
    await call.answer("Processing purchase...", show_alert=False)
    qty_str = call.data.replace("buy_confirm_", "")
    try:
        quantity = int(qty_str)
    except ValueError:
        return

    user_id = call.from_user.id
    user = await get_user_by_telegram_id(user_id)
    if not user:
        return await call.message.answer("Please send /start first.")

    result = await execute_purchase(user.id, quantity)
    if not result["success"]:
        return await call.message.answer(f"❌ Purchase failed: {result['error']}", reply_markup=get_back_to_menu_keyboard())

    # 1. Deliver account credential parts
    delivery_messages = result["deliveryMessages"]
    for msg_part in delivery_messages:
        await call.message.answer(msg_part)

    # 2. Send order receipt
    receipt = (
        f"✅ *PURCHASE SUCCESSFUL!*\n\n"
        f"Order Number: `#{result['orderNumber']}`\n"
        f"Quantity: {result['quantity']} Accounts\n"
        f"Total Paid: {format_paise(result['totalCost'])}\n"
        f"Remaining Balance: {format_paise(result['balanceAfter'])}\n\n"
        "Your account credentials have been delivered above! Thank you for purchasing with us."
    )
    await call.message.answer(receipt, reply_markup=get_back_to_menu_keyboard(), parse_mode="Markdown")
