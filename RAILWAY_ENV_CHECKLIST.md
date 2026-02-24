# Railway Environment Variables Checklist

## ❌ CRASHED muammosi - Environment Variables

Agar bot Railway'da **CRASHED** bo'lsa, ehtimol environment variables qo'shilmagan.

## ✅ Kerakli Environment Variables

Railway dashboard → **Variables** bo'limiga o'ting va quyidagilarni qo'shing:

### 1. TELEGRAM_BOT_TOKEN (MAJBURIY)
```
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```
**Qayerdan olish:** BotFather → /mybots → Bot'ni tanlang → API Token

### 2. SUPABASE_URL (MAJBURIY)
```
SUPABASE_URL=https://xxxxx.supabase.co
```
**Qayerdan olish:** Supabase Dashboard → Settings → API → Project URL

### 3. SUPABASE_SERVICE_KEY (MAJBURIY)
```
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
**Qayerdan olish:** Supabase Dashboard → Settings → API → service_role key (secret)

### 4. PORT (Ixtiyoriy - Railway avtomatik beradi)
```
PORT=3001
```
**Eslatma:** Railway avtomatik PORT beradi, lekin agar kerak bo'lsa qo'shing.

### 5. HOST (Ixtiyoriy)
```
HOST=0.0.0.0
```
**Eslatma:** Railway uchun kerak emas, lekin qo'shish mumkin.

### 6. BOT_API_KEY (Ixtiyoriy - Xavfsizlik uchun)
```
BOT_API_KEY=your-secret-api-key-here
```
**Eslatma:** Production uchun tavsiya etiladi.

---

## Qanday Qo'shish

1. Railway dashboard'ga kiring
2. Project'ni tanlang (`shifocrmbot`)
3. **Variables** tab'ga o'ting
4. **New Variable** tugmasini bosing
5. Har bir variable uchun:
   - **Name:** `TELEGRAM_BOT_TOKEN` (masalan)
   - **Value:** Token yoki key qiymati
   - **Add** tugmasini bosing

---

## Tekshirish

Environment variables qo'shilgandan keyin:

1. **Deployments** tab'ga o'ting
2. **Restart** tugmasini bosing (yoki avtomatik qayta deploy bo'ladi)
3. **View logs** ni oching va quyidagilarni tekshiring:

**✅ To'g'ri sozlangan bo'lsa:**
```
✅ Server ishga tushdi: http://0.0.0.0:3001
✅ Bot polling ishlayapti
```

**❌ Xatolik bo'lsa:**
```
❌ TELEGRAM_BOT_TOKEN topilmadi!
❌ SUPABASE_URL topilmadi!
```

---

## Xatoliklar va Yechimlar

### 1. "TELEGRAM_BOT_TOKEN topilmadi"
**Sabab:** Variable qo'shilmagan yoki noto'g'ri nom
**Yechim:** 
- Railway → Variables → `TELEGRAM_BOT_TOKEN` ni tekshiring
- Nom to'g'ri bo'lishi kerak (katta-kichik harf)
- Value bo'sh bo'lmasligi kerak

### 2. "SUPABASE_URL topilmadi"
**Sabab:** Variable qo'shilmagan
**Yechim:**
- Railway → Variables → `SUPABASE_URL` ni qo'shing
- Supabase Dashboard'dan to'g'ri URL ni oling

### 3. "SUPABASE_SERVICE_KEY topilmadi"
**Sabab:** Variable qo'shilmagan
**Yechim:**
- Railway → Variables → `SUPABASE_SERVICE_KEY` ni qo'shing
- **service_role** key ishlating (secret key, public emas!)

### 4. Bot ishga tushdi, lekin xabar yuborish ishlamaydi
**Sabab:** Database migration qilinmagan
**Yechim:**
- Supabase SQL Editor'da `migrations/001_create_telegram_chat_ids.sql` ni ishga tushiring

---

## To'liq Sozlash Misoli

Railway Variables bo'limida quyidagilar bo'lishi kerak:

```
TELEGRAM_BOT_TOKEN = 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
SUPABASE_URL = https://abcdefghijklmnop.supabase.co
SUPABASE_SERVICE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQwMDAwMDAwLCJleHAiOjE5NTU1NzYwMDB9.xxxxx
PORT = 3001
HOST = 0.0.0.0
BOT_API_KEY = my-secret-api-key-12345
```

---

## Test Qilish

Environment variables qo'shilgandan keyin:

1. **Restart** tugmasini bosing
2. Bir necha daqiqadan keyin **View logs** ni oching
3. Quyidagilar ko'rinishi kerak:

```
✅ Server ishga tushdi: http://0.0.0.0:3001
✅ Bot polling ishlayapti
```

4. Health check:
```bash
curl https://your-railway-url.railway.app/health
```

`{"ok":true}` chiqishi kerak.

---

**Tayyor! Endi bot Railway'da ishlaydi!** 🚀
