import json
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy import select, func, or_
from bot_python.database import get_session
from bot_python.models import StockBatch, Account, AdminAction
from bot_python.utils.parser import parse_stock_file
from bot_python.utils.cache import cache

logger = logging.getLogger(__name__)

CACHE_STOCK_KEY = "stock_available_count"

async def get_available_count() -> int:
    cached = cache.get(CACHE_STOCK_KEY)
    if isinstance(cached, int):
        return cached

    async with get_session() as session:
        result = await session.execute(
            select(func.count(Account.id)).where(Account.status == "AVAILABLE")
        )
        count = result.scalar() or 0
        cache.set(CACHE_STOCK_KEY, count, ttl_seconds=4.0)
        return count

def invalidate_stock_cache() -> None:
    cache.delete(CACHE_STOCK_KEY)

async def import_stock_txt(content: str, file_name: str, admin_telegram_id: str | int) -> Dict[str, Any]:
    # 1. Parse and validate file content
    parse_result = parse_stock_file(content)
    if not parse_result["success"]:
        return {
            "success": False,
            "error": parse_result.get("error", "Invalid file content"),
        }

    accounts_data = parse_result["accounts"]
    batch_number = parse_result["batchNumber"]

    emails = [a["email"] for a in accounts_data]

    async with get_session() as session:
        # Check duplicate emails in DB
        dup_result = await session.execute(
            select(Account.email).where(Account.email.in_(emails))
        )
        existing_emails = dup_result.scalars().all()

        if existing_emails:
            return {
                "success": False,
                "duplicateCount": len(existing_emails),
                "error": (
                    f"⚠️ Duplicate account(s) detected in database ({len(existing_emails)}):\n"
                    + "\n".join(existing_emails)
                    + "\n\nNothing was added. Batch was rejected."
                ),
            }

        # Determine batch number
        final_batch_number = batch_number
        if not final_batch_number:
            highest_res = await session.execute(
                select(StockBatch.batchNumber)
                .order_by(StockBatch.createdAt.desc())
                .limit(1)
            )
            highest_num = highest_res.scalar() or 0
            final_batch_number = highest_num + 1

        batch = StockBatch(
            batchNumber=final_batch_number,
            fileName=file_name or f"batch_{final_batch_number}.txt",
            totalAccounts=len(accounts_data),
        )
        session.add(batch)
        await session.flush()

        # Insert accounts
        for acc in accounts_data:
            new_acc = Account(
                batchId=batch.id,
                fullName=acc["fullName"],
                email=acc["email"],
                password=acc["password"],
                createdOn=acc["createdOn"],
                status="AVAILABLE",
            )
            session.add(new_acc)

        admin_act = AdminAction(
            adminTelegramId=str(admin_telegram_id),
            action="IMPORT_STOCK",
            action_metadata=json.dumps({
                "batchId": batch.id,
                "batchNumber": final_batch_number,
                "count": len(accounts_data),
            }),
        )
        session.add(admin_act)
        await session.commit()

        # Invalidate in-memory cache
        invalidate_stock_cache()

        logger.info(f"Imported stock Batch #{final_batch_number} ({len(accounts_data)} accounts) by {admin_telegram_id}")

        available_stock = await get_available_count()
        return {
            "success": True,
            "batchNumber": final_batch_number,
            "totalImported": len(accounts_data),
            "newAccounts": len(accounts_data),
            "duplicateCount": 0,
            "availableStock": available_stock,
        }

async def get_stock_stats() -> Dict[str, int]:
    async with get_session() as session:
        available = (await session.execute(select(func.count(Account.id)).where(Account.status == "AVAILABLE"))).scalar() or 0
        sold = (await session.execute(select(func.count(Account.id)).where(Account.status == "SOLD"))).scalar() or 0
        total = (await session.execute(select(func.count(Account.id)))).scalar() or 0
        batches = (await session.execute(select(func.count(StockBatch.id)))).scalar() or 0

        return {
            "available": available,
            "sold": sold,
            "totalImported": total,
            "batches": batches,
        }

async def search_accounts(query: str) -> List[Account]:
    if not query:
        return []
    clean = query.strip()
    async with get_session() as session:
        result = await session.execute(
            select(Account)
            .where(
                or_(
                    Account.email.ilike(f"%{clean}%"),
                    Account.fullName.ilike(f"%{clean}%"),
                )
            )
            .order_by(Account.createdAt.desc())
            .limit(10)
        )
        return list(result.scalars().all())
