# META ACCOUNTS BOT

Production-ready Telegram Bot and inventory management system for authorized digital account inventory. Built with Node.js, Express, Prisma ORM, and PostgreSQL. Deployable directly to Render.

---

## 1. Project Overview

**META ACCOUNTS BOT** provides an automated e-commerce solution for selling authorized accounts directly through Telegram.

### Key Capabilities:
- **Admin Batch Stock Ingestion:** Seamless import of TXT files containing batches of 10 accounts with duplicate protection.
- **Mandatory Channel Membership:** Gatekeeps access using Telegram's `getChatMember` API.
- **Financial Safety:** All monetary accounting stored in integer paise (₹1 = 100 paise) avoiding JavaScript float inaccuracies.
- **Atomic Purchases:** Uses PostgreSQL transactions with `FOR UPDATE SKIP LOCKED` row locking to prevent race conditions or duplicate deliveries.
- **Direct Telegram Delivery:** Delivered directly inside chat messages (split automatically to adhere to Telegram's 4096-character limit), never as downloadable files.
- **Manual Payment Verification:** Customer submits UTR or payment screenshot; admins approve or reject with one click.
- **Referral & Bonus System:** ₹3 welcome bonus on first registration, ₹2 referral rewards upon verified invite.
- **Render Ready:** Includes Express health check endpoints (`/` and `/health`) and graceful shutdown handlers.

---

## 2. Requirements

- **Node.js:** v18.0.0 or higher (v20+ recommended)
- **PostgreSQL:** v14 or higher (local or managed PostgreSQL instance on Render)
- **Telegram Bot Token:** Obtained from [@BotFather](https://t.me/BotFather)

---

## 3. Installation

Clone or download the repository, then install dependencies:

```bash
cd META-ACC-BOT
npm install
```

This runs `prisma generate` automatically via `postinstall`.

---

## 4. Environment Variables

Create a `.env` file in the root directory based on `.env.example`:

```env
# Node Environment
NODE_ENV=production
PORT=10000

# Telegram Bot Credentials
BOT_TOKEN=your_bot_token_here
BOT_USERNAME=your_bot_username

# PostgreSQL Database Connection URL
DATABASE_URL=postgresql://username:password@hostname:5432/database_name?schema=public

# Admin Telegram IDs (comma-separated if multiple)
ADMIN_IDS=5232576810

# Required Telegram Channel Join Verification
CHANNEL_USERNAME=https://t.me/+IMLxlk2X0tIxNWVl
CHANNEL_ID=-1004483464492

# Payment Configuration (UPI)
PAYMENT_UPI_ID=xdsellerkeshav@fam
PAYMENT_NAME=LEGEND

# Economics & Pricing (in integer paise: ₹1 = 100 paise)
ACCOUNT_PRICE_PAISE=5000     # ₹50.00 per account
WELCOME_BONUS_PAISE=300      # ₹3.00 welcome bonus
REFERRAL_REWARD_PAISE=200     # ₹2.00 referral reward
MIN_DEPOSIT_PAISE=100        # ₹1.00 minimum deposit

# Optional Webhook URL (leave empty for polling mode during development)
# Example: https://your-app.onrender.com
WEBHOOK_URL=
```

---

## 5. PostgreSQL & Prisma Setup

### Initialize Database Schema

For initial local setup:
```bash
npx prisma migrate dev --name init
```

For production deployment (e.g. Render build/start):
```bash
npx prisma migrate deploy
```

To explore or modify data using Prisma Studio:
```bash
npx prisma studio
```

---

## 6. Telegram Bot Setup

1. Open [@BotFather](https://t.me/BotFather) on Telegram.
2. Send `/newbot` and follow the prompts to create your bot.
3. Copy the HTTP API token into `BOT_TOKEN`.
4. (Optional) Set your bot commands in BotFather:
   ```
   start - Open main menu & register
   balance - Check wallet balance & metrics
   buy - Buy accounts in multiples of 10
   deposit - Add funds to wallet
   purchases - View purchased orders history
   transactions - View wallet transaction ledger
   referral - Get referral link & earnings
   help - Get customer support
   admin - Open Admin Control Dashboard
   ```

---

## 7. Admin ID Setup

1. Obtain your personal Telegram numeric User ID from [@userinfobot](https://t.me/userinfobot).
2. Set `ADMIN_IDS` in your `.env` file. You can specify multiple admins by separating IDs with commas:
   ```env
   ADMIN_IDS=5232576810,123456789
   ```
3. Only users whose IDs match will have access to admin commands (`/admin`, `/stock`, `/payments`, etc.) and stock TXT ingestion.

---

## 8. Required Channel Setup

1. Create a public or private Telegram channel.
2. Add your Telegram Bot as an **Administrator** in the channel with permissions to invite/view members.
3. If public:
   - `CHANNEL_USERNAME=@YourChannelName`
   - `CHANNEL_ID=@YourChannelName` (or its numeric ID)
4. If private:
   - `CHANNEL_USERNAME=https://t.me/+YourInviteLink`
   - `CHANNEL_ID=-100XXXXXXXXXX` (the -100 numeric chat ID)

---

## 9. Local Development

Start the service with live reload:
```bash
npm run dev
```

During local development, leave `WEBHOOK_URL` empty in `.env`. The bot will automatically run in **Long Polling** mode.

---

## 10. Render Deployment

The repository includes `render.yaml` for 1-click or Git deployment.

### Steps on Render:
1. Connect your GitHub repository to [Render](https://render.com).
2. Create a **PostgreSQL Database** on Render (e.g. named `meta-acc-db`).
3. Create a **Web Service** on Render with:
   - **Environment:** `Node`
   - **Build Command:** `npm install && npx prisma generate && npx prisma migrate deploy`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
4. Add all environment variables from Section 4 in the Render dashboard:
   - `DATABASE_URL` (use Internal Database URL from Render Postgres)
   - `BOT_TOKEN`
   - `ADMIN_IDS`
   - `CHANNEL_USERNAME`
   - `CHANNEL_ID`
   - `PAYMENT_UPI_ID`
   - `PAYMENT_NAME`
   - `WEBHOOK_URL` (optional: `https://your-service.onrender.com`)

---

## 11. TXT Stock Format

Admins can forward or upload `.txt` inventory files directly to the bot.

### Format Specifications:
- Exactly **10 accounts** per file. Files with 9 or 11 accounts are rejected entirely.
- Each record must include `full name -`, `email -`, `password -`, and `created on`.
- Repeated headers like `Account #1` are cleanly handled and re-indexed sequentially.

### Example Valid Stock File:
```text
=========================================
META ACCOUNTS BATCH #16
Generated: 29/09/2026, 13:14:47 IST
Total Accounts: 10
=========================================

Account #1
-----------------------------------------
full name - Neha Banerjee
email - neha2124@legendtech.store
password - 654654@@

created on (29/09/2026, 13:10:02 IST)

Account #1
-----------------------------------------
full name - Preeti Mishra
email - preeti9398@legendtech.store
password - 654654@@

created on (29/09/2026, 13:10:28 IST)
```

---

## 12. Customer Purchase Flow

1. Customer taps **🛒 Buy Accounts** (or `/buy`).
2. Bot displays available stock and allowable quantities in multiples of 10 (`10`, `20`, `30`...).
3. Customer selects desired quantity and reviews the Order Summary.
4. Upon tapping **✅ Confirm Purchase**:
   - PostgreSQL transaction locks available rows using `SELECT ... FOR UPDATE SKIP LOCKED`.
   - Checks user wallet balance >= total price.
   - Marks accounts `SOLD` with `soldToUserId` and `soldAt`.
   - Records `Order`, `OrderItem`, and `WalletTransaction`.
   - Immediately delivers accounts directly via Telegram text messages.
   - Sends order receipt message with Order ID `#ORD-XXXXXX`.

---

## 13. Payment & Approval Flow

1. Customer taps **➕ Add Funds** (or `/deposit`).
2. Enters amount (minimum ₹1.00).
3. Bot presents UPI payment instructions (`PAYMENT_UPI_ID` and `PAYMENT_NAME`).
4. Customer selects:
   - **🔢 Submit UTR:** Types 12-digit transaction reference number.
   - **📷 Upload Screenshot:** Sends image proof.
5. A `PENDING` payment is created and immediately forwarded to all configured `ADMIN_IDS` with inline `[✅ Approve]` and `[❌ Reject]` buttons.
6. When an admin taps **✅ Approve**:
   - Atomic transaction validates payment is still `PENDING` (idempotency guard).
   - Credits the user's wallet balance.
   - Creates a `DEPOSIT` wallet transaction.
   - Notifies the customer of successful deposit and updated balance.

---

## 14. Referral System

- Every registered customer receives a unique link: `https://t.me/<BOT_USERNAME>?start=<REF_CODE>`.
- When an invited friend joins:
  - Friend must complete required channel verification.
  - Referrer receives ₹2.00 referral reward.
  - Referrer receives Telegram notification with updated balance.
  - Admins receive referral activity notification.
  - Built-in database constraints prevent self-referral, loops, and duplicate rewards.

---

## 15. Security & Safety

- **No Float Arithmetic:** All money amounts are stored and calculated in integer paise.
- **Zero Credential Exposure:** Passwords and tokens are sanitized by the logger and never printed in server logs or customer menus.
- **Concurrency Protection:** PostgreSQL row-level locks prevent double-spending or race condition stock allocation.
- **Admin Isolation:** All admin callbacks and commands verify Telegram ID against `ADMIN_IDS`.

---

## 16. Troubleshooting

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| `BOT_TOKEN is required` | Missing in `.env` | Ensure `.env` is loaded and `BOT_TOKEN` is set. |
| `Channel membership check failed` | Bot not in channel | Add bot as Administrator to the target channel. |
| `STOCK IMPORT FAILED (Expected 10)` | File has != 10 accounts | Ensure TXT contains exactly 10 account blocks. |
| `Duplicate account detected` | Email already exists in DB | Ensure uploaded stock accounts have unique emails. |
| `Insufficient balance` | User balance too low | Add funds via `/deposit` and get admin approval. |
