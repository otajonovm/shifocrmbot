# ShifoCRM Telegram Bot

Telegram bot ShifoCRM bilan integratsiya qilingan xabar yuborish uchun.

## Talablar

- Node.js 18+
- Telegram bot token (BotFather'dan)
- Supabase account va database

## O'rnatish

```bash
npm install
```

## Sozlash

1. `.env.example` ni `.env` ga nusxalang:
```bash
cp .env.example .env
```

2. `.env` faylni to'ldiring:
```
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
PORT=3001
BOT_API_KEY=your-secret-key  # ixtiyoriy, lekin production uchun tavsiya
```

## Database migratsiya

Supabase SQL Editor'da `migrations/001_create_telegram_chat_ids.sql` faylini ishga tushiring.

## Ishga tushirish

### Development
```bash
npm run dev
```

### Production (oddiy)
```bash
npm start
```

**⚠️ Eslatma:** Agar PM2 orqali bot ishlayotgan bo'lsa, `npm start` ishlamaydi (port band). PM2 buyruqlarini ishlating:
- `pm2 status` - bot holatini ko'rish
- `pm2 logs shifocrm-telegram-bot` - loglarni ko'rish
- `pm2 restart shifocrm-telegram-bot` - qayta ishga tushirish

### Production (PM2 - Doimiy ishlab turishi uchun) ⭐

PM2 botni doimiy ishlab turishi uchun process manager. Kompyuter qayta ishga tushganda ham avtomatik ishga tushadi.

#### 1. PM2 ni o'rnatish va sozlash:
```powershell
.\setup-pm2.ps1
```

Yoki qo'lda:
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
```

#### 2. Windows startup sozlash (kompyuter qayta ishga tushganda avtomatik ishga tushishi uchun):

**PowerShell'ni Administrator sifatida oching** va quyidagi buyruqni bajaring:
```bash
pm2 startup
```

Bu buyruq sizga qo'shimcha buyruq beradi, uni ko'chirib bajarishingiz kerak.

#### 3. Foydali buyruqlar:

```bash
# Botni ishga tushirish
.\start-pm2.ps1
# yoki
npm run pm2:start

# Botni to'xtatish
.\stop-pm2.ps1
# yoki
npm run pm2:stop

# Botni qayta ishga tushirish
.\restart-pm2.ps1
# yoki
npm run pm2:restart

# Loglarni ko'rish
.\logs-pm2.ps1
# yoki
npm run pm2:logs

# Bot holatini ko'rish
npm run pm2:status
# yoki
pm2 status

# Botni butunlay o'chirish
npm run pm2:delete
```

#### PM2 afzalliklari:
- ✅ Avtomatik qayta ishga tushadi (crash bo'lsa)
- ✅ Kompyuter qayta ishga tushganda avtomatik ishga tushadi
- ✅ Loglarni saqlaydi (`logs/` papkasida)
- ✅ Process monitoring
- ✅ Memory limit (500MB dan oshsa qayta ishga tushadi)

Bot **long polling** rejimida ishlaydi (webhook shart emas).

## Bot buyruqlari

- `/start` - Botni boshlash va qisqa onboarding
- `/help` - Buyruqlar ro'yxati
- `/register` - Ro'yxatdan o'tish (patient_id yoki telefon)

## API endpoints

### POST /api/send
Xabar yuborish.

**Body:**
```json
{
  "patient_id": "PAT123",
  "message": "Qabulingiz ertaga 15:00 da"
}
```

**Response:**
```json
{ "ok": true }
```

**Xatoliklar:**
- `404` - `{ "error": "CHAT_ID_NOT_FOUND" }` - Patient ro'yxatdan o'tmagan
- `400` - `{ "error": "PATIENT_ID_AND_MESSAGE_REQUIRED" }`
- `401` - `{ "error": "UNAUTHORIZED" }` - API key noto'g'ri (agar qo'shilgan bo'lsa)

### GET /health
Server holatini tekshirish.

**Response:**
```json
{ "ok": true }
```

## Xavfsizlik

Production uchun `BOT_API_KEY` ni qo'shing va ShifoCRM integratsiyada ham ishlating.

## Deploy

### Vercel
```bash
vercel
```

### Railway
Railway'ga repo'ni ulang va environment variables'ni qo'shing.

### Render
1. New Web Service
2. Repo'ni ulang
3. Build: `npm install`
4. Start: `npm start`
5. Environment variables'ni qo'shing

**Eslatma:** Long polling ishlatilgani uchun oddiy hostingda ham ishlaydi (webhook shart emas).

## ShifoCRM bilan integratsiya

Qarang: `TELEGRAM_INTEGRATION.md`
