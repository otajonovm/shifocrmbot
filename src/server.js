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
const { isWebhookMode, getTelegramModeInfo, getWebhookUrl } = require('./utils/telegramMode');
const { testTelegramApiConnectivity } = require('./services/telegramConnectivityService');
const { corsMiddleware } = require('./middleware/cors');
const { createApiKeyMiddleware } = require('./middleware/checkApiKey');

const app = express();

app.use(corsMiddleware);
app.use(express.json());

if (isWebhookMode()) {
  registerWebhookRoute(app, bot);
}

const checkApiKey = createApiKeyMiddleware(
  process.env.BOT_API_KEY || process.env.VITE_TELEGRAM_API_KEY
);

app.use('/api/doctors', checkApiKey, doctorReminderApi);

app.get('/health', (req, res) => {
  const telegram = getTelegramModeInfo();
  res.json({
    ok: telegram.telegramReady !== false,
    telegram,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/debug/telegram', checkApiKey, async (req, res) => {
  const mode = getTelegramModeInfo();
  const connectivity = await testTelegramApiConnectivity();

  res.json({
    ok: connectivity.ok,
    mode,
    connectivity,
    webhookUrl: getWebhookUrl(),
    manualSetWebhook: getWebhookUrl()
      ? `curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" -H "Content-Type: application/json" -d "{\\"url\\":\\"${getWebhookUrl()}\\"}"`
      : null,
  });
});

app.post('/api/send', checkApiKey, async (req, res) => {
  const { patient_id, message, parse_mode: parseMode } = req.body;
  if (!patient_id || !message) {
    return res.status(400).json({ error: 'PATIENT_ID_AND_MESSAGE_REQUIRED' });
  }
  try {
    const chatId = await getTelegramChatId(String(patient_id));
    if (!chatId) {
      return res.status(404).json({ error: 'CHAT_ID_NOT_FOUND' });
    }
    await bot.sendMessage(chatId, message, {
      parse_mode: parseMode || 'HTML',
      disable_web_page_preview: true,
    });
    res.json({ ok: true });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

app.use('/api/patients', checkApiKey, patientCompletionApi);

app.get('/api/scheduler/status', checkApiKey, (req, res) => {
  const { isSchedulerRunning, getSchedulerDisabledReason } = require('./services/messageScheduler');
  res.json({
    running: isSchedulerRunning(),
    disabledReason: getSchedulerDisabledReason(),
    checkInterval: '30 seconds',
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

app.get('/api/debug/supabase', checkApiKey, async (req, res) => {
  try {
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

const PORT = process.env.PORT || 3001;

startScheduler();
startDoctorReminderScheduler();

if (typeof dailySummaryService.initDailySummaries === 'function') {
  dailySummaryService.initDailySummaries();
} else {
  console.warn('⚠️ dailySummaryService.initDailySummaries topilmadi — kunlik hisobot o\'tkazib yuborildi');
}

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
