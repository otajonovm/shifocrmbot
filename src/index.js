// Railway'da .env fayl bo'lmasligi mumkin, lekin environment variables mavjud
// dotenv faqat local development uchun (loyiha ildizidagi .env — cwd dan mustaqil)
const path = require('path');
const fs = require('fs');
const envPath = path.resolve(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else if (fs.existsSync(path.resolve(process.cwd(), '.env'))) {
  require('dotenv').config();
}

const {
  getTelegramModeInfo,
  getWebhookUrl,
  printCloudWebhookSetupInstructions,
} = require('./utils/telegramMode');
const { testTelegramApiConnectivity } = require('./services/telegramConnectivityService');

// Debug: Environment variables mavjudligini tekshirish
console.log('🔍 Environment variables tekshirilmoqda...');
console.log('   TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '✅ Mavjud' : '❌ Yo\'q');
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Mavjud' : '❌ Yo\'q');
console.log('   SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅ Mavjud' : '❌ Yo\'q');
console.log('   PORT:', process.env.PORT || '3001 (default)');
console.log('   HOST:', process.env.HOST || '0.0.0.0 (default)');
console.log('   PUBLIC_APP_URL:', process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.VITE_TELEGRAM_API_URL || '❌ Yo\'q');
console.log('   TELEGRAM_USE_WEBHOOK:', process.env.TELEGRAM_USE_WEBHOOK || '(default)');

const modePreview = getTelegramModeInfo();
console.log('   Telegram rejim:', modePreview.webhookMode ? 'WEBHOOK' : (modePreview.pollingAllowed ? 'POLLING' : 'DISABLED'));
console.log('   Cloud runtime:', modePreview.cloud ? '✅ Ha' : '❌ Yo\'q');
if (modePreview.webhookUrl) {
  console.log('   Webhook URL:', modePreview.webhookUrl);
} else if (modePreview.cloud) {
  console.log('   ⚠️ PUBLIC_APP_URL yo\'q — DigitalOcean Variables ga PUBLIC_APP_URL=${APP_URL} qo\'ying');
}

// Barcha environment variables'ni ko'rsatish (debug uchun)
console.log('\n📋 Barcha environment variables:');
const allEnvVars = Object.keys(process.env).filter(key =>
  key.includes('TELEGRAM') ||
  key.includes('SUPABASE') ||
  key.includes('PUBLIC_APP') ||
  key.includes('APP_URL') ||
  key.includes('APP_DOMAIN') ||
  key.includes('PORT') ||
  key.includes('HOST')
);
if (allEnvVars.length > 0) {
  allEnvVars.forEach(key => {
    const value = process.env[key];
    const displayValue = value && value.length > 20 ? value.substring(0, 20) + '...' : value;
    console.log(`   ${key} = ${displayValue || '(bo\'sh)'}`);
  });
} else {
  console.log('   ❌ Hech qanday environment variable topilmadi!');
}
console.log('');

const { app, PORT } = require('./server');
const bot = require('./bot');
const { setupTelegramWebhook } = require('./services/telegramWebhookService');

// HOST environment variable (default: 0.0.0.0 - barcha network interfeyslar uchun)
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, async () => {
  console.log(`✅ Server ishga tushdi: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);

  const modeInfo = getTelegramModeInfo();

  if (modeInfo.webhookMode) {
    if (modeInfo.setupRequired) {
      console.error('❌ Webhook rejimi yoqilgan, lekin URL topilmadi!');
      printCloudWebhookSetupInstructions();
      console.error('   Yoki to\'liq URL: TELEGRAM_WEBHOOK_URL=https://sea-lion-app-9vj5b.ondigitalocean.app/telegram/webhook');
    } else {
      const result = await setupTelegramWebhook(bot);
      if (result.ok) {
        console.log('✅ Bot webhook rejimida ishlayapti');
      } else if (result.skipped && result.reason === 'AUTO_SET_SKIPPED') {
        console.log('✅ Bot webhook route tayyor (setWebhook localdan bir marta kerak)');
      } else if (!result.skipped) {
        console.warn('⚠️ setWebhook muvaffaqiyatsiz');
        console.warn('   Localdan o\'rnating: npm run set-webhook');
      }

      const connectivity = await testTelegramApiConnectivity();
      if (!connectivity.ok) {
        console.error('❌ Pod api.telegram.org ga CHIQA OLMAYDI — javob yuborish ishlamaydi!');
        console.error('   Xabarlar keladi, lekin bot javob bera olmaydi (ETIMEDOUT).');
        console.error('   Yechim: Railway/Render ga ko\'chiring yoki DO regionini o\'zgartiring.');
      }
    }
  } else if (modeInfo.cloud) {
    console.error('❌ Cloud muhitda bot faqat webhook orqali ishlaydi.');
    printCloudWebhookSetupInstructions();
  } else if (modeInfo.pollingAllowed) {
    console.log('✅ Bot polling rejimida ishlayapti');
    const connectivity = await testTelegramApiConnectivity();
    if (!connectivity.ok) {
      console.warn('⚠️ api.telegram.org ga ulanish testi muvaffaqiyatsiz:', connectivity.message || connectivity.error);
    }
  } else {
    console.log('ℹ️ Telegram polling o\'chirilgan');
  }
  
  // Local IP — faqat development uchun (cloud da PUBLIC_APP_URL ishlating)
  if (HOST === '0.0.0.0' && !modeInfo.cloud) {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    const localIPs = [];
    
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      for (const iface of interfaces) {
        // Faqat IPv4 va internal bo'lmagan (yoki internal) manzillarni ko'rsatish
        if (iface.family === 'IPv4' && !iface.internal) {
          localIPs.push(`http://${iface.address}:${PORT}`);
        }
      }
    }
    
    if (localIPs.length > 0) {
      console.log(`\n🌐 Boshqa kompyuterlar uchun URL'lar:`);
      localIPs.forEach(ip => console.log(`   ${ip}`));
      console.log(`\n💡 ShifoCRM .env faylida quyidagilardan birini ishlating:`);
      localIPs.forEach(ip => console.log(`   VITE_TELEGRAM_API_URL=${ip}`));
    }
  }
});
