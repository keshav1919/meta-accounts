from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

IST_TIMEZONE = timezone(timedelta(hours=5, minutes=30))

def format_paise(paise: int | float | None) -> str:
    if paise is None:
        return "₹0.00"
    p = int(paise)
    rupees = p / 100.0
    return f"₹{rupees:.2f}"

def parse_rupees_to_paise(text: str) -> Dict[str, Any]:
    if not text:
        return {"valid": False, "error": "Amount is required"}
    clean = text.strip().replace("₹", "").replace(",", "")
    try:
        val = float(clean)
        if val <= 0:
            return {"valid": False, "error": "Amount must be greater than ₹0"}
        # Round to 2 decimals and convert to paise
        paise = int(round(val * 100))
        return {"valid": True, "paise": paise, "rupees": val}
    except ValueError:
        return {"valid": False, "error": "Invalid amount. Please enter a valid number (e.g. 50 or 100)."}

def format_date_ist(dt: Optional[datetime]) -> str:
    if not dt:
        return "N/A"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    ist_time = dt.astimezone(IST_TIMEZONE)
    return ist_time.strftime("%d %b %Y, %H:%M:%S IST")

def format_account_item(account: Any, index: int) -> str:
    full_name = getattr(account, "fullName", None) or account.get("fullName", "")
    email = getattr(account, "email", None) or account.get("email", "")
    password = getattr(account, "password", None) or account.get("password", "")
    created_on = getattr(account, "createdOn", None) or account.get("createdOn", "")

    return (
        f"Account #{index}\n"
        f"-----------------------------------------\n"
        f"full name - {full_name}\n"
        f"email - {email}\n"
        f"password - {password}\n\n"
        f"created on ({created_on})"
    )
