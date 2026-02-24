# Bot Deploy Variantlari

## Telegram Bot uchun Hosting Tanlash

### ⭐ Railway (Tavsiya Etiladi)

**Afzalliklari:**
- ✅ Free tier'da **uxlamaydi** (doimiy ishlaydi)
- ✅ Oson sozlash
- ✅ GitHub bilan integratsiya
- ✅ HTTPS avtomatik
- ✅ Avtomatik deploy

**Cheklovlar:**
- Oyiga $5 credit (odatda yetarli)
- Credit tugasa to'xtaydi

**Narx:** Free tier mavjud, keyin $5/oy

**Link:** https://railway.app

---

### Render (Free Tier - Muammo Bor ❌)

**Muammo:**
- ❌ 15-20 daqiqada uxlab qoladi
- ❌ Bot ishlamaydi uxlab qolganida
- ❌ Xabarlar qabul qilinmaydi

**Yechim:**
- Paid tier ($7/oy) - uxlamaydi ✅

**Link:** https://render.com

---

### DigitalOcean App Platform

**Afzalliklari:**
- ✅ Uxlamaydi
- ✅ Kuchli
- ✅ Ishonchli

**Cheklovlar:**
- Free tier yo'q
- Minimal $5/oy

**Link:** https://www.digitalocean.com/products/app-platform

---

### VPS (DigitalOcean, Hetzner, va boshqalar)

**Afzalliklari:**
- ✅ To'liq nazorat
- ✅ Uxlamaydi
- ✅ Kuchli

**Cheklovlar:**
- O'rnatish murakkabroq
- PM2 yoki systemd sozlash kerak
- Server boshqarish bilim kerak

**Narx:** $4-6/oy

**Linklar:**
- DigitalOcean: https://www.digitalocean.com
- Hetzner: https://www.hetzner.com
- Vultr: https://www.vultr.com

---

### Heroku

**Muammo:**
- ❌ Free tier yo'q (2022'dan keyin)
- Minimal $7/oy

**Link:** https://www.heroku.com

---

## Qiyoslash Jadvali

| Hosting | Free Tier | Uxlamaydi | Narx | Osonlik |
|---------|-----------|-----------|------|---------|
| **Railway** | ✅ | ✅ | $5/oy | ⭐⭐⭐⭐⭐ |
| Render Free | ✅ | ❌ | Free | ⭐⭐⭐⭐ |
| Render Paid | ❌ | ✅ | $7/oy | ⭐⭐⭐⭐ |
| DigitalOcean | ❌ | ✅ | $5/oy | ⭐⭐⭐ |
| VPS | ❌ | ✅ | $4-6/oy | ⭐⭐ |
| Heroku | ❌ | ✅ | $7/oy | ⭐⭐⭐ |

---

## Tavsiya

**Telegram bot uchun eng yaxshi variant: Railway**

Sabab:
1. Free tier'da uxlamaydi ✅
2. Oson sozlash ✅
3. GitHub integratsiya ✅
4. HTTPS avtomatik ✅

---

## Tezkor Deploy (Railway)

1. https://railway.app ga kiring
2. GitHub bilan kirish
3. "New Project" → "Deploy from GitHub repo"
4. `otajonovm/shifocrmbot` reponi tanlang
5. Environment variables qo'shing:
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `PORT=3001`
   - `HOST=0.0.0.0`
6. Deploy avtomatik boshlanadi
7. URL ni oling va ShifoCRM'da ishlating

**Tayyor! Bot doimiy ishlaydi!** 🚀
