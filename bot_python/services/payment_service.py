import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy import select, update
from bot_python.database import get_session
from bot_python.models import Payment, User, WalletTransaction, AdminAction
from bot_python.config import config

logger = logging.getLogger(__name__)

async def create_screenshot_payment(user_id: str, amount_paise: int, screenshot_file_id: str) -> Dict[str, Any]:
    if amount_paise < config.min_deposit_paise:
        return {
            "success": False,
            "error": f"Minimum deposit is ₹{config.min_deposit_paise / 100.0:.2f}.",
        }

    async with get_session() as session:
        payment = Payment(
            userId=user_id,
            amountPaise=amount_paise,
            screenshotFileId=screenshot_file_id,
            status="PENDING",
        )
        session.add(payment)
        await session.commit()
        await session.refresh(payment)

        logger.info(f"Payment requested: {payment.id} for user {user_id} ({amount_paise} paise)")
        return {"success": True, "payment": payment}

async def approve_payment(payment_id: str, admin_telegram_id: str | int) -> Dict[str, Any]:
    async with get_session() as session:
        # 1. Lock payment
        pay_res = await session.execute(
            select(Payment).where(Payment.id == payment_id).with_for_update()
        )
        payment = pay_res.scalar_one_or_none()

        if not payment:
            return {"success": False, "error": "Payment record not found."}
        if payment.status != "PENDING":
            return {"success": False, "error": f"Payment is already {payment.status}."}

        # 2. Lock user
        user_res = await session.execute(
            select(User).where(User.id == payment.userId).with_for_update()
        )
        user = user_res.scalar_one_or_none()
        if not user:
            return {"success": False, "error": "User associated with payment not found."}

        # 3. Credit wallet
        balance_before = user.balancePaise
        balance_after = balance_before + payment.amountPaise
        user.balancePaise = balance_after

        # 4. Update payment
        now_utc = datetime.now(timezone.utc)
        payment.status = "APPROVED"
        payment.reviewedBy = str(admin_telegram_id)
        payment.reviewedAt = now_utc

        # 5. Create WalletTransaction
        tx = WalletTransaction(
            userId=user.id,
            type="DEPOSIT",
            amountPaise=payment.amountPaise,
            balanceBeforePaise=balance_before,
            balanceAfterPaise=balance_after,
            referenceId=payment.id,
            description="Manual UPI Deposit (Approved)",
            createdAt=now_utc,
        )
        session.add(tx)

        # 6. Admin audit
        admin_act = AdminAction(
            adminTelegramId=str(admin_telegram_id),
            action="APPROVE_PAYMENT",
            targetUserId=user.id,
            action_metadata=f"Payment ID: {payment.id}, Amount: {payment.amountPaise} paise",
            createdAt=now_utc,
        )
        session.add(admin_act)

        await session.commit()
        await session.refresh(user)

        logger.info(f"Payment {payment.id} approved by admin {admin_telegram_id}. User {user.telegramId} credited {payment.amountPaise} paise.")

        return {
            "success": True,
            "payment": payment,
            "user": user,
            "amountPaise": payment.amountPaise,
            "newBalance": balance_after,
        }

async def reject_payment(payment_id: str, admin_telegram_id: str | int, admin_note: Optional[str] = None) -> Dict[str, Any]:
    async with get_session() as session:
        pay_res = await session.execute(
            select(Payment).where(Payment.id == payment_id).with_for_update()
        )
        payment = pay_res.scalar_one_or_none()

        if not payment:
            return {"success": False, "error": "Payment record not found."}
        if payment.status != "PENDING":
            return {"success": False, "error": f"Payment is already {payment.status}."}

        user_res = await session.execute(select(User).where(User.id == payment.userId))
        user = user_res.scalar_one_or_none()

        now_utc = datetime.now(timezone.utc)
        payment.status = "REJECTED"
        payment.reviewedBy = str(admin_telegram_id)
        payment.reviewedAt = now_utc
        payment.adminNote = admin_note or "Declined by administrator"

        admin_act = AdminAction(
            adminTelegramId=str(admin_telegram_id),
            action="REJECT_PAYMENT",
            targetUserId=payment.userId,
            action_metadata=f"Payment ID: {payment.id}, Note: {payment.adminNote}",
            createdAt=now_utc,
        )
        session.add(admin_act)
        await session.commit()

        logger.info(f"Payment {payment.id} rejected by admin {admin_telegram_id}.")

        return {
            "success": True,
            "payment": payment,
            "user": user,
            "reason": payment.adminNote,
        }

async def get_pending_payments(limit: int = 10) -> List[Payment]:
    async with get_session() as session:
        result = await session.execute(
            select(Payment)
            .where(Payment.status == "PENDING")
            .order_by(Payment.createdAt.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

async def get_payment_by_id(payment_id: str) -> Optional[Payment]:
    async with get_session() as session:
        result = await session.execute(select(Payment).where(Payment.id == payment_id))
        return result.scalar_one_or_none()
