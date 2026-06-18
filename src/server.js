const express = require('express');
const bot = require('./bot');
const { getTelegramChatId } = require('./repository/telegramChatRepo');
const patientCompletionApi = require('./api/patientCompletionApi');
const doctorReminderApi = require('./api/doctorReminderApi');
const supabase = require('./supabase');
const { startScheduler, stopScheduler, runAppointmentReminderCycle } = require('./services/messageScheduler');
const { startDoctorReminderScheduler, stopDoctorReminderScheduler, runDoctorReminderCycle } = require('./services/doctorReminderService');
const dailySummaryService = require('./services/dailySummaryService');
const { registerWebhookRoute, deleteTelegramWebhook } = require('./services/telegramWebhookService');
const { isWebhookMode } = require('./utils/telegramMode');

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

if (isWebhookMode()) {
  registerWebhookRoute(app, bot);
}

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

app.use('/api/doctors', checkApiKey, doctorReminderApi);

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

// Patient completion API routes
app.use('/api/patients', patientCompletionApi);

// Scheduler holatini tekshirish
app.get('/api/scheduler/status', (req, res) => {
  const { isSchedulerRunning } = require('./services/messageScheduler');
  res.json({
    running: isSchedulerRunning(),
    checkInterval: '30 seconds'
  });
});

app.post('/api/scheduler/appointments/run', checkApiKey, async (req, res) => {
  try {
    const stats = await runAppointmentReminderCycle();
    res.json({
      ok: true,
      stats,
    });
  } catch (error) {
    console.error('Appointment reminder run endpoint xatolik:', error);
    res.status(500).json({
      ok: false,
      error: 'APPOINTMENT_REMINDER_RUN_FAILED',
      message: error.message,
    });
  }
});

app.post('/api/scheduler/doctors/run', checkApiKey, async (req, res) => {
  try {
    const stats = await runDoctorReminderCycle();
    res.json({
      ok: true,
      stats,
    });
  } catch (error) {
    console.error('Doctor reminder run endpoint xatolik:', error);
    res.status(500).json({
      ok: false,
      error: 'DOCTOR_REMINDER_RUN_FAILED',
      message: error.message,
    });
  }
});

// Debug endpoint: Supabase connectivity check
app.get('/api/debug/supabase', checkApiKey, async (req, res) => {
  try {
    // Try a lightweight query. If your DB doesn't have `telegram_chat_ids`,
    // this will return an error that helps diagnose migrations/permissions.
    const { data, error } = await supabase
      .from('telegram_chat_ids')
      .select('patient_id')
      .limit(1);

    if (error) {
      console.error('Supabase debug query error:', error);
      return res.status(500).json({ ok: false, error: 'SUPABASE_QUERY_FAILED', details: error });
    }

    return res.json({ ok: true, sample: data || [] });
  } catch (err) {
    console.error('Supabase debug exception:', err);
    return res.status(500).json({ ok: false, error: 'SUPABASE_EXCEPTION', message: String(err.message || err) });
  }
});

// Railway avtomatik PORT beradi, lekin default 3001
const PORT = process.env.PORT || 3001;

// Message scheduler ni ishga tushirish
startScheduler();
startDoctorReminderScheduler();

if (typeof dailySummaryService.initDailySummaries === 'function') {
  dailySummaryService.initDailySummaries();
} else {
  console.warn('⚠️ dailySummaryService.initDailySummaries topilmadi — kunlik hisobot o\'tkazib yuborildi');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM signali olindi, message scheduler to\'xtatilyapti...');
  stopScheduler();
  stopDoctorReminderScheduler();
  await deleteTelegramWebhook(bot);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT signali olindi, message scheduler to\'xtatilyapti...');
  stopScheduler();
  stopDoctorReminderScheduler();
  await deleteTelegramWebhook(bot);
});

module.exports = { app, PORT };
