from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from bot_python.config import config

def get_channel_join_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📢 Join Official Channel", url=config.channel_username)],
            [InlineKeyboardButton(text="✅ Check Membership", callback_data="check_join")],
        ]
    )

def get_main_menu_keyboard(available_stock: int = 0, is_admin: bool = False) -> InlineKeyboardMarkup:
    stock_text = f" [{available_stock} Left]" if available_stock > 0 else " [0 Left]"
    buttons = [
        # Top Green Action
        [InlineKeyboardButton(text=f"🛒 Buy Accounts (₹3/each){stock_text}", callback_data="menu_buy")],
        # Blue Sub-Routes
        [
            InlineKeyboardButton(text="💰 Wallet & Funds", callback_data="menu_wallet"),
            InlineKeyboardButton(text="📋 My Orders", callback_data="menu_purchases"),
        ],
        # Referral & Support
        [
            InlineKeyboardButton(text="👥 Refer & Earn", callback_data="menu_referral"),
            InlineKeyboardButton(text="📞 Support", callback_data="menu_support"),
        ],
    ]
    if is_admin:
        buttons.append([InlineKeyboardButton(text="🛠 Admin Panel", callback_data="admin_menu")])

    return InlineKeyboardMarkup(inline_keyboard=buttons)

def get_wallet_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="➕ Add Funds", callback_data="menu_deposit"),
                InlineKeyboardButton(text="💳 Transactions", callback_data="menu_transactions"),
            ],
            [InlineKeyboardButton(text="🏠 Back to Menu", callback_data="main_menu")],
        ]
    )

def get_orders_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🛒 Buy Accounts", callback_data="menu_buy")],
            [InlineKeyboardButton(text="🏠 Back to Menu", callback_data="main_menu")],
        ]
    )

def get_transactions_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="💰 Back to Wallet", callback_data="menu_wallet"),
                InlineKeyboardButton(text="🏠 Back to Menu", callback_data="main_menu"),
            ]
        ]
    )

def get_payment_method_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🏠 Back to Menu", callback_data="main_menu")]
        ]
    )

def get_buy_quantity_keyboard(available_stock: int) -> InlineKeyboardMarkup:
    candidate_qtys = [q for q in [10, 20, 30, 50, 100, 200, 500] if q <= available_stock]
    max_multiple_of_10 = (available_stock // 10) * 10

    rows = []
    current_row = []
    for q in candidate_qtys:
        current_row.append(InlineKeyboardButton(text=f"{q} Accounts", callback_data=f"buy_select_{q}"))
        if len(current_row) == 2:
            rows.append(current_row)
            current_row = []
    if current_row:
        rows.append(current_row)

    if max_multiple_of_10 > 30 and max_multiple_of_10 not in candidate_qtys:
        rows.append([InlineKeyboardButton(text=f"⚡ Buy Max ({max_multiple_of_10} Accounts)", callback_data=f"buy_select_{max_multiple_of_10}")])

    rows.append([InlineKeyboardButton(text="✏️ Enter Custom Quantity (Multiples of 10)", callback_data="buy_custom_qty")])
    rows.append([InlineKeyboardButton(text="🏠 Cancel & Back to Menu", callback_data="main_menu")])

    return InlineKeyboardMarkup(inline_keyboard=rows)

def get_order_confirmation_keyboard(quantity: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Confirm Purchase", callback_data=f"buy_confirm_{quantity}"),
                InlineKeyboardButton(text="❌ Cancel", callback_data="main_menu"),
            ]
        ]
    )

def get_back_to_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🏠 Back to Menu", callback_data="main_menu")]
        ]
    )
