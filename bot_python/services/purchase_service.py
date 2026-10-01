import secrets
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy import select, update, func
from bot_python.database import get_session
from bot_python.models import User, Account, Order, OrderItem, WalletTransaction, SystemSetting
from bot_python.config import config
from bot_python.utils.cache import cache
from bot_python.utils.splitter import split_delivery_messages
from bot_python.services.stock_service import invalidate_stock_cache

logger = logging.getLogger(__name__)

CACHE_PRICE_KEY = "unit_price_paise"

async def get_unit_price_paise() -> int:
    cached = cache.get(CACHE_PRICE_KEY)
    if isinstance(cached, int):
        return cached

    async with get_session() as session:
        result = await session.execute(
            select(SystemSetting.value).where(SystemSetting.key == "ACCOUNT_PRICE_PAISE")
        )
        val = result.scalar_one_or_none()
        if val:
            try:
                price = int(val)
                cache.set(CACHE_PRICE_KEY, price, ttl_seconds=60.0)
                return price
            except ValueError:
                pass

        default_price = config.account_price_paise
        cache.set(CACHE_PRICE_KEY, default_price, ttl_seconds=60.0)
        return default_price

def generate_order_number() -> str:
    suffix = secrets.token_hex(4).upper()
    return f"ORD-{suffix}"

async def execute_purchase(user_id: str, quantity: int) -> Dict[str, Any]:
    if quantity < 10 or quantity % 10 != 0:
        return {
            "success": False,
            "error": "Quantity must be a positive multiple of 10 (e.g. 10, 20, 50, 100).",
        }

    unit_price = await get_unit_price_paise()
    total_cost = unit_price * quantity

    try:
        async with get_session() as session:
            # 1. Lock user record
            user_res = await session.execute(
                select(User).where(User.id == user_id).with_for_update()
            )
            user = user_res.scalar_one_or_none()

            if not user:
                return {"success": False, "error": "User profile not found."}
            if user.isRestricted:
                return {"success": False, "error": "Your account is currently restricted."}
            if user.balancePaise < total_cost:
                return {"success": False, "error": "Insufficient wallet balance. Please add funds first."}

            # 2. Select accounts FOR UPDATE SKIP LOCKED
            acc_res = await session.execute(
                select(Account)
                .where(Account.status == "AVAILABLE")
                .order_by(Account.createdAt.asc())
                .limit(quantity)
                .with_for_update(skip_locked=True)
            )
            accounts = list(acc_res.scalars().all())

            if len(accounts) < quantity:
                return {
                    "success": False,
                    "error": f"Insufficient stock available. Requested: {quantity}, Available: {len(accounts)}.",
                }

            # 3. Deduct wallet balance
            balance_before = user.balancePaise
            balance_after = balance_before - total_cost
            user.balancePaise = balance_after

            # 4. Mark accounts as SOLD
            now_utc = datetime.now(timezone.utc)
            for acc in accounts:
                acc.status = "SOLD"
                acc.soldToUserId = user.id
                acc.soldAt = now_utc

            # 5. Create Order
            order_num = generate_order_number()
            order = Order(
                orderNumber=order_num,
                userId=user.id,
                quantity=quantity,
                totalAmountPaise=total_cost,
                status="DELIVERED",
                createdAt=now_utc,
            )
            session.add(order)
            await session.flush()

            # 6. Create OrderItems
            for acc in accounts:
                item = OrderItem(orderId=order.id, accountId=acc.id)
                session.add(item)

            # 7. Create WalletTransaction
            tx = WalletTransaction(
                userId=user.id,
                type="PURCHASE",
                amountPaise=total_cost,
                balanceBeforePaise=balance_before,
                balanceAfterPaise=balance_after,
                referenceId=order.id,
                description=f"Purchased {quantity} accounts (#{order_num})",
                createdAt=now_utc,
            )
            session.add(tx)

            await session.commit()

        # Invalidate stock cache
        invalidate_stock_cache()

        # Split delivery messages for customer
        delivery_messages = split_delivery_messages(accounts)
        logger.info(f"Order completed: {order_num} for user {user_id} ({quantity} accounts)")

        return {
            "success": True,
            "order": order,
            "orderNumber": order_num,
            "quantity": quantity,
            "totalCost": total_cost,
            "balanceAfter": balance_after,
            "accounts": accounts,
            "deliveryMessages": delivery_messages,
        }

    except Exception as e:
        logger.error(f"Purchase execution error: {e}", exc_info=True)
        return {"success": False, "error": "An error occurred while processing your order. Please try again."}

async def get_user_orders(user_id: str, limit: int = 10) -> List[Order]:
    async with get_session() as session:
        result = await session.execute(
            select(Order)
            .where(Order.userId == user_id)
            .order_by(Order.createdAt.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
