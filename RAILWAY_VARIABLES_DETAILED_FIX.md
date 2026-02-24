# Railway Variables - Batafsil Yechim

## Muammo

Variables Railway'da qo'shilgan, lekin bot ularni o'qiy olmayapti. Bu Railway'da juda keng tarqalgan muammo.

## Asosiy Sabablar

1. **Variable'lar "Service Variables" bo'limida emas**
2. **Variable nomlari noto'g'ri** (bo'sh joy, tirnoq, katta-kichik harf)
3. **Variable qiymatlari bo'sh yoki noto'g'ri**
4. **Redeploy qilinmagan** (restart yetarli emas)

## ✅ To'g'ri Yechim (Qadam-baqadam)

### Qadam 1: Railway Dashboard'ga Kiring

1. https://railway.app ga kiring
2. Project'ni tanlang (`shifocrmbot`)
3. **Variables** tab'ga o'ting

### Qadam 2: Eski Variable'larni O'chiring

1. Har bir variable'ni o'chiring:
   - `SUPABASE_SERVICE_KEY` → 3 nuqta → **Delete**
   - `SUPABASE_URL` → 3 nuqta → **Delete**
   - `TELEGRAM_BOT_TOKEN` → 3 nuqta → **Delete**

### Qadam 3: Raw Editor Orqali Qo'shing ⭐

1. **{} Raw Editor** tugmasini bosing
2. Quyidagilarni ko'chirib qo'shing (o'z qiymatlaringiz bilan):

```json
{
  "TELEGRAM_BOT_TOKEN": "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
  "SUPABASE_URL": "https://abcdefghijklmnop.supabase.co",
  "SUPABASE_SERVICE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQwMDAwMDAwLCJleHAiOjE5NTU1NzYwMDB9.xxxxx"
}
```

**⚠️ MUHIM:**
- `1234567890:ABC...` o'rniga **haqiqiy bot token** yozing
- `https://abcdefghijklmnop.supabase.co` o'rniga **haqiqiy Supabase URL** yozing
- `eyJhbGci...` o'rniga **haqiqiy service_role key** yozing

3. **Save** tugmasini bosing

### Qadam 4: Redeploy Qiling

1. **Settings** tab'ga o'ting
2. **Redeploy** tugmasini bosing
3. Yoki **Deployments** → Eng yuqoridagi deployment → **Redeploy**

**⚠️ Eslatma:** Restart yetarli emas! **Redeploy** qilish kerak!

### Qadam 5: Loglarni Tekshiring

Bir necha daqiqadan keyin:

1. **Deployments** → **View logs** → **Deploy Logs** tab
2. Quyidagilar ko'rinishi kerak:

```
🔍 Environment variables tekshirilmoqda...
   TELEGRAM_BOT_TOKEN: ✅ Mavjud
   SUPABASE_URL: ✅ Mavjud
   SUPABASE_SERVICE_KEY: ✅ Mavjud
   PORT: 8080
   HOST: 0.0.0.0 (default)

📋 Barcha environment variables:
   TELEGRAM_BOT_TOKEN = 1234567890:ABC...
   SUPABASE_URL = https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY = eyJhbGci...
   PORT = 8080
   HOST = 0.0.0.0

✅ Server ishga tushdi: http://0.0.0.0:8080
✅ Bot polling ishlayapti
```

---

## Agar Raw Editor Ishlamasa

### Variant 2: Qo'lda Qo'shish

1. **+ New Variable** tugmasini bosing
2. **TELEGRAM_BOT_TOKEN** qo'shing:
   - **Name:** `TELEGRAM_BOT_TOKEN` (to'liq to'g'ri, katta harflar)
   - **Value:** Bot token (to'liq, bo'sh joy yo'q, tirnoq yo'q)
   - **Add** tugmasini bosing
3. **SUPABASE_URL** qo'shing:
   - **Name:** `SUPABASE_URL` (to'liq to'g'ri)
   - **Value:** `https://xxxxx.supabase.co` (to'liq URL, `https://` bilan)
   - **Add** tugmasini bosing
4. **SUPABASE_SERVICE_KEY** qo'shing:
   - **Name:** `SUPABASE_SERVICE_KEY` (to'liq to'g'ri)
   - **Value:** Service key (to'liq, `eyJ` bilan boshlanishi kerak)
   - **Add** tugmasini bosing
5. **Settings** → **Redeploy**

---

## Variable Nomlari Tekshirish

Variable nomlari **mutlaqo to'g'ri** bo'lishi kerak:

✅ **TO'G'RI:**
```
TELEGRAM_BOT_TOKEN
SUPABASE_URL
SUPABASE_SERVICE_KEY
```

❌ **NOTO'G'RI:**
```
TELEGRAM_BOT_TOKEN   (bo'sh joy oxirida)
TELEGRAM_BOT_TOKEN   (ko'p bo'sh joy)
"TELEGRAM_BOT_TOKEN" (tirnoq)
TELEGRAM-BOT-TOKEN   (tire)
telegram_bot_token   (kichik harf)
```

---

## Variable Qiymatlari Tekshirish

Qiymatlar **bo'sh bo'lmasligi** va **to'liq** bo'lishi kerak:

✅ **TO'G'RI:**
```
TELEGRAM_BOT_TOKEN = 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
SUPABASE_URL = https://abcdefghijklmnop.supabase.co
SUPABASE_SERVICE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQwMDAwMDAwLCJleHAiOjE5NTU1NzYwMDB9.xxxxx
```

❌ **NOTO'G'RI:**
```
TELEGRAM_BOT_TOKEN = "1234567890:ABC..."  (tirnoq)
SUPABASE_URL = https://xxxxx.supabase.co  (bo'sh joy oxirida)
SUPABASE_SERVICE_KEY =                    (bo'sh)
SUPABASE_URL = xxxxx.supabase.co          (https:// yo'q)
```

---

## Service Variables vs Project Variables

Railway'da 2 xil variable scope bor:

1. **Service Variables** - Faqat shu service uchun (tavsiya etiladi)
2. **Project Variables** - Barcha service'lar uchun

**Tekshiring:**
- Variables tab → **"Shared Variable"** tugmasini bosing
- Agar "Project Variables" bo'limida variable'lar bo'lsa, ularni **Service Variables** ga ko'chiring

---

## Debug Loglar

Yangi kodda debug loglar qo'shildi. Redeploy qilgandan keyin **Deploy Logs** da quyidagilar ko'rinadi:

```
📋 Barcha environment variables:
   TELEGRAM_BOT_TOKEN = 1234567890:ABC...
   SUPABASE_URL = https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY = eyJhbGci...
```

Bu loglar qaysi variable'lar topilganini ko'rsatadi.

---

## Tezkor Test

Redeploy qilgandan keyin:

1. **Deploy Logs** ni oching
2. Quyidagilar ko'rinishi kerak:

```
✅ Server ishga tushdi: http://0.0.0.0:8080
✅ Bot polling ishlayapti
```

3. Health check:
```bash
curl https://your-railway-url.railway.app/health
```

`{"ok":true}` chiqishi kerak.

---

## Eng Keng Tarqalgan Xatoliklar

### 1. "Variables qo'shildi, lekin restart qilinmadi"
**Yechim:** **Redeploy** qiling (restart yetarli emas!)

### 2. "Variable nomi noto'g'ri" (bo'sh joy, tirnoq)
**Yechim:** Raw Editor orqali to'g'rilang

### 3. "Variable qiymati bo'sh yoki noto'g'ri"
**Yechim:** Qiymatni to'liq qo'shing

### 4. "Service Variables vs Project Variables"
**Yechim:** Service Variables'da bo'lishi kerak

### 5. "Variable'lar qo'shildi, lekin bot ularni o'qiy olmayapti"
**Yechim:** 
- Raw Editor orqali qo'shing
- Redeploy qiling
- Debug loglarni tekshiring

---

## Agar Hali Ham Ishlamasa

1. **Raw Editor** screenshot qiling (variable'lar ko'rinishi kerak)
2. **Deploy Logs** screenshot qiling (debug loglar ko'rinishi kerak)
3. Men ko'rib, aniqroq yechim beraman

---

**Eslatma:** Railway'da variable'lar qo'shilgandan keyin **Redeploy** qilish kerak! ⚠️
