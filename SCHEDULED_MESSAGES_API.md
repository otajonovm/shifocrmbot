# Avtomatik Rejalashtirilgan Xabarlar API

## Tavsifi

ShifoCRM botining bu API bemorni yakunlash qilgandan keyin avtomatik rejalashtirilgan xabarlar yuborishni ta'minlaydi.

### Asosiy xususiyatlar:
- ✅ Bemorni yakunlash ro'yxatini saqlash
- ✅ Avtomatik follow-up xabarlarni rejalashtirish
- ✅ Rejalashtirilgan xabarlarni avtomatik yuborish
- ✅ Yuborilgan/yuborish muvaffaqiyatsiz bo'lgan xabarlarning holati izlash

---

## API Endpoints

### 1. Bemorni Yakunlash va Follow-up Xabarlarni Rejalashtirish

**Endpoint:** `POST /api/patients/complete`

**Tavsifi:** Bemorni yakunlash qilib, avtomatik follow-up xabarlarini rejalashtirish.

**Request Body:**
```json
{
  "patientId": "patient_123",
  "patientName": "Sardor Ibragimov",
  "phone": "+998901234567",
  "notes": "Yakunlash eslatmalari",
  "customMessages": [
    {
      "delayHours": 24,
      "text": "<b>Eslatma:</b> Shunday davom eting..."
    },
    {
      "delayHours": 72,
      "text": "<b>Tekshiruv:</b> Holatiz qandaydir..."
    }
  ]
}
```

**Parametrlar:**
- `patientId` (required): Bemor ID raqami
- `phone` (required): Bemor telefon raqami (ro'yxatdan o'tish uchun kerak)
- `patientName` (optional): Bemor ismi
- `notes` (optional): Yakunlash haqida eslatmalar
- `customMessages` (optional): Faqat custom xabarlar uchun. Agar bu bo'lmasa, default xabarlar ishlatiladi.

**Response (Muvaffaqiyat):**
```json
{
  "success": true,
  "message": "Bemor yakunlandi va follow-up xabarlar rejalashtiryldi",
  "completion": {
    "id": "uuid-123",
    "patient_id": "patient_123",
    "chat_id": "1234567890",
    "patient_name": "Sardor Ibragimov",
    "phone": "+998901234567",
    "completion_date": "2026-03-02T10:30:00Z"
  },
  "scheduledMessages": 2,
  "chatId": "1234567890"
}
```

**Response (Xatolik):**
```json
{
  "success": false,
  "error": "Bu telefon raqam bilan ro'yxatdan o'tgan foydalanuvchi topilmadi"
}
```

**cURL misoli:**
```bash
curl -X POST http://localhost:3001/api/patients/complete \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient_123",
    "patientName": "Sardor Ibragimov",
    "phone": "+998901234567",
    "notes": "Normal holatda"
  }'
```

---

### 2. Bemorning Oxirgi Yakunlash Ma'lumotini Olish

**Endpoint:** `GET /api/patients/:patientId/last-completion`

**Tavsifi:** Bemorning eng oxirgi yakunlash ma'lumotini olish.

**Path Parametrlar:**
- `patientId` (required): Bemor ID raqami

**Response (Muvaffaqiyat):**
```json
{
  "success": true,
  "completion": {
    "id": "uuid-456",
    "patient_id": "patient_123",
    "chat_id": "1234567890",
    "patient_name": "Sardor Ibragimov",
    "phone": "+998901234567",
    "completion_date": "2026-03-02T10:30:00Z",
    "notes": "Normal holatda",
    "created_at": "2026-03-02T10:30:00Z"
  }
}
```

**cURL misoli:**
```bash
curl http://localhost:3001/api/patients/patient_123/last-completion
```

---

### 3. Scheduler Holatini Tekshirish

**Endpoint:** `GET /api/scheduler/status`

**Tavsifi:** Message scheduler ning joriy holati haqida ma'lumot olish.

**Response:**
```json
{
  "running": true,
  "checkInterval": "30 seconds"
}
```

**cURL misoli:**
```bash
curl http://localhost:3001/api/scheduler/status
```

---

## Default Follow-up Xabarlar

Agar `customMessages` ko'rsatilmasa, quyidagi default xabarlar ishlatiladi:

### 1-chi xabar (24 soat keyin):
```
✅ Yakunlash tasdiqlandi

Sizning tibbiy ko'rik yakunlandi!

Tez orada sizga follow-up eslatmalari yuboriladi.

Sog'lig'ingiz uchun tilaklarimiz! 🙏
```

### 2-chi xabar (72 soat keyin):
```
📋 Bemor yakunlash sondan keyin eslatma

Sizning tibbiy ko'rik yakunlandi.

Agar sizda savollar yoki muammolar bo'lsa, iltimos biz bilan bog'laning.

Sizning sog'lig'ingiz bizga muhim! 💚
```

### 3-chi xabar (72 soat keyin):
```
⚕️ Yo'lni davom etishing haqida

Sizning umumiy holatiz qandaydir?

Agar tavsiyalarni amal qilishda qiyinchilik bo'lsa, biz yordam bera olamiz.
```

---

## Jadval Tuzilishi

### `scheduled_messages` jadvali
```sql
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY,
  patient_id TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `patient_completions` jadvali
```sql
CREATE TABLE patient_completions (
  id UUID PRIMARY KEY,
  patient_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  patient_name TEXT,
  phone TEXT,
  completion_date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Message Scheduler Qanday Ishlaydi?

1. **Boshlash:** Aplikatsiya ishga tushganda, Message Scheduler avtomatik ishga tushadi
2. **Tekshirish:** Har 30 soniyada `scheduled_messages` jadvalidagi pending xabarlarni tekshiradi
3. **Yuborish:** Vaqti kelgan xabarlarni Telegram orqali yuboradi
4. **Status yangilash:** Yuborilgan yoki yuborish muvaffaqiyatsiz bo'lgan xabarlarning statusini yangilaydi

---

## Misol: Lengthwise Integration

ShifoCRM uchun bemorni yakunlash API'si ishlatish:

### Node.js/Express:
```javascript
const axios = require('axios');

async function completePatient(patientId, phone, name) {
  try {
    const response = await axios.post('http://localhost:3001/api/patients/complete', {
      patientId: patientId,
      patientName: name,
      phone: phone,
      notes: 'Yakunlash qilindi'
    });
    console.log('Bemor yakunlandi:', response.data);
  } catch (error) {
    console.error('Xatolik:', error.response.data);
  }
}
```

### Python:
```python
import requests

def complete_patient(patient_id, phone, name):
    url = 'http://localhost:3001/api/patients/complete'
    payload = {
        'patientId': patient_id,
        'patientName': name,
        'phone': phone,
        'notes': 'Yakunlash qilindi'
    }
    response = requests.post(url, json=payload)
    print('Bemor yakunlandi:', response.json())
```

### PHP:
```php
<?php
$data = [
    'patientId' => 'patient_123',
    'patientName' => 'Sardor',
    'phone' => '+998901234567',
    'notes' => 'Yakunlash qilindi'
];

$ch = curl_init('http://localhost:3001/api/patients/complete');
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>
```

---

## Xatolar va Yechimlar

| Xatolik | Sabablar | Yechim |
|---------|---------|--------|
| `Chat ID topilmadi` | Bemor ro'yxatdan o'tmagan | Bemorni avval ro'yxatdan o'tiring |
| `Bemor yakunlashni saqlashda xatolik` | Database bilan bog'lanish muammosi | Supabase connection tekshiring |
| `Xabar yuborishda xatolik` | Telegram bot token noto'g'ri | TELEGRAM_BOT_TOKEN tekshiring |

---

## Environment Variables

`.env` faylda quyidagilar kerak:
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
PORT=3001
```

---

## Deployment Notes

Railway'da deploy qilinganda:
1. `.env` faylni ko'rib chiqing va variables'ni Railway dashboard'ga qo'shing
2. Database migrations'ni ishga tushiring: `002_create_scheduled_messages.sql`
3. PM2 yoki Docker orqali ishga tushiring

---

## Qo'shimcha Imkoniyatlar

Kelajakda qo'shish mumkin:
- ✏️ Custom xabar shablonlari
- 📊 Xabar analytics/reporting
- 🔔 Push notifications
- 📞 SMS notifications
- 📈 A/B testing xabarilari uchun
