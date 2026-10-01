import asyncio
import sys
import io

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from bot_python.utils.formatter import format_paise, parse_rupees_to_paise, format_date_ist
from bot_python.utils.parser import parse_stock_file
from bot_python.utils.splitter import split_delivery_messages
from bot_python.utils.qrcode_gen import generate_upi_pay_string, generate_upi_qr_bytes
from bot_python.utils.cache import cache
from bot_python.config import config
from bot_python.database import get_session
from bot_python.models import User, Account
from sqlalchemy import select, func

def test_formatter():
    print("Testing Currency Formatter & Parser...")
    assert format_paise(300) == "₹3.00", f"Expected ₹3.00, got {format_paise(300)}"
    assert format_paise(0) == "₹0.00"
    assert format_paise(1050) == "₹10.50"

    p1 = parse_rupees_to_paise("50")
    assert p1["valid"] and p1["paise"] == 5000

    p2 = parse_rupees_to_paise("3.50")
    assert p2["valid"] and p2["paise"] == 350

    p3 = parse_rupees_to_paise("-5")
    assert not p3["valid"]

    p4 = parse_rupees_to_paise("abc")
    assert not p4["valid"]
    print("[OK] Currency tests passed.\n")

def test_parser():
    print("Testing Stock TXT Parser...")
    valid_sample = """
=========================================
META ACCOUNTS BATCH #16
Generated: 29/09/2026, 13:14:47 IST
Total Accounts: 10
=========================================
""" + "".join([f"""
Account #{i}
-----------------------------------------
full name - User {i}
email - user{i}@domain.com
password - pass123!

created on (29/09/2026, 13:10:0{i} IST)
""" for i in range(1, 11)])

    parsed = parse_stock_file(valid_sample)
    assert parsed["success"], f"Parsing failed: {parsed.get('error')}"
    assert parsed["count"] == 10
    assert parsed["batchNumber"] == 16
    assert parsed["accounts"][0]["email"] == "user1@domain.com"

    # Test invalid count (< 10)
    invalid_sample = """
Account #1
-----------------------------------------
full name - Single User
email - single@domain.com
password - pass123!

created on (29/09/2026, 13:10:01 IST)
"""
    inv_parsed = parse_stock_file(invalid_sample)
    assert not inv_parsed["success"], "Should fail when accounts != 10"

    # Test duplicate emails in file
    dup_sample = valid_sample.replace("user2@domain.com", "user1@domain.com")
    dup_parsed = parse_stock_file(dup_sample)
    assert not dup_parsed["success"], "Should fail when duplicate email in file"
    print("[OK] Stock TXT Parser tests passed.\n")

def test_splitter():
    print("Testing Telegram Message Splitter...")
    accounts = [
        {
            "fullName": f"Person {i}",
            "email": f"person{i}@domain.com",
            "password": "Password999!!",
            "createdOn": "01/10/2026, 12:00:00 IST",
        }
        for i in range(1, 51)
    ]
    parts = split_delivery_messages(accounts)
    assert len(parts) > 1, f"Expected multiple parts, got {len(parts)}"
    for part in parts:
        assert len(part) <= 4000, f"Part exceeds 4000 chars: {len(part)}"
    assert "Account #1" in parts[0]
    assert "Account #50" in parts[-1]
    print(f"[OK] Split 50 accounts into {len(parts)} Telegram messages successfully.\n")

def test_qrcode():
    print("Testing UPI QR Code Generator...")
    pay_url = generate_upi_pay_string("xdsellerkeshav@fam", "LEGEND", 5000)
    assert pay_url == "upi://pay?pa=xdsellerkeshav@fam&pn=LEGEND&am=50.00&cu=INR", f"Got {pay_url}"

    qr_bytes = generate_upi_qr_bytes("xdsellerkeshav@fam", "LEGEND", 5000)
    assert isinstance(qr_bytes, bytes)
    assert len(qr_bytes) > 500
    assert qr_bytes.startswith(b"\x89PNG\r\n\x1a\n"), "Must be a valid PNG image"
    print("[OK] UPI QR Code tests passed.\n")

def test_cache():
    print("Testing In-Memory High-Speed Cache...")
    cache.set("foo", 123, 10.0)
    assert cache.get("foo") == 123
    cache.delete("foo")
    assert cache.get("foo") is None
    print("[OK] Memory Cache tests passed.\n")

async def test_database():
    print("Testing Async Database Connection (Supabase)...")
    async with get_session() as session:
        user_cnt = (await session.execute(select(func.count(User.id)))).scalar()
        acc_cnt = (await session.execute(select(func.count(Account.id)))).scalar()
        print(f"[OK] Connected to Supabase via Async SQLAlchemy! Users: {user_cnt}, Accounts: {acc_cnt}\n")

async def main():
    print("=========================================================")
    print("   RUNNING AUTOMATED PYTHON TESTS (META ACCOUNTS BOT)")
    print("=========================================================\n")
    test_formatter()
    test_parser()
    test_splitter()
    test_qrcode()
    test_cache()
    await test_database()
    print("ALL AUTOMATED PYTHON TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.run(main(), loop_factory=asyncio.SelectorEventLoop)
    else:
        asyncio.run(main())
