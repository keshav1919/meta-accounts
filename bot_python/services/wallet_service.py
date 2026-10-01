import json
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy import select
from bot_python.database import get_session
from bot_python.models import User, WalletTransaction, AdminAction

logger = logging.getLogger(__name__)

async def admin_adjust_balance(
    admin_telegram_id: str | int,
    target_user_id: str,
    amount_paise: int,
    action_type: str = "ADD",
    reason: str = "Admin Adjustment",
) -> Dict[str, Any]:
    async with get_session() as session:
        user_res = await session.execute(
            select(User).where(User.id == target_user_id).with_for_update()
        )
        user = user_res.scalar_one_or_none()
        if not user:
            raise ValueError("Target user not found.")

        balance_before = user.balancePaise
        if action_type == "ADD":
            balance_after = balance_before + amount_paise
            desc = f"Admin Credit: {reason}"
        elif action_type == "DEDUCT":
            balance_after = max(0, balance_before - amount_paise)
            desc = f"Admin Debit: {reason}"
        else:
            raise ValueError(f"Unknown action type: {action_type}")

        user.balancePaise = balance_after

        tx = WalletTransaction(
            userId=user.id,
            type="ADMIN_ADJUSTMENT",
            amountPaise=amount_paise,
            balanceBeforePaise=balance_before,
            balanceAfterPaise=balance_after,
            description=desc,
        )
        session.add(tx)

        admin_act = AdminAction(
            adminTelegramId=str(admin_telegram_id),
            action=f"BALANCE_{action_type}",
            targetUserId=user.id,
            action_metadata=json.dumps({
                "amountPaise": amount_paise,
                "balanceBefore": balance_before,
                "balanceAfter": balance_after,
                "reason": reason,
            }),
        )
        session.add(admin_act)
        await session.commit()
        await session.refresh(user)

        logger.info(f"Admin {admin_telegram_id} adjusted balance for {user.telegramId}: {action_type} {amount_paise} paise. New: {balance_after}")

        return {
            "user": user,
            "balanceBefore": balance_before,
            "balanceAfter": balance_after,
            "amountPaise": amount_paise,
        }

async def get_user_transactions(user_id: str, limit: int = 10) -> List[WalletTransaction]:
    async with get_session() as session:
        result = await session.execute(
            select(WalletTransaction)
            .where(WalletTransaction.userId == user_id)
            .order_by(WalletTransaction.createdAt.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
