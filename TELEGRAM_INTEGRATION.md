# ShifoCRM Telegram Bot Integratsiya

Bu hujjat ShifoCRM loyihasini Telegram bot bilan bog'lash uchun yo'riqnoma.

## Struktura

- **Bot loyihasi:** `ShifoCRM_bot/` (alohida repo/papka)
- **ShifoCRM:** `../shifocrm/` (asosiy loyiha)

Bot loyihasi ShifoCRM kodiga bog'liq emas va mustaqil ishlaydi.

## 1. Botni ishga tushirish

1. `ShifoCRM_bot/` papkasiga kiring
2. `npm install`
3. `.env` faylni to'ldiring (qarang: `README.md`)
4. Supabase SQL Editor'da `migrations/001_create_telegram_chat_ids.sql` ni ishga tushiring
5. `npm start` yoki `npm run dev`

## 2. ShifoCRM integratsiya

### 2.1 API client yaratish

`shifocrm/src/api/telegramApi.js` faylini yarating:

```javascript
const TELEGRAM_API_URL = import.meta.env.VITE_TELEGRAM_API_URL;
const TELEGRAM_API_KEY = import.meta.env.VITE_TELEGRAM_API_KEY;

/**
 * Telegram orqali xabar yuborish
 * @param {Object} params
 * @param {string} params.patientId
 * @param {string} params.message
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
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

/**
 * Qabul eslatmasi yuborish
 * @param {Object} params
 * @param {string} params.patientId
 * @param {string} params.appointmentDate
 * @param {string} params.doctorName
 * @returns {Promise<{ok: boolean}>}
 */
export async function sendAppointmentReminder({ patientId, appointmentDate, doctorName }) {
  const message = `📅 Qabul eslatmasi:\n\n` +
    `Sana: ${appointmentDate}\n` +
    `Shifokor: ${doctorName}\n\n` +
    `Iltimos, vaqtida keling.`;
  return await sendTelegramNotification({ patientId, message });
}

/**
 * Qarz eslatmasi yuborish
 * @param {Object} params
 * @param {string} params.patientId
 * @param {number} params.amount
 * @param {string} params.dueDate
 * @returns {Promise<{ok: boolean}>}
 */
export async function sendDebtReminder({ patientId, amount, dueDate }) {
  const message = `💰 Qarz eslatmasi:\n\n` +
    `Miqdor: ${amount} so'm\n` +
    `Muddat: ${dueDate}\n\n` +
    `Iltimos, to'lovni amalga oshiring.`;
  return await sendTelegramNotification({ patientId, message });
}
```

### 2.2 Environment variables

`shifocrm/.env.example` ga qo'shing:

```
VITE_TELEGRAM_API_URL=https://your-bot-url.com
VITE_TELEGRAM_API_KEY=your-api-key  # ixtiyoriy, agar bot'da BOT_API_KEY qo'shilgan bo'lsa
```

### 2.3 Ishlatish misoli

```javascript
import { sendTelegramNotification, sendAppointmentReminder } from '@/api/telegramApi';

// Oddiy xabar
await sendTelegramNotification({
  patientId: 'PAT123',
  message: 'Qabulingiz tasdiqlandi ✅',
});

// Qabul eslatmasi
await sendAppointmentReminder({
  patientId: 'PAT123',
  appointmentDate: '2024-01-25 15:00',
  doctorName: 'Dr. Ahmadov',
});
```

## 3. Xavfsizlik

Production uchun:
1. Bot'da `BOT_API_KEY` ni qo'shing
2. ShifoCRM'da `VITE_TELEGRAM_API_KEY` ni qo'shing
3. HTTPS ishlating

## 4. Xatoliklar

- `CHAT_ID_NOT_FOUND` - Patient bot'da ro'yxatdan o'tmagan. Patient'ga `/register` buyrug'ini yuborish kerak.
- `NOT_CONFIGURED` - `VITE_TELEGRAM_API_URL` sozlanmagan.
- `UNAUTHORIZED` - API key noto'g'ri.

## 5. Test qilish

1. Bot'ni ishga tushiring
2. Test patient bilan `/register` qiling
3. ShifoCRM'dan xabar yuborib ko'ring
