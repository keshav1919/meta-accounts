require('dotenv').config();

const parseAdminIds = (raw) => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
};

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '10000', 10),

  botToken: process.env.BOT_TOKEN || '',
  botUsername: process.env.BOT_USERNAME || '',

  databaseUrl: process.env.DATABASE_URL || '',

  adminIds: parseAdminIds(process.env.ADMIN_IDS),

  channelUsername: process.env.CHANNEL_USERNAME || '',
  channelId: process.env.CHANNEL_ID || '',

  paymentUpiId: process.env.PAYMENT_UPI_ID || '',
  paymentName: process.env.PAYMENT_NAME || '',

  accountPricePaise: BigInt(process.env.ACCOUNT_PRICE_PAISE || '5000'), // default ₹50
  welcomeBonusPaise: BigInt(process.env.WELCOME_BONUS_PAISE || '300'), // ₹3
  referralRewardPaise: BigInt(process.env.REFERRAL_REWARD_PAISE || '200'), // ₹2
  minDepositPaise: BigInt(process.env.MIN_DEPOSIT_PAISE || '100'), // ₹1

  webhookUrl: process.env.WEBHOOK_URL || '',

  isAdmin(telegramId) {
    if (!telegramId) return false;
    const strId = String(telegramId).trim();
    return this.adminIds.includes(strId);
  },
};

module.exports = config;
