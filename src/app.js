const express = require('express');
const logger = require('./utils/logger');
const config = require('./config');
const { getAvailableCount } = require('./services/stock.service');

const createApp = (bot = null) => {
  const app = express();

  app.use(express.json());

  // Render Health Check Endpoints
  app.get('/', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'telegram-account-bot',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      uptime: process.uptime(),
    });
  });

  // Telegram WebApp UI serving the exact button color styles from the user's design reference
  app.get('/webapp', async (req, res) => {
    let availableStock = 0;
    try {
      availableStock = await getAvailableCount();
    } catch {
      availableStock = 0;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>META ACCOUNTS STORE</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      background-color: #0B1520;
      color: #ffffff;
      padding: 20px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
      width: 100%;
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.1);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 14px;
      color: #8be9fd;
      margin-top: 6px;
    }
    .btn-container {
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
      max-width: 420px;
    }
    .btn {
      width: 100%;
      padding: 18px 20px;
      border: none;
      border-radius: 14px;
      color: #ffffff;
      font-size: 17px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 16px;
      cursor: pointer;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
      transition: transform 0.1s ease, filter 0.1s ease;
      text-decoration: none;
    }
    .btn:active {
      transform: scale(0.98);
      filter: brightness(0.9);
    }
    .btn-green {
      background-color: #347D32;
    }
    .btn-blue {
      background-color: #2F748B;
    }
    .btn-red {
      background-color: #9B463A;
    }
    .btn-icon {
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .footer {
      margin-top: auto;
      padding-top: 24px;
      font-size: 13px;
      color: #6272a4;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">⚡ META ACCOUNTS STORE</div>
    <div class="badge">📦 In Stock: ${availableStock} Accounts | ₹3 / Account</div>
  </div>

  <div class="btn-container">
    <button class="btn btn-green" onclick="sendAction('/buy')">
      <span class="btn-icon">🛒</span>
      <span>Buy Accounts (₹3 / each)</span>
    </button>

    <button class="btn btn-blue" onclick="sendAction('/stock')">
      <span class="btn-icon">📦</span>
      <span>Check Available Stock (${availableStock})</span>
    </button>

    <button class="btn btn-blue" onclick="sendAction('/balance')">
      <span class="btn-icon">💰</span>
      <span>My Balance & Add Funds</span>
    </button>

    <button class="btn btn-blue" onclick="sendAction('/purchases')">
      <span class="btn-icon">📋</span>
      <span>My Purchased Orders</span>
    </button>

    <button class="btn btn-blue" onclick="sendAction('/referral')">
      <span class="btn-icon">👥</span>
      <span>Refer & Earn (₹2 / friend)</span>
    </button>

    <button class="btn btn-red" onclick="sendAction('/support')">
      <span class="btn-icon">📞</span>
      <span>Customer Support</span>
    </button>
  </div>

  <div class="footer">
    Official META Accounts Inventory &bull; Instant Delivery
  </div>

  <script>
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
    function sendAction(cmd) {
      if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.sendData(cmd);
        window.Telegram.WebApp.close();
      } else {
        alert("Command: " + cmd);
      }
    }
  </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  // Attach Telegram Webhook if bot provided
  if (bot) {
    app.use(bot.webhookCallback('/telegram-webhook'));
  }

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
};

module.exports = {
  createApp,
};
