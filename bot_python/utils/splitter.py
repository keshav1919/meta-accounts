from typing import List, Any
from bot_python.utils.formatter import format_account_item

MAX_CHARS_PER_MESSAGE = 3500

def split_delivery_messages(accounts: List[Any]) -> List[str]:
    if not accounts:
        return []

    formatted_items = [
        {"number": idx + 1, "text": format_account_item(acc, idx + 1)}
        for idx, acc in enumerate(accounts)
    ]

    chunks = []
    current_chunk = []
    current_len = 0

    for item in formatted_items:
        item_len = len(item["text"]) + 2
        if current_len + item_len > MAX_CHARS_PER_MESSAGE and current_chunk:
            chunks.append(current_chunk)
            current_chunk = [item]
            current_len = item_len
        else:
            current_chunk.append(item)
            current_len += item_len

    if current_chunk:
        chunks.append(current_chunk)

    total_parts = len(chunks)

    if total_parts == 1:
        body = "\n\n".join(item["text"] for item in chunks[0])
        return [f"📦 YOUR ACCOUNTS\n\n{body}"]

    messages = []
    for index, chunk in enumerate(chunks):
        part_num = index + 1
        body = "\n\n".join(item["text"] for item in chunk)
        messages.append(f"📦 ACCOUNTS — PART {part_num}/{total_parts}\n\n{body}")

    return messages
