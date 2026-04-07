# ShifoCRM Telegram Bot - Loyihaning To'liq Konteksti

## 🎯 LOYIHANING MAQSADI VA UMUMIY KÓ'RINISHI

Bu loyiha **ShifoCRM** (klinika boshqaruv tizimi) bilan integratsiya qilingan **Telegram Bot**. Asosiy vazifasi:
- Bemolarni Telegram orqali ro'yxatdan o'ttirish (telefon raqam orqali)
- ShifoCRM database'sida bemor'ni tekshirish
- Bemolarga qabul eslatmalari va xabarlar yuborish

**Steki:** Node.js (18+) + Express + Telegram Bot API + Supabase (PostgreSQL)

---

## 🏗️ LOYIHANING ARXITEKTURASI

```
Telegram User (Bemor)
        ↓
    Bot.js (FSM)
        ↓
    [Validation] (validators.js)
        ↓
    [Repository Layer]
        ├── patientRepo.js → ShifoCRM patients jadval
        └── telegramChatRepo.js → Supabase telegram_chat_ids jadval
        ↓
    server.js (Express API)
        ↓
    ShifoCRM (Backend)
        ├── POST /api/send → Xabar yuborish
        ├── GET /health → Status tekshirish
        └── Auth: X-API-KEY header
```

---

## 📂 FAYLLAR VA ULARNING MAQSADI

### 1. **src/index.js** - Bootloader
```javascript
// Vazifasi:
- .env faylni yuklash (local dev uchun)
- Environment variables tekshirish
- Express server va Telegram bot'ni ishga tushirish
- Server PORT (3001) va HOST (0.0.0.0) o'rnatish
```

**Muhim:** 
- Railway'da `.env` bo'lmaydi, environment variable'lar to'g'ridan-to'g'ri set qilinadi
- .env mavjudligi ixtiyoriy, fayl yo'q bo'lsa ham ishlaydi

---

### 2. **src/bot.js** - Telegram Bot Logikasi (Asosiy)

#### Komandlar:
```
/start    → Xush kelibsiz xabari
/help     → Bot komandlari ro'yxati
/register → Ro'yxatdan o'tish boshlash (telefon raqam kerak)
```

#### Ro'yxatdan O'tish Jarayoni (FSM - Finite State Machine):

```javascript
// User /register bosganda:
1. setUserState(chatId, { step: 'waiting_phone' })
   └─ Bot: "Telefon raqam yuboring"

// User telefon raqam yuborganda:
2. isValidPhone() → Validatsiya (990XXXXXXX yoki +998XXXXXXX)
   └─ Agar noto'g'ri: "Noto'g'ri format"

3. normalizePhone() → +998XXXXXXXXX ga keltirish
   └─ 901234567 → +998901234567

4. getPatientByPhone(phone) → ShifoCRM'dan qidirish
   └─ 7 variant telefon format bo'yicha qidirish

5. Agar topilsa:
   └─ saveTelegramChatId() → telegram_chat_ids'ga saqlash
   └─ clearUserState() → State o'chirish
   └─ Success xabari: "✅ Ro'yxatdan o'ttingiz, [Bemor ismi]!"

6. Agar topilmasa:
   └─ "❌ Bu telefon topilmadi"
```

#### FSM (State Boshqaruvi):
```javascript
const userStates = {
  [chatId]: { step: 'waiting_phone' }  // Qanday qadam kutilmoqda
};
```

---

### 3. **src/server.js** - Express Server va API

#### Endpoints:

**GET /health**
```
So'rov:  GET http://localhost:3001/health
Javob:   { "ok": true }
Maqsadi: Server ishlayotganini tekshirish
```

**POST /api/send** ← ShifoCRM'dan xabar yuborishda
```
So'rov Headers:
  - X-API-KEY: <BOT_API_KEY> (agar set qilingan bo'lsa)
  - Content-Type: application/json

So'rov Body:
{
  "patient_id": "123",           // ShifoCRM'dagi bemor ID
  "message": "Qabul vaqti: 10:00"
}

Javob (Success):
{ "ok": true }

Javob (Error):
{ "error": "CHAT_ID_NOT_FOUND" }  // Bemor ro'yxatdan o'tmagan
```

#### Logika:
```javascript
1. X-API-KEY tekshirish (agar BOT_API_KEY set qilingan bo'lsa)
2. patient_id va message validatsiya qilish
3. getTelegramChatId(patient_id) → telegram_chat_ids'dan qidirish
4. Agar chat_id topilsa: bot.sendMessage(chatId, message)
5. Javob qaytarish
```

#### CORS (Hozircha Xavfsiz Emas):
```javascript
Access-Control-Allow-Origin: *  // Barcha origin'lardan ruxsat
// Production'da: 'https://yourdomain.com' qilib o'zgartirilishi kerak
```

---

### 4. **src/supabase.js** - Database Client

```javascript
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Vazifasi:
- Supabase'ga connection o'rnatish
- telegram_chat_ids jadvalga ruxsat beruvchi service role
- patients jadvaldan qidirish (read-only shulamiz)
```

---

### 5. **src/repository/patientRepo.js** - Bemor Qidirish (Muhim)

```javascript
getPatientById(patientId)
  ↓
  1. ID raqam bo'lsa: SELECT id, full_name, phone 
     WHERE id = patientId
  2. med_id bo'lsa: SELECT ... WHERE med_id = patientId
  Return: { id, full_name, phone } yoki null

getPatientByPhone(phone)  ← ASOSIY FUNKSIYA
  ↓
  7 VARIANT QIDIRISH (har bir variant'da database call):
  
  1️⃣ Normalize qilingan: +998901234567
  2️⃣ +998 qo'shib: +998901234567
  3️⃣ +siz: 998901234567
  4️⃣ 998 bilan: 998901234567
  5️⃣ +998 formatida: +998901234567
  6️⃣ Oxirgi 9 raqam: 901234567
  7️⃣ LIKE/ILIKE: %901234567%
  
  Sababi: ShifoCRM database'sida telefon turli formatda saqlangan bo'lishi mumkin
  
  Return: { id, full_name, phone } yoki null
```

**Debug Logga:**
```
🔍 Telefon raqam qidirilmoqda: "901234567"
📞 Normalize qilingan: "+998901234567"
1️⃣ To'g'ridan-to'g'ri qidirish: "+998901234567"
❌ Topilmadi (1)
2️⃣ +998 qo'shib qidirish: "+998901234567"
✅ Topildi (2): ID=123, Name=Bemor Ismi, Phone=+998901234567
```

---

### 6. **src/repository/telegramChatRepo.js** - Telegram Ma'lumotlarini Saqlash

```javascript
getTelegramChatId(patientId)
  ├─ Maqsadi: Bemor ID → Telegram chat_id olish
  └─ SELECT chat_id FROM telegram_chat_ids 
     WHERE patient_id = '123'

getTelegramChatIdByPhone(phone)
  ├─ Maqsadi: Telefon raqam → Telegram chat_id olish
  └─ SELECT chat_id FROM telegram_chat_ids 
     WHERE phone = '+998901234567'

saveTelegramChatId({ patientId, chatId, username, firstName, phone })
  ├─ Maqsadi: Bemor va Telegram chat_id ni saqlash/yangilash
  │
  ├─ 1. Tekshirish: Agar chat_id boshqa patient'ga bog'langan bo'lsa
  │      └─ O'chirish: DELETE FROM telegram_chat_ids 
  │         WHERE chat_id = '123456789'
  │
  ├─ 2. Upsert (Insert yoki Update):
  │      INSERT INTO telegram_chat_ids 
  │      (patient_id, chat_id, username, first_name, phone, updated_at)
  │      VALUES ('123', '123456789', '@username', 'Bemor', '+998901234567', NOW())
  │      ON CONFLICT (patient_id) DO UPDATE ...
  │
  └─ Return: true/false (success/failure)
```

**Nima uchun Duplicate Chat_ID tekshirish kerak?**
- Bir Telegram user (chat_id) faqat bitta bemor'ga tegishli bo'lishi kerak
- Agar shu chat_id boshqa bemor bilan ro'yxatdan o'tsa, eski bog'lanishni o'chirish kerak

---

### 7. **src/utils/validators.js** - Validatsiya

```javascript
isValidPatientId(patientId)
  ├─ Regex: /^[a-zA-Z0-9_-]+$/
  └─ Qabul qiladi: 123, abc_123, abc-def

normalizePhone(phone)
  ├─ Input: "901234567" yoki "+998 90 123 45 67"
  ├─ Output: "+998901234567" (yoki null agar noto'g'ri)
  ├─ Faqat raqamlar va + qoldiradi
  └─ Uzunligi 9-15 raqam bo'lsa qabul qiladi
  └─ + bo'lmasa, +998 qo'shadi (Uzbekistan)

isValidPhone(phone)
  └─ normalizePhone(phone) !== null
```

**Misollari:**
```
"901234567" → "+998901234567" ✅
"+998901234567" → "+998901234567" ✅
"90 123 45 67" → "+998901234567" ✅
"+998 (90) 123-45-67" → "+998901234567" ✅
"123" → null ❌ (quyi uzunlik)
"abc" → null ❌ (raqam emas)
```

---

## 🗄️ DATABASE STRUKTURA

### Supabase: `telegram_chat_ids` Jadval

```sql
CREATE TABLE telegram_chat_ids (
  patient_id TEXT PRIMARY KEY,        -- ShifoCRM'dagi bemor ID
  chat_id TEXT NOT NULL UNIQUE,       -- Telegram user ID (unique!)
  username TEXT,                      -- Telegram @username
  first_name TEXT,                    -- Bemor ismi Telegram'dan
  phone TEXT,                         -- Telefon raqam (qidirishda ishlatilingan)
  created_at TIMESTAMPTZ,             -- Yaratilgan vaqti
  updated_at TIMESTAMPTZ              -- Oxirgi yangilangan vaqti
);

-- Indexes:
CREATE UNIQUE INDEX idx_telegram_chat_ids_chat_id_unique 
  ON telegram_chat_ids(chat_id);
-- Maqsadi: chat_id tayyorlash va duplicates oldini olish

CREATE INDEX idx_telegram_chat_ids_phone 
  ON telegram_chat_ids(phone);
-- Maqsadi: telefon bo'yicha tez qidirish

-- Trigger: updated_at avtomatik yangilanadi
CREATE TRIGGER update_telegram_chat_ids_updated_at
  BEFORE UPDATE ON telegram_chat_ids
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### ShifoCRM: `patients` Jadval (O'qish uchun)

```sql
SELECT id, full_name, phone FROM patients;

-- Ustunlar:
- id (INT PRIMARY KEY)
- full_name (TEXT) - Bemor F.I.O
- phone (TEXT) - Turli formatda saqlangan bo'lishi mumkin:
  * +998901234567
  * 998901234567
  * 901234567
  * +998 90 123 45 67
  * va boshqa variantlar...
- med_id (TEXT OPTIONAL) - Medical ID (agar mavjud bo'lsa)
```

**Nega 7 variant qidirish kerak?**
- Database'da telefon turli formatda saqlangan bo'lishi mumkin
- Data entry errors yoki system variantlari
- Bemor har xil formatda kiritishi mumkin

---

## 🚀 DEPLOYMENT VA ENVIRONMENT

### Local Development

```bash
npm install
cp .env.example .env
# .env ni to'ldiring:
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-key
PORT=3001
HOST=0.0.0.0
BOT_API_KEY=your-secret-key

npm run dev  # Watch mode
```

### Production - PM2 (Doimiy Jarayon)

```bash
npm run pm2:start          # Ishga tushirish
npm run pm2:restart        # Qayta tushirish
npm run pm2:stop           # To'xtatish
npm run pm2:logs           # Loglarni ko'rish
npm run pm2:save           # Saqlab qo'yish
npm run pm2:startup        # Windows startup'ga qo'shish
```

**Konfiguratsiya:** `ecosystem.config.js`
```javascript
{
  name: 'shifocrm-telegram-bot',
  script: 'src/index.js',
  instances: 1,
  autorestart: true,        // Server qayta ishga tushganda avtomatik
  max_memory_restart: '500M',
  error_file: './logs/pm2-error.log',
  out_file: './logs/pm2-out.log'
}
```

### Cloud - Railway.app

```
Railway Dashboard:
  Variables:
  - TELEGRAM_BOT_TOKEN = ...
  - SUPABASE_URL = ...
  - SUPABASE_SERVICE_KEY = ...
  - PORT = 3001 (auto-assigned)
  - BOT_API_KEY = ... (optional)

Deploy: Push to GitHub → Railway avtomatik deploy qiladi
```

---

## 🔐 SECURITY VA CONFIGURATION

### 1. Environment Variables

```
.env (LOCAL - git ignore)
├── TELEGRAM_BOT_TOKEN ⚠️ Xavfsiz (BotFather'dan)
├── SUPABASE_SERVICE_KEY ⚠️ Xavfsiz (server-side only)
├── SUPABASE_URL (public, ammo key bilan combined)
├── BOT_API_KEY ⚠️ Xavfsiz (API protection uchun)
└── PORT, HOST (public, lekin sensitive emas)

Railway (CLOUD):
├── Variables → Encrypted
├── .env fayl yo'q
└── Environment variables to'g'ridan-to'g'ri set qilinadi
```

### 2. API Security

**Header tekshirish:**
```javascript
X-API-KEY: <BOT_API_KEY>

// server.js'da:
function checkApiKey(req, res, next) {
  const apiKey = process.env.BOT_API_KEY;
  
  if (!apiKey) {
    // API key yo'q bo'lsa, tekshirish o'tkazib yuboriladi
    return next();
  }
  
  if (req.headers['x-api-key'] !== apiKey) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  next();
}
```

### 3. CORS (Hozircha Xavfsiz Emas)

```javascript
// Hozircha:
Access-Control-Allow-Origin: *  // Barcha origin'lardan ruxsat

// Production'da o'zgartirilishi kerak:
Access-Control-Allow-Origin: https://yourdomain.com
Access-Control-Allow-Origin: https://crm.yourdomain.com
```

### 4. Telegram Token

- Private, shulamiz
- BotFather'dan olingan
- Leak bo'lsa yangi token olinishi kerak

---

## 📊 DATA FLOW

### Scenario 1: Ro'yxatdan O'tish

```
Bemor (Telegram)
    │
    ├─ /register buyrug'i yubor
    │   ↓
    ├─ Bot: "Telefon raqam yuboring"
    │   (userState[chatId] = { step: 'waiting_phone' })
    │
    ├─ Bemor: 901234567 (yubor)
    │   ↓
    ├─ bot.js (on 'message'):
    │   ├─ validatsiya: isValidPhone('901234567') ✅
    │   ├─ normalize: normalizePhone('901234567') → '+998901234567'
    │   ├─ qidirish: getPatientByPhone('+998901234567')
    │   │   ↓
    │   │   patientRepo.js → SELECT FROM patients (7 variant)
    │   │   → ShifoCRM database
    │   │   ← Return: { id: 123, full_name: 'Bemor Ismi', phone: '+998901234567' }
    │   │
    │   ├─ topildi ✅
    │   │   ├─ saveTelegramChatId({
    │   │   │   patientId: '123',
    │   │   │   chatId: '987654321',
    │   │   │   username: '@username',
    │   │   │   firstName: 'Bemor',
    │   │   │   phone: '+998901234567'
    │   │   │ })
    │   │   │   ↓
    │   │   │   telegramChatRepo.js → UPSERT INTO telegram_chat_ids
    │   │   │   ← Supabase
    │   │   │
    │   │   ├─ clearUserState(chatId)
    │   │   │
    │   │   └─ bot.sendMessage():
    │   │       "✅ Ro'yxatdan o'ttingiz, Bemor Ismi!
    │   │        Patient ID: 123
    │   │        Telefon: +998901234567"
    │
    └─ Bemor (Telegram): Xabar qabul qildi ✅
```

### Scenario 2: Xabar Yuborish (ShifoCRM'dan)

```
ShifoCRM Backend
    │
    ├─ POST /api/send
    │   ├─ Headers: X-API-KEY: secret123
    │   ├─ Body: { patient_id: "123", message: "Qabul vaqti: 10:00" }
    │
    ├─ server.js:
    │   ├─ checkApiKey() → X-API-KEY tekshirish ✅
    │   ├─ getTelegramChatId('123')
    │   │   ↓
    │   │   telegramChatRepo.js → SELECT chat_id FROM telegram_chat_ids
    │   │   WHERE patient_id = '123'
    │   │   ← Supabase
    │   │   ← Return: '987654321'
    │   │
    │   ├─ topildi ✅
    │   │   ├─ bot.sendMessage('987654321', 'Qabul vaqti: 10:00')
    │   │   │   ↓
    │   │   │   Telegram API
    │   │   │
    │   │   └─ Response: { ok: true }
    │
    └─ Bemor (Telegram): "Qabul vaqti: 10:00" xabari qabul qildi ✅
```

---

## 🔍 DEBUGGING VA LOGGING

### Console Loglar

```javascript
// Bot loglar:
console.log('✅ Ro\'yxatdan o\'tgansiz');      // Success
console.error('❌ Xatolik yuz berdi');          // Error
console.warn('⚠️ Ogohlantirish');              // Warning

// Repository loglar:
console.log('🔍 Telefon raqam qidirilmoqda'); // Debug
console.log('📞 Normalize qilingan');          // Debug
console.log('1️⃣ Variant 1 qidirilmoqda');     // Debug
console.log('✅ Topildi');                     // Found
console.log('❌ Topilmadi');                    // Not found
```

### PM2 Loglar

```bash
npm run pm2:logs
# yoki
pm2 logs shifocrm-telegram-bot

# Log fayllar:
./logs/pm2-error.log    # Faqat xatoliklar
./logs/pm2-out.log      # Barcha output
```

### Debug Mode (Development)

```bash
npm run dev     # Watch mode (fayllar o'zgarsa, avtomatik qayta ishga tushadi)
# Terminal'da barcha loglar ko'rinadi
```

---

## ⚙️ KONFIGURATSIYA FAYLLAR

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
  "scripts": {
    "start": "node src/index.js",           // Production
    "dev": "node --watch src/index.js",     // Development (watch mode)
    "pm2:start": "pm2 start ecosystem.config.js",
    "pm2:restart": "pm2 restart shifocrm-telegram-bot",
    "pm2:logs": "pm2 logs shifocrm-telegram-bot"
  },
  "dependencies": {
    "node-telegram-bot-api": "^0.66.0",  // Telegram Bot API
    "express": "^4.18.2",                // Web server
    "dotenv": "^16.3.1",                 // .env yuklash
    "@supabase/supabase-js": "^2.39.0"   // Supabase client
  }
}
```

### .env (Template)

```
# Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij

# Supabase
SUPABASE_URL=https://xxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server
PORT=3001
HOST=0.0.0.0

# Security (optional, pero production'da tavsiya)
BOT_API_KEY=your-secret-api-key-12345

# Environment (PM2'da set qilinadi)
NODE_ENV=development
```

---

## 🎯 MUHIM TUSHUNCHALAR

### 1. FSM (Finite State Machine)
```javascript
userStates = {
  [chatId]: { step: 'waiting_phone' }
}
// Qanday qadam kutilmoqda (step) ni saqlash
```

### 2. Normalize (Normallashtirish)
```
"901234567" → "+998901234567"
"+998 90 123-45-67" → "+998901234567"
// Barcha variantlarni bir xil formatga keltirish
```

### 3. Upsert
```sql
INSERT INTO telegram_chat_ids (patient_id, chat_id, ...)
ON CONFLICT (patient_id) DO UPDATE SET ...
-- Agar patient_id mavjud bo'lsa update, yo'q bo'lsa insert
```

### 4. Index
```sql
CREATE INDEX idx_phone ON telegram_chat_ids(phone);
-- Database qidirishni tezlashtirish
```

### 5. CORS
```
Cross-Origin Resource Sharing
Frontend → Backend so'rov yuborishga ruxsat berish
```

### 6. Environment Variable
```
.env fayldan yoki system'dan olingan sozlamalar
Local dev'da .env, Production'da system variables
```

---

## 🚨 XATOLAR VA YECHIMLAR

### Xato 1: "TELEGRAM_BOT_TOKEN topilmadi"
**Sabab:** Environment variable set qilinmagan  
**Yechim:** .env'ga qo'shish yoki Railway dashboard'da kiritish

### Xato 2: "CHAT_ID_NOT_FOUND"
**Sabab:** Bemor ro'yxatdan o'tmagan  
**Yechim:** Bemor /register orqali ro'yxatdan o'tishi kerak

### Xato 3: "SUPABASE_SERVICE_KEY topilmadi"
**Sabab:** Supabase konfiguratsiyasi yo'q  
**Yechim:** Supabase project yaratish va key'ni .env'ga qo'shish

### Xato 4: Telefon topilmadi (7 variant bittasi ham ishlamadi)
**Sabab:** Database'dagi telefon format boshqacha  
**Yechim:** Database'da telefon format'ini tekshirish va qidirishga variant qo'shish

### Xato 5: CORS error
**Sabab:** Frontend boshqacha domain'dan API chaqirmoqda  
**Yechim:** server.js'da CORS o'zgartirilishi kerak

---

## 📈 LOYIHANING DEVELOPMENT ROADMAP

### Hozirgi Funksionalligi ✅
- ✅ Telegram bot /start, /help, /register
- ✅ Telefon qidiruvi (7 variant)
- ✅ Bemor ro'yxatdan o'tishi
- ✅ Xabar yuborish API (/api/send)
- ✅ PM2 process manager

### Qo'shimchi Xususiyatlar (Future)
- [ ] Authentication (login sistema)
- [ ] Appointment notifications (qabul eslatmalari)
- [ ] Analytics va reporting
- [ ] Admin panel
- [ ] Multi-language support
- [ ] Rate limiting
- [ ] Error tracking (Sentry)
- [ ] Unit tests
- [ ] TypeScript migration

---

## 🎓 LEARNING RESOURCES

- **Node.js docs:** https://nodejs.org/docs/
- **Express.js:** https://expressjs.com/
- **Telegram Bot API:** https://core.telegram.org/bots/api
- **Supabase docs:** https://supabase.com/docs
- **PM2 docs:** https://pm2.keymetrics.io/

---

## 📝 CHEAT SHEET

```bash
# Loyihani klonlash
git clone https://github.com/otajonovm/shifocrmbot.git
cd ShifoCRM_bot

# Dependencies o'rnatish
npm install

# .env yaratish
cp .env.example .env
# .env ni to'ldiring

# Local dev'da ishga tushirish
npm run dev
# http://localhost:3001 da mavjud

# Production'da ishga tushirish (PM2)
npm run pm2:start

# Loglarni ko'rish
npm run pm2:logs

# Bot'ni qayta tushirish
npm run pm2:restart

# Bot'ni to'xtatish
npm run pm2:stop

# Health check
curl http://localhost:3001/health

# Xabar yuborish
curl -X POST http://localhost:3001/api/send \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your-api-key" \
  -d '{"patient_id": "123", "message": "Xabar"}'
```

---

## 🎯 OXIRGI XULOSALAR

1. **Maqsad:** Bemolarni Telegram orqali ro'yxatdan o'ttirish va xabar yuborish
2. **Tech Stack:** Node.js + Express + Telegram API + Supabase
3. **Asosiy Files:** bot.js (FSM), patientRepo.js (qidirish), server.js (API)
4. **Database:** telegram_chat_ids (Supabase) ← → patients (ShifoCRM)
5. **Deployment:** Local (npm), PM2 (doimiy), Railway (cloud)
6. **Security:** API Key, Environment Variables, CORS
7. **Debugging:** Console logs, PM2 logs, watch mode

**Loyiha ishlatuvchi uchun:** Telegram bot ishlatish oson (faqat /register), amaliy qismlar backend'da
**Developers uchun:** FSM va Multi-variant qidirish tushunish muhim

---

**Tayyorlandi:** 2025-03-02  
**Maqsad:** Yangi developers uchun loyiha tushuntirilishi
