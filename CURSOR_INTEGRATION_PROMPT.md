# Cursor Integration Prompt

Quyidagi promptni Cursor'ga yuboring (boshqa loyihangizni ochgan holda):

---

## Prompt:

Men ShifoCRM Telegram bot bilan integratsiya qilmoqchiman. Bot alohida serverda ishlayapti va HTTP API orqali xabar yuboradi.

### Bot API ma'lumotlari:
- **API URL:** `http://localhost:3001` (development) yoki production URL
- **Endpoint:** `POST /api/send`
- **Body format:**
```json
{
  "patient_id": "string",
  "message": "string"
}
```
- **Headers:** `Content-Type: application/json`, `X-API-KEY: your-api-key` (agar kerak bo'lsa)
- **Response:** `{ "ok": true }` yoki `{ "error": "CHAT_ID_NOT_FOUND" }`

### Vazifa:

1. **API client fayl yaratish:**
   - `src/api/telegramApi.js` yoki `src/services/telegramService.js` faylini yarating
   - Quyidagi funksiyalarni implement qiling:
     - `sendTelegramNotification({ patientId, message })` - Oddiy xabar yuborish
     - `sendAppointmentReminder({ patientId, appointmentDate, doctorName })` - Qabul eslatmasi
     - `sendDebtReminder({ patientId, amount, dueDate })` - Qarz eslatmasi
     - `sendAppointmentConfirmed({ patientId, appointmentDate, doctorName })` - Qabul tasdiqlandi
     - `sendAppointmentCanceled({ patientId, reason })` - Qabul bekor qilindi

2. **Environment variables:**
   - `.env` yoki `.env.example` faylga qo'shing:
     ```
     VITE_TELEGRAM_API_URL=http://localhost:3001
     VITE_TELEGRAM_API_KEY=my-secret-key-12345
     ```
   - Yoki agar React Native/Next.js bo'lsa:
     ```
     NEXT_PUBLIC_TELEGRAM_API_URL=http://localhost:3001
     NEXT_PUBLIC_TELEGRAM_API_KEY=my-secret-key-12345
     ```

3. **Kod talablari:**
   - `fetch` API ishlating (axios emas, agar loyihada axios bo'lsa ham fetch ishlating)
   - Error handling qo'shing (try-catch)
   - Patient ID ni string ga aylantiring: `String(patientId)`
   - Xatolik bo'lsa ham asosiy funksiya ishlashini to'xtatmasin (catch ichida console.warn)
   - TypeScript bo'lsa, type'lar qo'shing
   - JSDoc comment'lar qo'shing

4. **Ishlatish misoli:**
   ```javascript
   import { sendAppointmentReminder } from '@/api/telegramApi';
   
   // Qabul yaratilganda
   await sendAppointmentReminder({
     patientId: patient.id.toString(),
     appointmentDate: '2024-01-25 15:00',
     doctorName: 'Dr. Ahmadov',
   }).catch(err => console.warn('Telegram xabar yuborilmadi:', err));
   ```

5. **Xatoliklar:**
   - `CHAT_ID_NOT_FOUND` - Patient bot'da ro'yxatdan o'tmagan (404)
   - `NOT_CONFIGURED` - API URL sozlanmagan
   - `UNAUTHORIZED` - API key noto'g'ri (401)

### Muhim:
- Kod to'liq ishlaydigan bo'lishi kerak
- Xatoliklar handle qilinishi kerak
- TypeScript bo'lsa, type'lar to'g'ri bo'lishi kerak
- Environment variable nomlari loyiha formatiga mos bo'lishi kerak (VITE_, NEXT_PUBLIC_, REACT_APP_ va h.k.)

---

## Qo'shimcha ma'lumot:

Agar loyiha React Native bo'lsa, `fetch` o'rniga `axios` yoki `fetch` polyfill ishlating.
Agar loyiha Next.js bo'lsa, server-side'da ham ishlashi uchun `fetch` ishlating.
