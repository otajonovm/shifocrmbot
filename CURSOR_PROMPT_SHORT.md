# Cursor Prompt (Qisqa Variant)

## Muammo

ShifoCRM loyihasida Telegram bot integratsiyasida xatolik:

```
POST http://localhost:5173/api/telegram/send 500 (Internal Server Error)
```

Frontend `http://localhost:5173/api/telegram/send` ga so'rov yubormoqda, lekin bot serveri `http://localhost:3001/api/send` da ishlayapti.

## Vazifa

1. `.env` faylga qo'shing:
   ```env
   VITE_TELEGRAM_API_URL=http://localhost:3001
   ```

2. `src/api/telegramApi.js` faylini tuzating:
   - `TELEGRAM_API_URL` ni `import.meta.env.VITE_TELEGRAM_API_URL` dan o'qing
   - `fetch` URL ni `${TELEGRAM_API_URL}/api/send` qiling (not `/api/telegram/send`)
   - `patient_id` va `message` to'g'ri formatda yuborilishi kerak
   - Xatoliklarni to'g'ri handle qiling

3. Vite development server'ni qayta ishga tushiring

**Bot server:** `http://localhost:3001/api/send`
**Request:** `POST` with `{ patient_id: string, message: string }`
**Response:** `{ ok: true }` yoki `{ error: string }`
