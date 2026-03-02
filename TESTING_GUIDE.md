# Avtomatik Rejalashtirilgan Xabarlar - Testing Guide

Bu qo'llanma avtomatik rejalashtirilgan xabarlar funksiyasini test qilish uchun.

---

## 1️⃣ Asosiy Setup

### Database Migration'larini Ishga Tushirish

1. Supabase dashboard'ga kiring
2. SQL Editor'da quyidagi fayllarni ishga tushiring (ketma-ketlikda):
   - `migrations/001_create_telegram_chat_ids.sql` (mavjud)
   - `migrations/002_create_scheduled_messages.sql` (yangi)

### Environment Variables Tekshirish

`.env` faylida quyidagilar mavjud ekanligini tekshiring:
```
TELEGRAM_BOT_TOKEN=your_token_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
PORT=3001
```

---

## 2️⃣ Aplikatsiyani Ishga Tushirish

```bash
# Node dependencies o'rnatish (agar yangi bo'lsa)
npm install

# Development modida ishga tushirish
npm run dev

# Yoki production modida
npm start
```

**Expected output:**
```
🔍 Environment variables tekshirilmoqda...
   TELEGRAM_BOT_TOKEN: ✅ Mavjud
   SUPABASE_URL: ✅ Mavjud
   SUPABASE_SERVICE_KEY: ✅ Mavjud
   PORT: 3001 (default)

✅ Server ishga tushdi: http://localhost:3001
✅ Bot polling ishlayapti
🕐 Message scheduler ishga tushmoqda...
   Har 30 seconds tekshirish
```

---

## 3️⃣ Bemorni Ro'yxatdan O'tkazish (Tayyorlash)

Avval Telegram botning orqali bemorni ro'yxatdan o'tkazish kerak.

### Telegram'da:
1. Botga `/start` buyrug'ini yuboring
2. `/register` buyrug'ini yuboring
3. Telefon raqamingizni yuboring (ShifoCRM'da ro'yxatdan o'tgan)

Bot sizning chat ID'ingizni saqlaydi.

---

## 4️⃣ API orqali Bemorni Yakunlash

### Test 1: Default Follow-up Xabarlar

```bash
curl -X POST http://localhost:3001/api/patients/complete \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient_123",
    "patientName": "Test Bemor",
    "phone": "+998901234567",
    "notes": "Test yakunlash"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "message": "Bemor yakunlandi va follow-up xabarlar rejalashtiryldi",
  "completion": {
    "id": "uuid-xxx",
    "patient_id": "patient_123",
    "chat_id": "1234567890",
    "patient_name": "Test Bemor",
    "phone": "+998901234567",
    "completion_date": "2026-03-02T10:30:00Z"
  },
  "scheduledMessages": 2,
  "chatId": "1234567890"
}
```

### Test 2: Custom Follow-up Xabarlar

```bash
curl -X POST http://localhost:3001/api/patients/complete \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient_456",
    "patientName": "Ayrim Bemor",
    "phone": "+998902345678",
    "customMessages": [
      {
        "delayHours": 1,
        "text": "<b>Test Xabar 1:</b> Bu 1 soat keyin yuboriladi"
      },
      {
        "delayHours": 2,
        "text": "<b>Test Xabar 2:</b> Bu 2 soat keyin yuboriladi"
      }
    ]
  }'
```

---

## 5️⃣ Rejalashtirilgan Xabarlarni Tekshirish

### Xabarlar Yuborilganini Kuzatish

1. **Terminal logs'unu ko'rish:**
   ```bash
   npm run dev
   ```
   Terminal'da quyidagilar ko'rinishi kerak:
   ```
   📬 2 ta pending xabar tekshirilmoqda...
   📤 Xabar yuborilmoqda: 1234567890
   ✅ Xabar yuborildi: message-id -> 1234567890
   ```

2. **Telegram'da xabarlarni qabul qilish:**
   - Botning xabar yuborishini kuting
   - Vaqti o'tganda (24 soat yoki test uchun 1 soat) xabar keladi

### Database'da Status Tekshirish

Supabase SQL Editor'da:
```sql
-- Rejalashtirilgan xabarlarni ko'rish
SELECT id, patient_id, message, scheduled_time, status, sent_at 
FROM scheduled_messages 
ORDER BY scheduled_time DESC 
LIMIT 10;

-- Bemor yakunlash ma'lumotlarini ko'rish
SELECT patient_id, chat_id, patient_name, completion_date 
FROM patient_completions 
ORDER BY completion_date DESC 
LIMIT 10;
```

---

## 6️⃣ Scheduler Status API

```bash
curl http://localhost:3001/api/scheduler/status
```

**Expected response:**
```json
{
  "running": true,
  "checkInterval": "30 seconds"
}
```

---

## 7️⃣ Bemor Yakunlash Ma'lumotini Olish

```bash
curl http://localhost:3001/api/patients/patient_123/last-completion
```

**Expected response:**
```json
{
  "success": true,
  "completion": {
    "id": "uuid-xxx",
    "patient_id": "patient_123",
    "chat_id": "1234567890",
    "patient_name": "Test Bemor",
    "phone": "+998901234567",
    "completion_date": "2026-03-02T10:30:00Z",
    "notes": "Test yakunlash"
  }
}
```

---

## 8️⃣ Xatolar va Debug'ing

### Xatolik: "Chat ID topilmadi"

**Sababi:** Bemor bu telefon raqam bilan ro'yxatdan o'tmagan

**Yechim:**
1. Telefon raqamni tekshiring
2. Bemorni Telegram'da ro'yxatdan o'tkazish kerak (`/register`)

### Xatolik: "Bemor yakunlashni saqlashda xatolik"

**Sababi:** Database connection muammosi

**Debug:**
```sql
-- telegram_chat_ids jadvali tekshiring
SELECT * FROM telegram_chat_ids 
WHERE phone = '+998901234567';

-- Jadval mavjud ekanligini tekshiring
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'telegram_chat_ids';
```

### Xatolik: "Xabar yuborishda xatolik"

**Sababi:** Telegram bot token noto'g'ri yoki bot chat'ga kirish huquqi yo'q

**Debug:**
```bash
# Token tekshiring
echo "Token: $TELEGRAM_BOT_TOKEN"

# Bot ma'lumotini olish
curl https://api.telegram.org/botYOUR_TOKEN/getMe
```

### Terminal'da Debug Mode

```javascript
// src/services/messageScheduler.js'da quyidagi qo'shish:
async function checkAndSendPendingMessages() {
  try {
    const messages = await getPendingMessages();
    console.log('🔍 DEBUG:', {
      timestamp: new Date().toISOString(),
      pendingCount: messages.length,
      messages: messages.map(m => ({
        id: m.id,
        patientId: m.patient_id,
        scheduledTime: m.scheduled_time,
        hasChatInfo: !!m.telegram_chat_ids
      }))
    });
    // ... rest of function
  }
}
```

---

## 9️⃣ Stress Test

### Ko'p Bemor Bilan Test

```bash
#!/bin/bash

# 5 ta bemor uchun test
for i in {1..5}; do
  curl -X POST http://localhost:3001/api/patients/complete \
    -H "Content-Type: application/json" \
    -d '{
      "patientId": "patient_'$i'",
      "patientName": "Bemor '$i'",
      "phone": "+99890123456'$i'",
      "notes": "Test bemor '$i'"
    }'
  echo "Bemor $i yakunlandi"
  sleep 1
done
```

---

## 🔟 Production Deploy Checklist

- [ ] Database migrations barcha ishga tushgan
- [ ] TELEGRAM_BOT_TOKEN tekshirilgan
- [ ] SUPABASE_URL va SUPABASE_SERVICE_KEY to'g'ri
- [ ] PM2 yoki Docker orqali ishga tushgan
- [ ] Scheduler status API ishga tushgan (`/api/scheduler/status`)
- [ ] Test bemori orqali complete API test qilgan
- [ ] Telegram'da xabar kelganligini tasdiqlagan
- [ ] Error logs monitoring'ni o'rnatgan

---

## 📝 Manual Test Scenario

**Vaqt:** ~5 daqiqa (yoki 1 soat agar delayHours=24 bo'lsa)

### Qadam-qadam:

1. **Setup (1 daqiqa)**
   - Terminal'da `npm run dev` bilan ishga tushiring
   - Scheduler holati ko'rining

2. **Bemorni O'tkazish (1 daqiqa)**
   - Telegram'da `/register` yuboring
   - Telefon raqam yuboring

3. **Yakunlash (1 daqiqa)**
   - cURL orqali API call qiling
   - Response'ni tekshiring

4. **Tekshirish (2 daqiqa)**
   - Terminal logs'da xabarni ko'rish
   - Telegram'da xabarni qabul qilish
   - Database'da status tekshirish

---

## 🎯 Key Metrics

Track qilish uchun:
- ⏱️ Average delivery time
- 📊 Success/Failure rate
- 🔍 Pending messages count
- 💾 Database query performance
