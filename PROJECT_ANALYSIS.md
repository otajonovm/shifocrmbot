# ShifoCRM Telegram Bot - To'liq Tahlil

## 📋 Loyiha Haqida

**Nomi:** ShifoCRM Telegram Bot  
**Maqsadi:** ShifoCRM bilan integratsiya qilingan Telegram bot orqali bemor/bemalarning telefon raqami bo'yicha ro'yxatdan o'tish va ularga xabarlar yuborish  
**Stack:** Node.js + Express.js + Telegram Bot API + Supabase (PostgreSQL)  
**Deployment:** Railway.app (Cloud), PM2 (Local/VPS)

---

## 🏗️ Arxitektura va Tuzilish

```
ShifoCRM_bot/
├── src/                      # Asosiy kod
│   ├── index.js             # Server ishga tushirish nuqtasi
│   ├── bot.js               # Telegram bot logikasi
│   ├── server.js            # Express server va API endpoints
│   ├── supabase.js          # Supabase client konfiguratsiyasi
│   ├── api/                 # API handlers
│   │   └── telegramApi.example.js
│   ├── repository/          # Database o'zaro aloqa (Data Access Layer)
│   │   ├── patientRepo.js   # Bemor ma'lumotlarini olish
│   │   └── telegramChatRepo.js  # Telegram chat_id saqlash
│   └── utils/               # Utility functions
│       └── validators.js    # Validatsiya functions
├── migrations/              # Database migratsiyalar
│   └── 001_create_telegram_chat_ids.sql
├── logs/                    # PM2 loglar
├── package.json             # Dependencies
├── ecosystem.config.js      # PM2 konfiguratsiya
├── railway.json             # Railway deployment
└── *.md                     # Dokumentasiya fayllar
```

---

## 🔧 Asosiy Komponentlar

### 1. **index.js** - Startup
- `.env` faylni yuklab olish (local development uchun)
- Environment variables'ni tekshirish
- Express server va bot'ni ishga tushirish
- Local IP manzilni ko'rsatish (debug uchun)

**Muhim:** Server PORT'ni (default 3001) va HOST'ni (default 0.0.0.0) o'rnatadi

---

### 2. **bot.js** - Telegram Bot Logikasi

#### FSM (Finite State Machine) - Holat Boshqaruvi
```javascript
const userStates = {}; // { chatId: { step: 'waiting_phone' } }
```

#### Bot Komandlari:

| Komanda | Tavsifi |
|---------|---------|
| `/start` | Botni boshlash, xush kelibsiz xabari |
| `/help` | Botning qanday ishlashini ko'rsatish |
| `/register` | Telefon raqam orqali ro'yxatdan o'tish |

#### Ro'yxatdan o'tish Jarayoni (Registration Flow):

```
User -> /register ->
  Bot: "Telefon raqam yuboring"
  User.state = "waiting_phone"

User -> Telefon raqam (masalan: 901234567 yoki +998901234567) ->
  1. Validatsiya qilish (isValidPhone)
  2. Telefon raqamni normalize qilish (normalizePhone) -> +9989XXXXXXXXX
  3. ShifoCRM database'dan qidirish (getPatientByPhone)
  4. Agar topilsa:
     - Patient ma'lumotlarini Supabase'ning telegram_chat_ids jadvliga saqlash
     - User'ga "Ro'yxatdan o'ttingiz" xabari yuborish
  5. Agar topilmasa:
     - User'ga "Telefon topilmadi" xabari yuborish
```

#### Qo'shimcha Xususiyatlar:
- Odd telefon raqamlari avtomatik tekshiriladi
- Patient topilsa ma'lumot ko'rsatiladi

---

### 3. **server.js** - Express Server va API

#### CORS Konfiguratsiyasi
- Barcha origin'lardan ruxsat (production'da aniq domain kiriting)
- Preflight OPTIONS request'larini qo'lla

#### API Key Tekshirish
```javascript
Header: X-API-KEY = process.env.BOT_API_KEY
```
- Agar BOT_API_KEY set qilinmasa, tekshirish o'tkazib yuboriladi
- Production'da tavsiya qilinadi

#### API Endpoints:

**GET /health**
- Status: 200
- Response: `{ "ok": true }`
- Maqsadi: Server ishlayotganini tekshirish

**POST /api/send**
- Talab:
  ```json
  {
    "patient_id": "string",
    "message": "string"
  }
  ```
- Javob:
  - Success: `{ "ok": true }`
  - Patient topilmasa: `{ "error": "CHAT_ID_NOT_FOUND" }`
  - Xatolik: `{ "error": "INTERNAL_ERROR", "message": "..." }`

**Logika:**
1. patient_id bo'yicha chat_id qidirish (getTelegramChatId)
2. Chat_id topilsa, xabar yuborish (bot.sendMessage)
3. Javob qaytarish

---

### 4. **supabase.js** - Database Client

```javascript
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
```

**Muhim:** 
- Trim qilish (bo'sh joylar olib tashlash)
- Agar environment variable'lar yo'q bo'lsa, xatolik bilan to'xtash

---

### 5. **repository/patientRepo.js** - Bemor Ma'lumotlari

#### getPatientById(patientId)
- Qidirish tartibi:
  1. ID raqam bo'lsa, `id` fieldda qidirish
  2. `med_id` fieldda qidirish (agar mavjud bo'lsa)
- Return: `{ id, full_name, phone }` yoki `null`

#### getPatientByPhone(phone)
- **7 turli qidirish variantini** qo'llaydi (katta telefon formatida xatoliklar uchun):
  1. To'g'ridan-to'g'ri normalize qilingan format: `+998XXXXXXXXX`
  2. `+998` qo'shib qidirish
  3. `+` siz qidirish
  4. `998` bilan boshida qidirish
  5. `+998` formatida qidirish
  6. Faqat oxirgi 9 raqam
  7. LIKE va ILIKE (case-insensitive) bilan qidirish

**Debug Loggeri:** Qidirilgan raqam va har bir variant uchun jadval tekshiriladi

---

### 6. **repository/telegramChatRepo.js** - Telegram Integratsiyasi

#### getTelegramChatId(patientId)
- Patient ID bo'yicha chat_id olish
- Return: String chat_id yoki null

#### getTelegramChatIdByPhone(phone)
- Telefon raqam bo'yicha chat_id olish

#### saveTelegramChatId({ patientId, chatId, username, firstName, phone })
- **Upsert** operatsiyasi (insert yoki update)
- **Duplicate chat_id tekshirish:** Agar chat_id boshqa patient bilan bog'langan bo'lsa, uni o'chirish
- Saqlash qiymatlar:
  - `patient_id` (PRIMARY KEY)
  - `chat_id` (UNIQUE INDEX)
  - `username`
  - `first_name`
  - `phone`
  - `updated_at` (avtomatik yangilanadi)

---

### 7. **utils/validators.js** - Validatsiyalar

#### isValidPatientId(patientId)
- Raqamlar, harflar, `_`, `-` ni qabul qiladi
- Regex: `/^[a-zA-Z0-9_-]+$/`

#### normalizePhone(phone)
- Telefon raqamni **+998XXXXXXXXX** formatiga keltiradi
- Qo'shimcha belgilari olib tashlaydi
- Uzunligi 9-15 raqam bo'lsa qabul qiladi
- Agar `+` bo'lmasa, `+998` qo'shadi (Uzbekistan UZ)
- Return: String yoki null

#### isValidPhone(phone)
- `normalizePhone()` qaytish qiymati null emasligini tekshiradi

---

## 🗄️ Database Struktura

### Jadval: `telegram_chat_ids`

```sql
CREATE TABLE telegram_chat_ids (
  patient_id TEXT PRIMARY KEY,      -- ShifoCRM'dagi bemor ID
  chat_id TEXT NOT NULL UNIQUE,     -- Telegram chat ID (user ID)
  username TEXT,                    -- Telegram username (@username)
  first_name TEXT,                  -- Foydalanuvchining ismi
  phone TEXT,                       -- Telefon raqam (qidirishdagi)
  created_at TIMESTAMPTZ,           -- Yaratilgan vaqti
  updated_at TIMESTAMPTZ            -- Oxirgi yangilangan vaqti
);

-- Indexes:
-- idx_telegram_chat_ids_chat_id_unique (UNIQUE) - Tez qidirish + unique tekshirish
-- idx_telegram_chat_ids_chat_id - Tez qidirish
-- idx_telegram_chat_ids_phone - Telefon bo'yicha tez qidirish

-- Trigger:
-- update_telegram_chat_ids_updated_at - updated_at avtomatik yangilanadi
```

### ShifoCRM `patients` Jadval

```
Ustunlar (asosiy):
- id (INT) - Primary key
- full_name (TEXT) - Bemor F.I.O
- phone (TEXT) - Telefon raqam (turli formatlarda saqlangan bo'lishi mumkin)
- med_id (TEXT) - Optional, medical ID

Telefon formatlar bo'yicha variatsiyalar:
- +998901234567
- 998901234567
- 901234567
- +998 90 123 45 67 (bo'sh joylar bilan)
```

---

## 🚀 Deployment Variantlari

### 1. **Local Development (npm run dev)**
- Watch mode bilan Node.js
- `.env` fayl talab qiladi
- Fayllar o'zgarsa avtomatik qayta ishga tushadi

### 2. **Production (npm start)**
- `PORT=3001` (default)
- `HOST=0.0.0.0`
- PM2 orqali boshqaruv tavsiya qiladi

### 3. **PM2 (Doimiy Jarayon Boshqaruvi)**

**Konfiguratsiya:** `ecosystem.config.js`
```javascript
{
  name: 'shifocrm-telegram-bot',
  script: 'src/index.js',
  instances: 1,
  autorestart: true,
  max_memory_restart: '500M',
  error_file: './logs/pm2-error.log',
  out_file: './logs/pm2-out.log'
}
```

**Asosiy buyruqlar:**
```bash
npm run pm2:start      # Ishga tushirish
npm run pm2:restart    # Qayta tushirish
npm run pm2:stop       # To'xtatish
npm run pm2:logs       # Loglarni ko'rish
npm run pm2:status     # Holat
npm run pm2:save       # Saqlab qo'yish (startup uchun)
npm run pm2:startup    # Windows startup ro'yxatiga qo'shish
```

### 4. **Railway Deployment**
- Environment variables'ni Railway dashboardda kiritish
- Avtomatik server qo'llab-quvvalash
- GitHub push → Avtomatik deploy

**Kerakli variables:**
```
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
PORT=3001 (automatik, lekin qo'shsa ham bo'ladi)
BOT_API_KEY=your-secret-key (optional)
```

---

## 🔐 Security Considerations

### 1. **API Key Protection**
- `X-API-KEY` header orqali ShifoCRM'dan so'rov tekshirish
- `.env` faylda saqlanadi (git'dan exclude)

### 2. **Environment Variables**
- Sensitive ma'lumotlar `.env` faylda (local) yoki Railway/VPS environment'da
- Public repository'da `.env.example` shabloni

### 3. **CORS** (Hozircha Xavfsiz Emas)
- `Access-Control-Allow-Origin: *` - Barcha origin'lardan ruxsat
- **Production'da:** Aniq domain'larni belgilash kerak

### 4. **Database**
- Supabase Service Key (server-side) - Xavfsiz
- Patient ma'lumotlari private, faqat server orqali kirish

### 5. **Telegram Bot Token**
- Private, `.env` faylda saqlanadi
- Bot token orqali kimdir xabar yuborishni oldini olinadi

---

## 📊 Data Flow va Integration

### Ro'yxatdan O'tish Jarayoni (End-to-End)

```
┌─────────────────────────────────────────────────────────────┐
│                     User (Telegram)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │   /register Command  │
            │  (bot.onText)        │
            └──────┬───────────────┘
                   │
                   ▼
        ┌──────────────────────────┐
        │ setUserState(step:       │
        │   'waiting_phone')       │
        └──────┬───────────────────┘
               │
               ▼
        ┌──────────────────────────┐
        │  User sends phone number │
        └──────┬───────────────────┘
               │
               ▼
      ┌─────────────────────────────┐
      │ validatePhone + normalize   │
      │ (validators.js)             │
      └──────┬──────────────────────┘
             │
             ▼
     ┌──────────────────────────────┐
     │ getPatientByPhone(phone)     │
     │ (patientRepo.js)             │
     │ Query: patients table        │
     │        (ShifoCRM database)   │
     └──────┬───────────────────────┘
            │
      ┌─────┴──────────┐
      │                │
   Found          Not Found
      │                │
      ▼                ▼
┌─────────────┐   Send error
│ saveTelegram│   message
│ ChatId()    │
│(repo.js)    │
│ Upsert into │
│telegram_    │
│chat_ids     │
└──────┬──────┘
       │
       ▼
 ┌────────────┐
 │Success Msg │
 │ Sent       │
 └────────────┘
```

### Xabar Yuborish Jarayoni (POST /api/send)

```
┌──────────────────────────────────────────┐
│    ShifoCRM Xabar Yuborish So'rovi       │
│  POST /api/send                          │
│  { patient_id, message }                 │
└──────────────┬───────────────────────────┘
               │
               ▼
      ┌──────────────────────┐
      │  X-API-KEY Check     │
      │ (agar kiritilgan bo'lsa)
      └──────┬───────────────┘
             │
             ▼
    ┌─────────────────────────┐
    │ getTelegramChatId       │
    │ (patient_id from DB)    │
    │ telegram_chat_ids       │
    └──────┬──────────────────┘
           │
      ┌────┴───────────┐
      │                │
   Found          Not Found
      │                │
      ▼                ▼
┌─────────────┐   Error: 404
│ bot.send    │
│ Message()   │
└──────┬──────┘
       │
       ▼
  ┌──────────┐
  │  User    │
  │ Receives │
  │ Message  │
  └──────────┘
```

---

## 🛠️ Konfiguratsiyalar

### package.json

```json
{
  "name": "shifocrm-telegram-bot",
  "version": "1.0.0",
  "main": "src/index.js",
  "type": "commonjs",
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  },
  "dependencies": {
    "node-telegram-bot-api": "^0.66.0",
    "express": "^4.18.2",
    "dotenv": "^16.3.1",
    "@supabase/supabase-js": "^2.39.0"
  },
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "pm2:start": "pm2 start ecosystem.config.js",
    "pm2:restart": "pm2 restart shifocrm-telegram-bot",
    "pm2:logs": "pm2 logs shifocrm-telegram-bot"
  }
}
```

### .env (Talab qilinadigan)

```
TELEGRAM_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij
SUPABASE_URL=https://xxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PORT=3001
HOST=0.0.0.0
BOT_API_KEY=your-secret-api-key-for-production
```

---

## ⚙️ Environment Variables

| Nom | Talab | Tavsifi |
|-----|-------|---------|
| `TELEGRAM_BOT_TOKEN` | **Kerak** | BotFather'dan olingan token |
| `SUPABASE_URL` | **Kerak** | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | **Kerak** | Supabase service role key |
| `PORT` | Ixtiyoriy | Express PORT (default: 3001) |
| `HOST` | Ixtiyoriy | Server HOST (default: 0.0.0.0) |
| `BOT_API_KEY` | Ixtiyoriy | API security uchun (production tavsiya) |
| `NODE_ENV` | Ixtiyoriy | Development/production (PM2'da set) |

---

## 🔍 Debugging va Logging

### Bot Logga Yozish

```javascript
console.log('✅ Success messeji');
console.error('❌ Error messeji');
console.warn('⚠️ Warning messeji');
```

### PM2 Loglar

```bash
npm run pm2:logs                    # Barcha loglar
pm2 logs shifocrm-telegram-bot     # Bot loglar (realtime)
```

**Log fayllar:**
- `./logs/pm2-error.log` - Xatoliklar
- `./logs/pm2-out.log` - Standard output

### Debug Mode (Telefon Qidirishda)

`patientRepo.js` da 7 variant va har biri uchun:
```
1️⃣ To'g'ridan-to'g'ri: +998XXXXXXXXX
2️⃣ +998 qo'shib: +998XXXXXXXXX
3️⃣ +siz: 998XXXXXXXXX
4️⃣ 998 bilan: 998XXXXXXXXX
5️⃣ +998 formatida: +998XXXXXXXXX
6️⃣ Oxirgi 9 raqam: 9XXXXXXXX
7️⃣ LIKE/ILIKE: %9XXXXXXXX%
```

---

## 📝 API Misollari

### Ro'yxatdan O'tish (Bot)

```
User: /register
Bot: "Iltimos, telefon raqamingizni yuboring"

User: 901234567
Bot (xabar): 
  ✅ Ro'yxatdan o'ttingiz, Bemor Ismi!
  Patient ID: 123
  Telefon: +998901234567
  
  Endi sizga qabul eslatmalari va xabarlar yuboriladi.
```

### Xabar Yuborish (API)

**So'rov:**
```bash
curl -X POST http://localhost:3001/api/send \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your-api-key" \
  -d '{
    "patient_id": "123",
    "message": "Qabul vaqti: 2025-03-02 10:00"
  }'
```

**Javob (Success):**
```json
{ "ok": true }
```

**Javob (Error):**
```json
{ "error": "CHAT_ID_NOT_FOUND" }
```

---

## 🚨 Muhim Masalalar va Yechimlar

### Masala 1: CORS Xavfsizlik
**Muammo:** Hozirda `Access-Control-Allow-Origin: *`  
**Yechim:** Production'da aniq domain'larni belgilash
```javascript
res.header('Access-Control-Allow-Origin', 'https://yourdomain.com');
```

### Masala 2: Telefon Format Variatsiyalari
**Muammo:** ShifoCRM'da telefon turli formatlarda saqlangan bo'lishi mumkin  
**Yechim:** 7 variant qidirish (patientRepo.js)

### Masala 3: Duplicate Chat ID
**Muammo:** Bir chat_id faqat bitta patient'ga tegishli bo'lishi kerak  
**Yechim:** Upsert'dan oldin eski chat_id'ni o'chirish

### Masala 4: Environment Variables
**Muammo:** Railway'da .env fayl bo'lmaydi  
**Yechim:** index.js'da .env faylni ixtiyoriy qilib olinadi

---

## 📚 Fayllar va Ularning Maqsadi

| Fayl | Maqsadi | Qator Soni |
|------|---------|-----------|
| `src/index.js` | Startup, environment setup | 68 |
| `src/bot.js` | Telegram bot logikasi | 187 |
| `src/server.js` | Express server, API endpoints | 68 |
| `src/supabase.js` | Database client | 13 |
| `src/repository/patientRepo.js` | Bemor ma'lumotlarini olish | 224 |
| `src/repository/telegramChatRepo.js` | Telegram ma'lumotlarini saqlash | 136 |
| `src/utils/validators.js` | Validatsiya functions | 39 |
| `ecosystem.config.js` | PM2 konfiguratsiya | 16 |
| `migrations/001_create_telegram_chat_ids.sql` | Database schema | 34 |
| `package.json` | Dependencies va scripts | 26 |

---

## 🎯 Loyihaning Kuchli Tomonlari

✅ **Robust Telefon Qidiruvi** - 7 variant orqali deyarli barcha formatlarni topadi  
✅ **Xavfsizlik** - API Key validation, environment variable separation  
✅ **PM2 Doimiy Jarayon Boshqaruvi** - Server qayta ishga tushganda avtomatik ishga tushadi  
✅ **Detailed Logging** - Debug'ing uchun yetarli loglar  
✅ **Supabase Upsert** - Duplicate records oldini alish  
✅ **CORS Flexible** - Turli platformalar uchun integratsiya osonligi  
✅ **State Management** - FSM orqali user interaction'ni boshqarish  

---

## ⚠️ Yaxshilash Taklifi

❌ **CORS tahdid** → Domain whitelist qo'shish  
❌ **Error handling** → Try-catch'larni kengaytirish  
❌ **Input sanitization** → SQL injection oldini olish  
❌ **Rate limiting** → API call'larni cheklovchi middleware  
❌ **Tests** → Unit va integration testlar yo'q  
❌ **Typescript** → Type safety uchun migratsiya  
❌ **Monitoring** → Error tracking (Sentry, etc.)  
❌ **Documentation** → JSDoc comments ko'p emas  

---

## 📞 Aloqaga Chiqish Nuqtalari

- **Telegram Bot:** `node-telegram-bot-api` library
- **Database:** Supabase (PostgreSQL)
- **Frontend:** POST `/api/send` endpoint
- **Monitoring:** PM2 logs

---

## 🔑 Kalitli Konsepsiyalar

1. **FSM (Finite State Machine)** - User ro'yxatdan o'tish jarayonini boshqarish
2. **Upsert** - Insert yoki update operatsiyasi
3. **Indexing** - Database qidirish tezligini oshirish
4. **Environment Separation** - Local dev vs production
5. **Process Manager** - PM2 orqali doimiy jarayon
6. **API Integration** - ShifoCRM → Bot integration

---

**Tayyorlandi:** 2025-03-02  
**Tahlil:** Loyihaning barcha komponenti, database struktura, deployment variantlari va integratsiya qanday ishlashini o'z ichiga oladi.
