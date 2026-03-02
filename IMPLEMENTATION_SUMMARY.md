# ✨ Avtomatik Rejalashtirilgan Xabarlar - Implementation Summary

**Vaqt:** 2026-03-02  
**Holati:** ✅ Tayyorchi

---

## 📋 Amalga Oshirilgan Narsalar

### 1. Database Jadvallari
- ✅ `scheduled_messages` - Rejalashtirilgan xabarlarni saqlash
- ✅ `patient_completions` - Bemor yakunlash ma'lumotlarini saqlash
- ✅ Indexlar va triggers o'rnatilgan
- **Fayl:** `migrations/002_create_scheduled_messages.sql`

### 2. Repository Modullar
- ✅ `scheduledMessagesRepo.js` - Rejalashtirilgan xabarlar uchun
  - `createScheduledMessage()` - Yangi xabar rejalashtirish
  - `getPendingMessages()` - Yuborilishi kerak bo'lgan xabarlarni olish
  - `updateMessageStatus()` - Xabar statusini yangilash
  - `scheduleFollowUpMessages()` - Ko'p xabarlarni rejalashtirish

- ✅ `patientCompletionRepo.js` - Bemor yakunlash uchun
  - `recordPatientCompletion()` - Yakunlashni saqlash
  - `getPatientLastCompletion()` - Oxirgi yakunlash ma'lumoti
  - `getPatientCompletionHistory()` - Yakunlash tarixi

### 3. Message Scheduler Service
- ✅ `messageScheduler.js` - Rejalashtirilgan xabarlarni yuboradigan service
  - Har 30 soniyada avtomatik tekshirish
  - Vaqti kelgan xabarlarni Telegram orqali yuborish
  - Error handling va retry logic
  - Graceful shutdown

### 4. API Endpoints
- ✅ `POST /api/patients/complete` - Bemorni yakunlash
  - Default yoki custom follow-up xabarlarni rejalashtirish
  - Darhol welcome xabari yuborish
  
- ✅ `GET /api/patients/:patientId/last-completion` - Oxirgi yakunlash ma'lumoti
  
- ✅ `GET /api/scheduler/status` - Scheduler holatini tekshirish

### 5. Dokumentlar
- ✅ `SCHEDULED_MESSAGES_API.md` - API qo'llanmasi (Batafsil)
- ✅ `TESTING_GUIDE.md` - Testing va debug guide
- ✅ `README.md` - Yangilangan asosiy dokumentar

---

## 🎯 Xususiyatlar

### Default Follow-up Xabarlar
```
1️⃣ 24 soat keyin: "Bemor yakunlash sondan keyin eslatma"
   - Sog'lig'i haqida so'rashish
   - Yana bo'lish uchun tavsiyalar

2️⃣ 72 soat keyin: "Yo'lni davom etishish haqida"
   - Umumiy holatini tekshirish
   - Muammolar bo'lsa tiq qilin
```

### Custom Follow-up Xabarlar
API'ga `customMessages` parametri orqali o'zingizning xabarlaringizni junatish mumkin:
```json
{
  "delayHours": 24,
  "text": "<b>Custom Xabar:</b> Sizga maxsus tavsiya"
}
```

### Message Scheduler
- **Avtomatik:** Aplikatsiya ishga tushganda avtomatik boshlash
- **Interval:** Har 30 soniyada pending xabarlarni tekshirish
- **Reliability:** Database'dan status olish, yuborilgan xabarlarni mark qilish
- **Error Handling:** Yuborish muvaffaqiyatsiz bo'lsa, reason saqlanadi

---

## 🚀 Ishga Tushirish

### 1. Database Migrations
```bash
# Supabase SQL Editor'da:
# 1. 001_create_telegram_chat_ids.sql (agar mavjud bo'lmasa)
# 2. 002_create_scheduled_messages.sql
```

### 2. Dependencies O'rnatish
```bash
npm install
# Barcha kerakli paketlar o'rnatilgan (express, node-telegram-bot-api, @supabase/supabase-js)
```

### 3. Environment Variables
```bash
# .env faylida:
TELEGRAM_BOT_TOKEN=your_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
PORT=3001
```

### 4. Ishga Tushirish
```bash
# Development:
npm run dev

# Production:
npm start

# PM2 orqali:
npm run pm2:start
```

---

## 📊 Integration Example

### Node.js/Express'dan:
```javascript
const axios = require('axios');

// Bemorni yakunlash
const response = await axios.post('http://localhost:3001/api/patients/complete', {
  patientId: 'patient_123',
  patientName: 'Sardor Ibragimov',
  phone: '+998901234567',
  notes: 'Normal holatda' // optional
});

console.log(response.data);
// {
//   success: true,
//   message: "Bemor yakunlandi va follow-up xabarlar rejalashtiryldi",
//   scheduledMessages: 2,
//   chatId: '1234567890'
// }
```

### cURL orqali:
```bash
curl -X POST http://localhost:3001/api/patients/complete \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient_123",
    "patientName": "Sardor Ibragimov",
    "phone": "+998901234567"
  }'
```

---

## 🔍 Tekshirish

### Database'da:
```sql
-- Rejalashtirilgan xabarlarni ko'rish
SELECT * FROM scheduled_messages ORDER BY scheduled_time DESC;

-- Bemor yakunlash ma'lumotlarini ko'rish
SELECT * FROM patient_completions ORDER BY completion_date DESC;
```

### API orqali:
```bash
# Scheduler holatini tekshirish
curl http://localhost:3001/api/scheduler/status

# Bemor yakunlash ma'lumotini olish
curl http://localhost:3001/api/patients/patient_123/last-completion
```

### Terminal logs'da:
```
✅ Bemor yakunlandi...
📬 2 ta pending xabar tekshirilmoqda...
📤 Xabar yuborilmoqda: 1234567890
✅ Xabar yuborildi: msg-id -> 1234567890
```

---

## 🛠️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│              ShifoCRM Telegram Bot                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐         ┌──────────────────┐    │
│  │  Telegram Bot    │         │  Express Server  │    │
│  │                  │         │                  │    │
│  │  - /register     │         │  - /api/send     │    │
│  │  - /start        │         │  - /api/patients │    │
│  │  - polling       │         │                  │    │
│  └──────────────────┘         └──────────────────┘    │
│           ↓                             ↓              │
│  ┌────────────────────────────────────────────────┐   │
│  │  Message Scheduler (har 30 sec)                │   │
│  │  - Pending xabarlarni tekshirish               │   │
│  │  - Vaqti kelgan xabarlarni yuborish            │   │
│  │  - Status yangilash                             │   │
│  └────────────────────────────────────────────────┘   │
│                       ↓                                │
│  ┌────────────────────────────────────────────────┐   │
│  │  Supabase (Database)                           │   │
│  │  - telegram_chat_ids                           │   │
│  │  - scheduled_messages                          │   │
│  │  - patient_completions                         │   │
│  └────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Fayl Struktura

```
shifocrmbot/
├── migrations/
│   ├── 001_create_telegram_chat_ids.sql (mavjud)
│   └── 002_create_scheduled_messages.sql (YA'NI)
├── src/
│   ├── api/
│   │   ├── telegramApi.example.js (mavjud)
│   │   └── patientCompletionApi.js (YA'NI)
│   ├── repository/
│   │   ├── patientRepo.js (mavjud)
│   │   ├── telegramChatRepo.js (mavjud)
│   │   ├── patientCompletionRepo.js (YA'NI)
│   │   └── scheduledMessagesRepo.js (YA'NI)
│   ├── services/
│   │   └── messageScheduler.js (YA'NI)
│   ├── bot.js (mavjud)
│   ├── server.js (YANGILANGAN)
│   ├── index.js (mavjud)
│   └── supabase.js (mavjud)
├── SCHEDULED_MESSAGES_API.md (YA'NI)
├── TESTING_GUIDE.md (YA'NI)
├── README.md (YANGILANGAN)
└── package.json (mavjud)
```

---

## ⚙️ Konfiguratsiya

### Follow-up Xabarlarni Sozlash

Fayl: `src/api/patientCompletionApi.js`

Default xabarlarni o'zgartirish:
```javascript
const DEFAULT_FOLLOW_UP_MESSAGES = [
  {
    delayHours: 24,  // Vaqt (soatlar)
    text: `<b>Custom Heading</b>\n\n...` // Xabar matn
  },
  // Ko'p xabarlar qo'shish mumkin
];
```

### Scheduler Intervalini O'zgartirsh

Fayl: `src/services/messageScheduler.js`

```javascript
const CHECK_INTERVAL = 30 * 1000; // 30 sekund (o'zgarting)
```

---

## 🐛 Common Issues va Yechimlar

| Muammo | Sabablar | Yechim |
|--------|---------|--------|
| Xabarlar yuborilmayapti | Scheduler ishlamayapti | `GET /api/scheduler/status` tekshiring |
| "Chat ID topilmadi" | Bemor ro'yxatdan o'tmagan | Bemorni `/register` orqali o'tkazing |
| Database xatosi | Migrations ishlamagan | SQL Editor'da migrations'ni ishga tushiring |
| Telegram xatosi | Token noto'g'ri | TELEGRAM_BOT_TOKEN tekshiring |

---

## 📈 Next Steps

Kelajakda qo'shish mumkin:
- [ ] SMS notifications
- [ ] Push notifications
- [ ] Email notifications
- [ ] Custom message templates
- [ ] Analytics dashboard
- [ ] Message scheduling UI
- [ ] A/B testing
- [ ] Webhook integration

---

## 📞 Support

### Questions:
- API haqida: [SCHEDULED_MESSAGES_API.md](SCHEDULED_MESSAGES_API.md)
- Testing uchun: [TESTING_GUIDE.md](TESTING_GUIDE.md)
- General: [README.md](README.md)

### Debug:
```bash
npm run dev  # Development modida debug logs ko'ring
```

---

## 🎉 Tayyor!

Sizning avtomatik rejalashtirilgan xabarlar sistema tayyor! 

1. Database migrations'ni ishga tushiring
2. Environment variables'ni o'rnatish
3. `npm start` bilan ishga tushiring
4. API orqali test qiling

Omad! 🚀
