# ShifoCRM Integratsiya Tuzatish

## Muammo

ShifoCRM frontend `http://localhost:5173/api/telegram/send` ga so'rov yubormoqda, lekin bot serveri `http://localhost:3001/api/send` da ishlayapti.

## Yechim

### Variant 1: To'g'ridan-to'g'ri URL ishlatish (Tavsiya)

ShifoCRM loyihasida `telegramApi.js` faylini tekshiring va URL ni to'g'rilang:

```javascript
// src/api/telegramApi.js

const TELEGRAM_API_URL = import.meta.env.VITE_TELEGRAM_API_URL || 'http://localhost:3001';
const TELEGRAM_API_KEY = import.meta.env.VITE_TELEGRAM_API_KEY;

export async function sendTelegramNotification({ patientId, message }) {
  if (!TELEGRAM_API_URL) {
    console.warn('TELEGRAM_API_URL sozlanmagan');
    return { ok: false, error: 'NOT_CONFIGURED' };
  }
  
  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (TELEGRAM_API_KEY) {
      headers['X-API-KEY'] = TELEGRAM_API_KEY;
    }
    
    // ⚠️ MUHIM: To'g'ri URL ishlating
    const response = await fetch(`${TELEGRAM_API_URL}/api/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        patient_id: String(patientId),
        message,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'UNKNOWN_ERROR' }));
      console.error('Telegram API error:', error);
      return { ok: false, error: error.error || 'HTTP_ERROR' };
    }
    
    return { ok: true };
  } catch (error) {
    console.error('Telegram API exception:', error);
    return { ok: false, error: error.message };
  }
}
```

### Variant 2: Vite Proxy sozlash

Agar ShifoCRM'da `/api/telegram/*` endpoint'lari mavjud bo'lsa, Vite proxy sozlang:

```javascript
// vite.config.js yoki vite.config.ts

export default defineConfig({
  // ... boshqa sozlamalar
  server: {
    proxy: {
      '/api/telegram': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/telegram/, '/api'),
      },
    },
  },
});
```

## Qadam-baqadam yo'riqnoma

### 1. Environment variables sozlash

ShifoCRM loyihasida `.env` faylga qo'shing:

```env
VITE_TELEGRAM_API_URL=http://localhost:3001
VITE_TELEGRAM_API_KEY=your-api-key  # agar bot'da BOT_API_KEY bo'lsa
```

### 2. telegramApi.js faylini tekshirish

ShifoCRM loyihasida `src/api/telegramApi.js` faylini oching va quyidagilarni tekshiring:

1. ✅ `TELEGRAM_API_URL` to'g'ri o'qilayotganmi?
2. ✅ `fetch` URL to'g'rimi? (`${TELEGRAM_API_URL}/api/send`)
3. ✅ Endpoint to'g'rimi? (`/api/send`, `/api/telegram/send` emas)

### 3. Development server'ni qayta ishga tushirish

Environment variables o'zgargandan keyin Vite server'ni qayta ishga tushiring:

```bash
# Ctrl+C bilan to'xtating
# Keyin qayta ishga tushiring
npm run dev
```

### 4. Test qilish

Browser console'da test qiling:

```javascript
// telegramApi.js dan import qiling
import { sendTelegramNotification } from '@/api/telegramApi';

// Test qiling
await sendTelegramNotification({
  patientId: '71583',  // Test patient ID
  message: 'Test xabar'
});
```

Yoki browser console'da to'g'ridan-to'g'ri:

```javascript
fetch('http://localhost:3001/api/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    patient_id: '71583',
    message: 'Test xabar'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## Xatoliklar

### 500 Internal Server Error

**Sabab:** ShifoCRM backend serveri `/api/telegram/send` endpoint'ini topmayapti.

**Yechim:** 
- `telegramApi.js` da URL ni `http://localhost:3001` ga o'zgartiring
- Yoki Vite proxy sozlang

### CORS xatolik

**Sabab:** Bot serverida CORS sozlanmagan.

**Yechim:** Bot serverida CORS middleware qo'shildi. Agar hali ham muammo bo'lsa, bot serverini qayta ishga tushiring:

```powershell
pm2 restart shifocrm-telegram-bot
```

### NOT_CONFIGURED

**Sabab:** `VITE_TELEGRAM_API_URL` environment variable sozlanmagan.

**Yechim:** `.env` faylga qo'shing va development server'ni qayta ishga tushiring.

## Tekshirish ro'yxati

- [ ] Bot serveri ishlayapti (`pm2 status`)
- [ ] Bot serveri `http://localhost:3001` da ishlayapti
- [ ] ShifoCRM `.env` faylida `VITE_TELEGRAM_API_URL=http://localhost:3001` bor
- [ ] `telegramApi.js` da URL to'g'ri (`${TELEGRAM_API_URL}/api/send`)
- [ ] Vite development server qayta ishga tushirilgan
- [ ] Browser console'da xatoliklar yo'q
