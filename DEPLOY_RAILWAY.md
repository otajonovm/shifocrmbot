# Railway'ga Deploy Qilish

Railway free tier'da bot doimiy ishlab turadi (uxlamaydi). ✅

## 1. Railway'ga Kirish

1. https://railway.app ga kiring
2. GitHub account bilan kirish
3. "New Project" → "Deploy from GitHub repo"
4. `shifocrmbot` reponi tanlang

## 2. Environment Variables Qo'shish

Railway dashboard'da "Variables" bo'limiga o'ting va quyidagilarni qo'shing:

```
TELEGRAM_BOT_TOKEN=your-bot-token
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-supabase-service-key
PORT=3001
BOT_API_KEY=your-secret-api-key  # ixtiyoriy
HOST=0.0.0.0
```

## 3. Deploy

Railway avtomatik deploy qiladi. Bir necha daqiqadan keyin bot ishga tushadi.

## 4. URL ni Olish

Railway sizga URL beradi:
```
https://your-app-name.railway.app
```

## 5. ShifoCRM'da Ishlatish

ShifoCRM `.env` faylga:

```env
VITE_TELEGRAM_API_URL=https://your-app-name.railway.app
```

## 6. Test Qilish

```bash
curl https://your-app-name.railway.app/health
```

## Afzalliklari

- ✅ Free tier'da uxlamaydi
- ✅ Avtomatik deploy (GitHub push'dan keyin)
- ✅ HTTPS avtomatik
- ✅ Loglar mavjud
- ✅ Oson sozlash

## Cheklovlar

- Free tier'da oyiga $5 credit (odatda yetarli)
- Agar credit tugasa, to'xtaydi (lekin uxlamaydi)
