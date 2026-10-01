import re
from typing import Dict, Any, List, Optional

def parse_stock_file(content: str) -> Dict[str, Any]:
    if not content or not isinstance(content, str):
        return {
            "success": False,
            "error": "Empty or invalid file content",
            "accounts": [],
            "count": 0,
        }

    # 1. Extract batch number if present
    batch_number: Optional[int] = None
    batch_match = re.search(r"BATCH\s*#?\s*(\d+)", content, re.IGNORECASE)
    if batch_match:
        try:
            batch_number = int(batch_match.group(1))
        except ValueError:
            pass

    # 2. Normalize line breaks to \n
    normalized = content.replace("\r\n", "\n").replace("\r", "\n")

    # 3. Match accounts regex
    pattern = re.compile(
        r"full\s*name\s*[-:]\s*([^\n\r]+)\s*\n\s*email\s*[-:]\s*([^\n\r]+)\s*\n\s*password\s*[-:]\s*([^\n\r]+)\s*[\s\S]*?created\s*on\s*[-:]?\s*\(?([^\n\r()]+)\)?",
        re.IGNORECASE,
    )

    accounts: List[Dict[str, str]] = []
    for match in pattern.finditer(normalized):
        full_name = match.group(1).strip()
        email = match.group(2).strip().lower()
        password = match.group(3).strip()
        created_on = match.group(4).strip()

        if full_name and email and password and created_on:
            accounts.append({
                "fullName": full_name,
                "email": email,
                "password": password,
                "createdOn": created_on,
            })

    # 4. Strict 10-record validation
    if len(accounts) != 10:
        return {
            "success": False,
            "batchNumber": batch_number,
            "count": len(accounts),
            "accounts": [],
            "error": f"Expected: 10 accounts\nDetected: {len(accounts)} accounts\n\nNothing was added.",
        }

    # 5. Check intra-file duplicate emails
    seen_emails = set()
    duplicates = []
    for acc in accounts:
        if acc["email"] in seen_emails:
            duplicates.append(acc["email"])
        seen_emails.add(acc["email"])

    if duplicates:
        return {
            "success": False,
            "batchNumber": batch_number,
            "count": len(accounts),
            "accounts": [],
            "error": f"Duplicate accounts found within the same file:\n{', '.join(duplicates)}",
        }

    return {
        "success": True,
        "batchNumber": batch_number,
        "count": len(accounts),
        "accounts": accounts,
    }
