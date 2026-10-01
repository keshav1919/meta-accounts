from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

def get_admin_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="📦 Stock", callback_data="admin_stock"),
                InlineKeyboardButton(text="➕ Add Stock", callback_data="admin_add_stock"),
            ],
            [
                InlineKeyboardButton(text="💳 Pending Payments", callback_data="admin_payments"),
                InlineKeyboardButton(text="👥 Users", callback_data="admin_users"),
            ],
            [
                InlineKeyboardButton(text="📊 Statistics", callback_data="admin_stats"),
                InlineKeyboardButton(text="🛒 Orders", callback_data="admin_orders"),
            ],
            [InlineKeyboardButton(text="⚙️ Settings", callback_data="admin_settings")],
            [InlineKeyboardButton(text="🏠 Return to User Menu", callback_data="main_menu")],
        ]
    )

def get_stock_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="➕ Add Stock (TXT)", callback_data="admin_add_stock")],
            [InlineKeyboardButton(text="🔍 Search Account", callback_data="admin_search_account")],
            [InlineKeyboardButton(text="🔙 Admin Menu", callback_data="admin_menu")],
        ]
    )

def get_payment_action_keyboard(payment_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Approve", callback_data=f"pay_approve_{payment_id}"),
                InlineKeyboardButton(text="❌ Reject", callback_data=f"pay_reject_{payment_id}"),
            ]
        ]
    )

def get_user_action_keyboard(user_id: str, is_restricted: bool) -> InlineKeyboardMarkup:
    restrict_text = "✅ Unrestrict User" if is_restricted else "🚫 Restrict User"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="➕ Add Balance", callback_data=f"admin_usr_add_{user_id}"),
                InlineKeyboardButton(text="➖ Deduct Balance", callback_data=f"admin_usr_ded_{user_id}"),
            ],
            [InlineKeyboardButton(text=restrict_text, callback_data=f"admin_usr_toggle_{user_id}")],
            [InlineKeyboardButton(text="🔙 Back to Users", callback_data="admin_users")],
        ]
    )

def get_back_to_admin_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Back to Admin Menu", callback_data="admin_menu")]
        ]
    )
