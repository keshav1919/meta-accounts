import os
from typing import List, Set
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    def __init__(self):
        self.bot_token: str = os.getenv("BOT_TOKEN", "").strip()
        self.bot_username: str = os.getenv("BOT_USERNAME", "").strip().replace("@", "")
        
        # Raw database URL
        raw_db_url = os.getenv("DATABASE_URL", "").strip()
        if raw_db_url.startswith("postgresql://"):
            self.database_url = raw_db_url.replace("postgresql://", "postgresql+psycopg://", 1)
        elif raw_db_url.startswith("postgres://"):
            self.database_url = raw_db_url.replace("postgres://", "postgresql+psycopg://", 1)
        else:
            self.database_url = raw_db_url

        # Admin IDs
        admin_ids_str = os.getenv("ADMIN_IDS", "").strip()
        self.admin_ids: Set[str] = {
            aid.strip() for aid in admin_ids_str.split(",") if aid.strip()
        }

        # Telegram Channel Verification
        self.channel_username: str = os.getenv("CHANNEL_USERNAME", "").strip()
        self.channel_id: str = os.getenv("CHANNEL_ID", "").strip()

        # Payment details
        self.payment_upi_id: str = os.getenv("PAYMENT_UPI_ID", "xdsellerkeshav@fam").strip()
        self.payment_name: str = os.getenv("PAYMENT_NAME", "LEGEND").strip()

        # Pricing & Economics (in integer paise: ₹1 = 100 paise)
        self.account_price_paise: int = int(os.getenv("ACCOUNT_PRICE_PAISE", "300"))
        self.welcome_bonus_paise: int = int(os.getenv("WELCOME_BONUS_PAISE", "300"))
        self.referral_reward_paise: int = int(os.getenv("REFERRAL_REWARD_PAISE", "200"))
        self.min_deposit_paise: int = int(os.getenv("MIN_DEPOSIT_PAISE", "100"))

    def is_admin(self, telegram_id) -> bool:
        if not telegram_id:
            return False
        return str(telegram_id).strip() in self.admin_ids

config = Config()
