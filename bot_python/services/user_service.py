import secrets
import logging
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy import select, update, func, or_
from sqlalchemy.orm import selectinload

from bot_python.database import get_session
from bot_python.models import User, WalletTransaction, Referral, Order, Account, AdminAction
from bot_python.config import config

logger = logging.getLogger(__name__)

def generate_referral_code(telegram_id: str) -> str:
    suffix = secrets.token_hex(3).upper()
    tid_suffix = str(telegram_id)[-4:] if len(str(telegram_id)) >= 4 else str(telegram_id)
    return f"REF{tid_suffix}{suffix}"

async def get_or_register_user(
    telegram_id: int | str,
    username: Optional[str] = None,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    start_payload: Optional[str] = None,
) -> Tuple[User, bool]:
    tid_str = str(telegram_id).strip()

    async with get_session() as session:
        # Check existing user
        result = await session.execute(select(User).where(User.telegramId == tid_str))
        existing_user = result.scalar_one_or_none()

        if existing_user:
            # Update profile if changed
            changed = False
            if existing_user.username != username:
                existing_user.username = username
                changed = True
            if existing_user.firstName != first_name:
                existing_user.firstName = first_name
                changed = True
            if existing_user.lastName != last_name:
                existing_user.lastName = last_name
                changed = True
            if changed:
                await session.commit()
                await session.refresh(existing_user)
            return existing_user, False

        # Look up referrer by start_payload
        referrer_id = None
        if start_payload:
            clean_code = start_payload.strip()
            ref_result = await session.execute(select(User).where(User.referralCode == clean_code))
            referrer = ref_result.scalar_one_or_none()
            if referrer and referrer.telegramId != tid_str:
                referrer_id = referrer.id

        welcome_bonus = config.welcome_bonus_paise
        ref_code = generate_referral_code(tid_str)

        new_user = User(
            telegramId=tid_str,
            username=username,
            firstName=first_name,
            lastName=last_name,
            referralCode=ref_code,
            referredById=referrer_id,
            balancePaise=welcome_bonus,
            welcomeBonusGiven=True,
        )
        session.add(new_user)
        await session.flush()

        # Add initial wallet transaction
        bonus_tx = WalletTransaction(
            userId=new_user.id,
            type="WELCOME_BONUS",
            amountPaise=welcome_bonus,
            balanceBeforePaise=0,
            balanceAfterPaise=welcome_bonus,
            description="Welcome Bonus",
        )
        session.add(bonus_tx)
        await session.commit()
        await session.refresh(new_user)

        logger.info(f"New user registered: {tid_str} with {welcome_bonus} paise bonus")
        return new_user, True

async def get_user_by_telegram_id(telegram_id: int | str) -> Optional[User]:
    tid_str = str(telegram_id).strip()
    async with get_session() as session:
        result = await session.execute(select(User).where(User.telegramId == tid_str))
        return result.scalar_one_or_none()

async def get_user_by_id(user_id: str) -> Optional[User]:
    async with get_session() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

async def process_referral_reward(referred_user_id: str) -> Optional[Dict[str, Any]]:
    async with get_session() as session:
        result = await session.execute(select(User).where(User.id == referred_user_id))
        user = result.scalar_one_or_none()

        if not user or not user.referredById or user.referralRewardGiven:
            return None

        # Lock referrer
        ref_result = await session.execute(
            select(User).where(User.id == user.referredById).with_for_update()
        )
        referrer = ref_result.scalar_one_or_none()
        if not referrer:
            return None

        if referrer.id == user.id or referrer.telegramId == user.telegramId:
            return None

        # Check existing referral record
        existing_ref = await session.execute(
            select(Referral).where(Referral.referredUserId == user.id)
        )
        if existing_ref.scalar_one_or_none():
            return None

        reward_paise = config.referral_reward_paise
        balance_before = referrer.balancePaise
        balance_after = balance_before + reward_paise

        referrer.balancePaise = balance_after
        user.referralRewardGiven = True

        referral_record = Referral(
            referrerId=referrer.id,
            referredUserId=user.id,
            rewardPaise=reward_paise,
            status="COMPLETED",
        )
        session.add(referral_record)
        await session.flush()

        tx = WalletTransaction(
            userId=referrer.id,
            type="REFERRAL_REWARD",
            amountPaise=reward_paise,
            balanceBeforePaise=balance_before,
            balanceAfterPaise=balance_after,
            referenceId=referral_record.id,
            description=f"Referral reward for inviting @{user.username or user.telegramId}",
        )
        session.add(tx)
        await session.commit()

        logger.info(f"Referral reward {reward_paise} credited to {referrer.telegramId}")
        return {
            "referrer_telegram_id": referrer.telegramId,
            "reward_paise": reward_paise,
            "new_balance_paise": balance_after,
        }

async def get_user_referral_stats(user_id: str) -> Dict[str, Any]:
    async with get_session() as session:
        count_res = await session.execute(
            select(func.count(User.id)).where(User.referredById == user_id)
        )
        total_count = count_res.scalar() or 0

        sum_res = await session.execute(
            select(func.sum(Referral.rewardPaise)).where(
                Referral.referrerId == user_id, Referral.status == "COMPLETED"
            )
        )
        total_earned = sum_res.scalar() or 0

        return {
            "totalCount": total_count,
            "totalEarnedPaise": total_earned,
        }

async def search_users(query: str) -> List[User]:
    if not query:
        return []
    clean = query.strip()
    async with get_session() as session:
        result = await session.execute(
            select(User)
            .where(
                or_(
                    User.telegramId.ilike(f"%{clean}%"),
                    User.username.ilike(f"%{clean}%"),
                    User.firstName.ilike(f"%{clean}%"),
                    User.lastName.ilike(f"%{clean}%"),
                )
            )
            .order_by(User.createdAt.desc())
            .limit(10)
        )
        return list(result.scalars().all())

async def get_user_profile_details(user_id: str) -> Optional[Dict[str, Any]]:
    async with get_session() as session:
        user_res = await session.execute(select(User).where(User.id == user_id))
        user = user_res.scalar_one_or_none()
        if not user:
            return None

        orders_count = (await session.execute(
            select(func.count(Order.id)).where(Order.userId == user_id)
        )).scalar() or 0

        accs_count = (await session.execute(
            select(func.count(Account.id)).where(Account.soldToUserId == user_id)
        )).scalar() or 0

        refs_count = (await session.execute(
            select(func.count(User.id)).where(User.referredById == user_id)
        )).scalar() or 0

        return {
            "user": user,
            "orderCount": orders_count,
            "purchasedAccountsCount": accs_count,
            "referralCount": refs_count,
        }

async def set_user_restriction(user_id: str, is_restricted: bool, admin_telegram_id: str) -> Optional[User]:
    async with get_session() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            return None

        user.isRestricted = is_restricted
        admin_act = AdminAction(
            adminTelegramId=str(admin_telegram_id),
            action="RESTRICT_USER" if is_restricted else "UNRESTRICT_USER",
            targetUserId=user_id,
        )
        session.add(admin_act)
        await session.commit()
        await session.refresh(user)
        return user
