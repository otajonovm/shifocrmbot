#!/usr/bin/env node
/**
 * Telegram webhook ni local kompyuterdan o'rnatish.
 * Pod api.telegram.org ga chiqa olmasa shu skriptdan foydalaning.
 *
 * Usage:
 *   node scripts/set-webhook.js
 *   node scripts/set-webhook.js https://sea-lion-app-9vj5b.ondigitalocean.app
 */

const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const baseUrl = (process.argv[2] || process.env.PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '');
const webhookPath = process.env.TELEGRAM_WEBHOOK_PATH || '/telegram/webhook';

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN topilmadi (.env yoki environment)');
  process.exit(1);
}

if (!baseUrl) {
  console.error('❌ URL kerak: node scripts/set-webhook.js https://sea-lion-app-9vj5b.ondigitalocean.app');
  process.exit(1);
}

const webhookUrl = `${baseUrl}${webhookPath.startsWith('/') ? webhookPath : `/${webhookPath}`}`;

async function main() {
  const body = {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  };

  if (secret) {
    body.secret_token = secret;
  }

  console.log(`🔗 Webhook o'rnatilmoqda: ${webhookUrl}`);

  const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const setData = await setRes.json();

  if (!setData.ok) {
    console.error('❌ setWebhook xatolik:', setData.description || setData);
    process.exit(1);
  }

  console.log('✅ Webhook o\'rnatildi');

  const commandsRes = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Botni boshlash' },
        { command: 'register', description: "Ro'yxatdan o'tish" },
        { command: 'balance', description: 'Keshbek balansi' },
        { command: 'referral', description: "Do'stni taklif qilish" },
        { command: 'help', description: 'Yordam' },
        { command: 'language', description: "Tilni o'zgartirish" },
      ],
    }),
  });
  const commandsData = await commandsRes.json();
  if (commandsData.ok) {
    console.log('✅ Bot buyruqlari yangilandi (/balance, /referral)');
  } else {
    console.warn('⚠️ setMyCommands:', commandsData.description || commandsData);
  }

  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const infoData = await infoRes.json();
  console.log('📋 getWebhookInfo:', JSON.stringify(infoData.result, null, 2));
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
