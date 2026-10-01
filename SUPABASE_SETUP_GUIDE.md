# ⚡ Supabase Setup Guide for META ACCOUNTS BOT

This guide shows you how to connect your **META ACCOUNTS BOT** to a **100% Free Supabase PostgreSQL Database**.

---

## 🌟 Why Use Supabase?
- **100% Free Forever** (up to 500 MB database, enough for 500,000+ accounts).
- **No Local PostgreSQL Needed:** You don't have to install or manage PostgreSQL on your RDP or PC.
- **Visual Web Dashboard:** View, search, edit, or delete accounts, users, and orders directly in your web browser using Supabase's **Table Editor**!
- **Works Anywhere:** Can be accessed simultaneously by your RDP, your local machine, or Render.

---

## 📋 Step-by-Step Instructions

### Step 1: Create a Free Account on Supabase
1. Go to **[https://supabase.com](https://supabase.com)**.
2. Click **Start your project** and sign in with GitHub or your email.

---

### Step 2: Create a New Project
1. In your Supabase dashboard, click **+ New Project**.
2. Fill in the project details:
   - **Name:** `meta-accounts` (or any name)
   - **Database Password:** Choose a strong password and **SAVE IT** (you will need it in your connection string).
   - **Region:** Choose the region closest to your RDP/location (e.g. *Singapore [ap-southeast-1]* for Asia/India, or *Frankfurt* for Europe).
   - **Pricing Plan:** Select **Free** ($0/month).
3. Click **Create new project**.
4. Wait 1–2 minutes while Supabase sets up your database.

---

### Step 3: Copy Your Database Connection URL
Once the project is created:
1. Click the green **Connect** button at the top header of the Supabase dashboard (or go to **Project Settings** (gear icon) ➔ **Database**).
2. Click on the **URI** tab.
3. Select **Mode: Session** (Port `5432`).
4. You will see a connection string like this:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```
   *(Or direct: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`)*
5. Copy this URI and replace `[YOUR-PASSWORD]` with your actual password.

> **⚠️ Important Password Tip:**  
> If your database password contains special characters like `@`, `#`, `$`, or `%`, make sure to URL-encode them (e.g. `@` becomes `%40`, `#` becomes `%23`), or create a password using only letters and numbers (e.g. `MetaBot2026Pass`).

---

### Step 4: Add to your `.env` File
Open your `.env` file in the bot folder and paste your connection string into `DATABASE_URL`:

```env
DATABASE_URL="postgresql://postgres.abcdefghijklmno:YourPasswordHere@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

---

### Step 5: Push Database Tables to Supabase
Open your terminal/command prompt in the bot folder and run:

```bash
npx prisma db push
```

*(If you are on Windows RDP, simply double-clicking **`run.bat`** automatically runs this for you!)*

You will see:
```
✔ The database is already in sync with the Prisma schema.
Generating Prisma Client...
✔ Generated Prisma Client
```

---

### Step 6: View Your Data in Supabase Web Dashboard!
1. Go back to your **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Click on **Table Editor** (the table grid icon on the left menu).
3. You will see all your bot tables created automatically:
   - `User` — All customers and their wallet balances
   - `Account` — Available and sold account credentials
   - `StockBatch` — Batches of uploaded stock
   - `Order` — Customer purchase orders
   - `Payment` — Deposit screenshot requests and status
   - `WalletTransaction` — Full accounting ledger
   - `Referral` — Referral tracking

---

## 🚀 Step 7: Launch the Bot!
- On **Windows RDP**: Double-click `run.bat` or `start-pm2.bat`.
- On **Linux**: Run `./start.sh` or `npm run pm2:start`.
- On **Render**: Set `DATABASE_URL` in the Render Environment tab to your Supabase connection string.
