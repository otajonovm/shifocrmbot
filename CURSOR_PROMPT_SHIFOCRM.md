# Cursor Prompt: ShifoCRM Telegram Bot Integratsiya Tuzatish

## Muammo

ShifoCRM loyihasida Telegram bot orqali xabar yuborishda quyidagi xatolik chiqmoqda:

```
POST http://localhost:5173/api/telegram/send 500 (Internal Server Error)
```

**Muammo:** Frontend `http://localhost:5173/api/telegram/send` ga so'rov yubormoqda, lekin bot serveri `http://localhost:3001/api/send` da ishlayapti.

## Vazifa

ShifoCRM loyihasida Telegram bot integratsiyasini to'g'ri sozlang:

### 1. Environment Variables Sozlash

`.env` faylga quyidagilarni qo'shing:

```env
VITE_TELEGRAM_API_URL=http://localhost:3001
VITE_TELEGRAM_API_KEY=your-api-key  # ixtiyoriy, agar bot'da BOT_API_KEY bo'lsa
```

### 2. telegramApi.js Faylini Tuzatish

`src/api/telegramApi.js` faylini tekshiring va quyidagilarni ta'minlang:

**MUHIM TALABLAR:**

1. **URL to'g'ri sozlangan bo'lishi kerak:**
   ```javascript
   const TELEGRAM_API_URL = import.meta.env.VITE_TELEGRAM_API_URL || 'http://localhost:3001';
   ```

2. **Fetch URL to'g'ri bo'lishi kerak:**
   ```javascript
   // ✅ TO'G'RI:
   const response = await fetch(`${TELEGRAM_API_URL}/api/send`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({
       patient_id: String(patientId),
       message,
     }),
   });
   ```

3. **Xatoliklarni to'g'ri qaytarish:**
   ```javascript
   if (!response.ok) {
     const error = await response.json().catch(() => ({ error: 'UNKNOWN_ERROR' }));
     console.error('Telegram API error:', error);
     return { ok: false, error: error.error || 'HTTP_ERROR' };
   }
   ```

4. **API key qo'shish (agar kerak bo'lsa):**
   ```javascript
   const headers = {
     'Content-Type': 'application/json',
   };
   if (TELEGRAM_API_KEY) {
     headers['X-API-KEY'] = TELEGRAM_API_KEY;
   }
   ```

### 3. Kod Talablari

- ✅ `fetch` API ishlating (axios emas)
- ✅ `patient_id` va `message` to'g'ri formatda yuborilishi kerak
- ✅ Xatoliklarni to'g'ri handle qiling
- ✅ Console'da debug loglar qo'shing

### 4. To'liq Misol Kod

`src/api/telegramApi.js` fayli quyidagicha bo'lishi kerak:

```javascript
const TELEGRAM_API_URL = import.meta.env.VITE_TELEGRAM_API_URL || 'http://localhost:3001';
const TELEGRAM_API_KEY = import.meta.env.VITE_TELEGRAM_API_KEY;

/**
 * Telegram orqali xabar yuborish
 * @param {Object} params
 * @param {string} params.patientId - Patient ID (ShifoCRM'dan)
 * @param {string} params.message - Xabar matni
 * @returns {Promise<{ok: boolean, error?: string}>}
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

/**
 * Qabul eslatmasi yuborish
 */
export async function sendAppointmentReminder({ patientId, appointmentDate, doctorName }) {
  const message = `📅 Qabul eslatmasi:\n\n` +
    `Sana va vaqt: ${appointmentDate}\n` +
    `Shifokor: ${doctorName}\n\n` +
    `Iltimos, vaqtida keling.`;
  return await sendTelegramNotification({ patientId, message });
}

/**
 * Qarz eslatmasi yuborish
 */
export async function sendDebtReminder({ patientId, amount, dueDate }) {
  const message = `💰 Qarz eslatmasi:\n\n` +
    `Miqdor: ${amount} so'm\n` +
    `Muddat: ${dueDate}\n\n` +
    `Iltimos, to'lovni amalga oshiring.`;
  return await sendTelegramNotification({ patientId, message });
}

/**
 * Qabul tasdiqlandi
 */
export async function sendAppointmentConfirmed({ patientId, appointmentDate, doctorName }) {
  const message = `✅ Qabulingiz tasdiqlandi:\n\n` +
    `Sana va vaqt: ${appointmentDate}\n` +
    `Shifokor: ${doctorName}\n\n` +
    `Ko'rishguncha!`;
  return await sendTelegramNotification({ patientId, message });
}

/**
 * Qabul bekor qilindi
 */
export async function sendAppointmentCanceled({ patientId, reason }) {
  const message = `❌ Qabulingiz bekor qilindi:\n\n` +
    `Sabab: ${reason || 'Noma\'lum'}\n\n` +
    `Qayta qabul olish uchun biz bilan bog'laning.`;
  return await sendTelegramNotification({ patientId, message });
}
```

### 5. Tekshirish

Kod yozilgandan keyin quyidagilarni tekshiring:

1. ✅ `.env` faylida `VITE_TELEGRAM_API_URL=http://localhost:3001` bor
2. ✅ `telegramApi.js` da URL to'g'ri (`${TELEGRAM_API_URL}/api/send`)
3. ✅ `patient_id` va `message` to'g'ri formatda yuborilmoqda
4. ✅ Xatoliklar to'g'ri handle qilinmoqda
5. ✅ Console'da debug loglar ko'rinmoqda

### 6. Development Server'ni Qayta Ishga Tushirish

Environment variables o'zgargandan keyin Vite server'ni qayta ishga tushiring:

```bash
# Ctrl+C bilan to'xtating
npm run dev
```

### 7. Test Qilish

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
fetch('http://localhost:3001/api/send', {
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

## Bot Server Ma'lumotlari

- **Bot Server URL:** `http://localhost:3001`
- **API Endpoint:** `POST /api/send`
- **Request Body:**
  ```json
  {
    "patient_id": "string",
    "message": "string"
  }
  ```
- **Response:**
  ```json
  { "ok": true }
  ```
- **Xatoliklar:**
  - `404` - `{ "error": "CHAT_ID_NOT_FOUND" }` - Patient bot'da ro'yxatdan o'tmagan
  - `400` - `{ "error": "PATIENT_ID_AND_MESSAGE_REQUIRED" }`
  - `401` - `{ "error": "UNAUTHORIZED" }` - API key noto'g'ri

## Muhim Eslatmalar

1. **URL:** `/api/telegram/send` emas, `/api/send` bo'lishi kerak
2. **Environment Variable:** `VITE_TELEGRAM_API_URL` bo'lishi kerak (Vite uchun `VITE_` prefix)
3. **Development Server:** Environment variables o'zgargandan keyin qayta ishga tushirish kerak
4. **CORS:** Bot serverida CORS sozlangan, muammo bo'lmasligi kerak

## Xatoliklar va Yechimlar

### 500 Internal Server Error
- **Sabab:** URL noto'g'ri yoki environment variable o'qilmagan
- **Yechim:** `.env` faylni tekshiring va Vite server'ni qayta ishga tushiring

### CORS xatolik
- **Sabab:** Bot serverida CORS sozlanmagan
- **Yechim:** Bot serverida CORS middleware qo'shilgan, agar muammo bo'lsa bot serverini qayta ishga tushiring

### CHAT_ID_NOT_FOUND
- **Sabab:** Patient bot'da ro'yxatdan o'tmagan
- **Yechim:** Patient'ga bot'da `/register` buyrug'ini yuborish kerak

---

**Bu promptni Cursor'ga yuboring va kodni avtomatik tuzatishni so'rang.**
