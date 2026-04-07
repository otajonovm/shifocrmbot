# ShifoCRM'ga Railway Bot URL Qo'shish

## 🎯 Maqsad

Railway'da bot ishlayapti. Endi boshqa kompyuterlar (noutbook, telefon) dan bot'ga kirish uchun ShifoCRM loyihasiga Railway URL'ni qo'shish kerak.

## ✅ Qadam-baqadam Sozlash

### Qadam 1: Railway URL ni Olish

1. Railway dashboard → **Settings** tab
2. **Generate Domain** tugmasini bosing
3. Yoki avtomatik domain ko'rinadi: `shifocrmbot-production.up.railway.app`
4. URL ni ko'chirib oling (masalan: `https://shifocrmbot-production.up.railway.app`)

### Qadam 2: ShifoCRM .env Faylga Qo'shish

ShifoCRM loyihasida `.env` faylga quyidagilarni qo'shing:

```env
VITE_TELEGRAM_API_URL=https://shifocrmbot-production.up.railway.app
VITE_TELEGRAM_API_KEY=your-api-key  # ixtiyoriy, agar bot'da BOT_API_KEY bo'lsa
```

**⚠️ MUHIM:**
- `https://` bilan boshlanishi kerak (HTTP emas!)
- Railway URL'ni to'liq ko'chirib qo'ying
- `VITE_` prefix bo'lishi kerak (Vite uchun)

### Qadam 3: telegramApi.js Faylini Tekshiring

ShifoCRM loyihasida `src/api/telegramApi.js` faylini tekshiring:

```javascript
const TELEGRAM_API_URL = import.meta.env.VITE_TELEGRAM_API_URL || 'http://localhost:3001';
const TELEGRAM_API_KEY = import.meta.env.VITE_TELEGRAM_API_KEY;

/**
 * Telegram orqali xabar yuborish
 */
export async function sendTelegramNotification({ patientId, message }) {
  if (!TELEGRAM_API_URL) {
    console.warn('⚠️ TELEGRAM_API_URL sozlanmagan');
    return { ok: false, error: 'NOT_CONFIGURED' };
  }

  if (!patientId || !message) {
    console.error('❌ patientId yoki message bo\'sh');
    return { ok: false, error: 'INVALID_PARAMS' };
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (TELEGRAM_API_KEY) {
      headers['X-API-KEY'] = TELEGRAM_API_KEY;
    }

    console.log('📤 Telegram xabar yuborilmoqda:', {
      url: `${TELEGRAM_API_URL}/api/send`,
      patientId,
      messageLength: message.length,
    });

    const response = await fetch(`${TELEGRAM_API_URL}/api/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        patient_id: String(patientId),
        message: String(message),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'UNKNOWN_ERROR' }));
      console.error('❌ Telegram API xatolik:', {
        status: response.status,
        statusText: response.statusText,
        error,
      });
      return { ok: false, error: error.error || 'HTTP_ERROR' };
    }

    const result = await response.json();
    console.log('✅ Telegram xabar muvaffaqiyatli yuborildi');
    return { ok: true, ...result };
  } catch (error) {
    console.error('❌ Telegram API exception:', error);
    return { ok: false, error: error.message || 'NETWORK_ERROR' };
  }
}
```

**⚠️ MUHIM:**
- URL `${TELEGRAM_API_URL}/api/send` bo'lishi kerak (not `/api/telegram/send`)
- `patient_id` va `message` to'g'ri formatda yuborilishi kerak

### Qadam 4: Development Server'ni Qayta Ishga Tushirish

Environment variables o'zgargandan keyin Vite server'ni qayta ishga tushiring:

```bash
# Ctrl+C bilan to'xtating
npm run dev
```

Yoki:

```bash
# Windows PowerShell
Get-Process -Name node | Where-Object { $_.Path -like "*vite*" } | Stop-Process -Force
npm run dev
```

### Qadam 5: Test Qilish

Browser console'da test qiling:

```javascript
import { sendTelegramNotification } from '@/api/telegramApi';

await sendTelegramNotification({
  patientId: '71583',  // Test patient ID
  message: 'Test xabar'
});
```

Yoki to'g'ridan-to'g'ri:

```javascript
fetch('https://shifocrmbot-production.up.railway.app/api/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    patient_id: '71583',
    message: 'Test xabar'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

---

## 📋 To'liq Misol: ShifoCRM .env Fayl

ShifoCRM loyihasida `.env` fayl quyidagicha bo'lishi kerak:

```env
# Telegram Bot API (Railway)
VITE_TELEGRAM_API_URL=https://shifocrmbot-production.up.railway.app
VITE_TELEGRAM_API_KEY=your-secret-api-key  # ixtiyoriy

# Boshqa environment variables...
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxx
```

---

## 🔍 Tekshirish

### 1. Environment Variable Tekshirish

Browser console'da:

```javascript
console.log(import.meta.env.VITE_TELEGRAM_API_URL);
```

Railway URL ko'rinishi kerak.

### 2. Health Check

Browser console'da:

```javascript
fetch('https://shifocrmbot-production.up.railway.app/health')
  .then(r => r.json())
  .then(console.log);
```

`{"ok":true}` chiqishi kerak.

### 3. Xabar Yuborish Test

ShifoCRM loyihasida patient detail sahifasidan xabar yuborishni sinab ko'ring.

---

## ⚠️ MUHIM ESLATMALAR

### 1. HTTPS Ishlatish

Railway'da bot HTTPS orqali ishlaydi. ShifoCRM'da ham HTTPS ishlatish kerak:

✅ **TO'G'RI:**
```env
VITE_TELEGRAM_API_URL=https://shifocrmbot-production.up.railway.app
```

❌ **NOTO'G'RI:**
```env
VITE_TELEGRAM_API_URL=http://shifocrmbot-production.up.railway.app
```

### 2. CORS

Railway'da bot CORS sozlangan. Agar muammo bo'lsa, Railway dashboard → **Settings** → **CORS** ni tekshiring.

### 3. Development vs Production

- **Development:** `http://localhost:3001` (local bot uchun)
- **Production:** `https://shifocrmbot-production.up.railway.app` (Railway bot uchun)

### 4. Environment Variables

Vite uchun environment variables `VITE_` prefix bilan bo'lishi kerak:

✅ **TO'G'RI:**
```env
VITE_TELEGRAM_API_URL=...
```

❌ **NOTO'G'RI:**
```env
TELEGRAM_API_URL=...  # Vite o'qimaydi!
```

---

## 🎯 Qadam-baqadam

1. ✅ Railway URL ni oling
2. ✅ ShifoCRM `.env` faylga qo'shing: `VITE_TELEGRAM_API_URL=https://...`
3. ✅ `telegramApi.js` faylini tekshiring
4. ✅ Development server'ni qayta ishga tushiring
5. ✅ Test qiling

---

**Tayyor! Endi barcha kompyuterlar va telefonlar bot'ga kirishlari mumkin!** 🚀
