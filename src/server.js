const express = require('express');
const bot = require('./bot');
const { getTelegramChatId } = require('./repository/telegramChatRepo');

const app = express();

// CORS sozlash (ShifoCRM frontend uchun)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // Production'da aniq domain ko'rsating
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-API-KEY');
  
  // Preflight request'lar uchun
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// API key tekshirish (agar mavjud bo'lsa)
const apiKey = process.env.BOT_API_KEY;

function checkApiKey(req, res, next) {
  if (!apiKey) {
    // API key yo'q, o'tkazib yuboradi
    return next();
  }
  const providedKey = req.headers['x-api-key'];
  if (providedKey !== apiKey) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  next();
}

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Xabar yuborish
app.post('/api/send', checkApiKey, async (req, res) => {
  const { patient_id, message } = req.body;
  if (!patient_id || !message) {
    return res.status(400).json({ error: 'PATIENT_ID_AND_MESSAGE_REQUIRED' });
  }
  try {
    const chatId = await getTelegramChatId(String(patient_id));
    if (!chatId) {
      return res.status(404).json({ error: 'CHAT_ID_NOT_FOUND' });
    }
    await bot.sendMessage(chatId, message);
    res.json({ ok: true });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

const PORT = process.env.PORT || 3001;

module.exports = { app, PORT };
