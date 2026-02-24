# Railway Variables Muammosi - To'g'ri Qo'yilgan, Lekin O'qilmayapti

## Muammo

Variables Railway'da qo'shilgan, lekin bot ularni o'qiy olmayapti:
```
TELEGRAM_BOT_TOKEN: ❌ Yo'q
SUPABASE_URL: ❌ Yo'q
SUPABASE_SERVICE_KEY: ❌ Yo'q
```

## Yechimlar

### 1. Raw Editor Orqali Qo'shing ⭐ (ENG MUHIM!)

Railway'da variable'lar ba'zida "New Variable" orqali to'g'ri qo'shilmaydi. **Raw Editor** ishlating:

1. Railway dashboard → **Variables** tab
2. **{} Raw Editor** tugmasini bosing
3. Quyidagilarni ko'chirib qo'shing:

```json
{
  "TELEGRAM_BOT_TOKEN": "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
  "SUPABASE_URL": "https://xxxxx.supabase.co",
  "SUPABASE_SERVICE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

4. **Save** tugmasini bosing
5. **Restart** qiling

---

### 2. Variable'lar Qayta Qo'shing

Ba'zida Railway variable'ni to'g'ri o'qimaydi. Qayta qo'shing:

1. **Variables** tab → Har bir variable'ni o'chiring (3 nuqta → Delete)
2. **+ New Variable** tugmasini bosing
3. Har birini qayta qo'shing:
   - **Name:** `TELEGRAM_BOT_TOKEN` (to'liq to'g'ri, katta harflar)
   - **Value:** Token qiymati (to'liq, bo'sh joy yo'q)
   - **Add** tugmasini bosing
4. **Restart** qiling

---

### 3. Variable Nomlarini Tekshiring

Variable nomlari **mutlaqo to'g'ri** bo'lishi kerak:

✅ **TO'G'RI:**
```
TELEGRAM_BOT_TOKEN
SUPABASE_URL
SUPABASE_SERVICE_KEY
```

❌ **NOTO'G'RI:**
```
TELEGRAM_BOT_TOKEN  (bo'sh joy oxirida)
TELEGRAM_BOT_TOKEN   (ko'p bo'sh joy)
TELEGRAM_BOT_TOKEN"  (tirnoq)
"TELEGRAM_BOT_TOKEN" (tirnoq)
```

---

### 4. Variable Qiymatlarini Tekshiring

Qiymatlar **bo'sh bo'lmasligi** va **to'liq** bo'lishi kerak:

✅ **TO'G'RI:**
```
TELEGRAM_BOT_TOKEN = 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
SUPABASE_URL = https://abcdefghijklmnop.supabase.co
SUPABASE_SERVICE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQwMDAwMDAwLCJleHAiOjE5NTU1NzYwMDB9.xxxxx
```

❌ **NOTO'G'RI:**
```
TELEGRAM_BOT_TOKEN = "1234567890:ABC..."  (tirnoq ishlatilgan)
SUPABASE_URL = https://xxxxx.supabase.co  (bo'sh joy oxirida)
SUPABASE_SERVICE_KEY =                     (bo'sh)
```

---

### 5. Service Variables vs Project Variables

Railway'da 2 xil variable scope bor:

1. **Service Variables** - Faqat shu service uchun
2. **Project Variables** - Barcha service'lar uchun

**Tekshiring:**
- Variables tab → **"Shared Variable"** tugmasini bosing
- Agar "Project Variables" bo'limida variable'lar bo'lsa, ularni **Service Variables** ga ko'chiring

---

### 6. Redeploy Qiling (Restart Emas!)

Ba'zida restart yetarli emas. **To'liq redeploy** qiling:

1. Railway dashboard → **Settings** tab
2. **Redeploy** tugmasini bosing
3. Yoki **Deployments** → Eng yuqoridagi deployment → **Redeploy**

---

### 7. Variable'lar Formatini Tekshiring

Railway'da variable'lar JSON formatida saqlanadi. **Raw Editor** orqali tekshiring:

1. **{} Raw Editor** tugmasini bosing
2. Quyidagicha ko'rinishi kerak:

```json
{
  "TELEGRAM_BOT_TOKEN": "1234567890:ABC...",
  "SUPABASE_URL": "https://xxxxx.supabase.co",
  "SUPABASE_SERVICE_KEY": "eyJhbGci..."
}
```

Agar noto'g'ri format bo'lsa → To'g'rilang va **Save**

---

## Qadam-baqadam Yechim

### Variant 1: Raw Editor Orqali (Tavsiya)

1. Railway dashboard → **Variables** tab
2. **{} Raw Editor** tugmasini bosing
3. Barcha variable'larni o'chiring
4. Quyidagilarni qo'shing:

```json
{
  "TELEGRAM_BOT_TOKEN": "YOUR_BOT_TOKEN_HERE",
  "SUPABASE_URL": "YOUR_SUPABASE_URL_HERE",
  "SUPABASE_SERVICE_KEY": "YOUR_SERVICE_KEY_HERE"
}
```

5. **Save** tugmasini bosing
6. **Settings** → **Redeploy** tugmasini bosing
7. Bir necha daqiqadan keyin **Deploy Logs** ni tekshiring

### Variant 2: Qayta Qo'shish

1. **Variables** tab → Har bir variable'ni o'chiring
2. **+ New Variable** → Har birini qayta qo'shing:
   - Nom: `TELEGRAM_BOT_TOKEN` (to'liq to'g'ri)
   - Value: Token (to'liq, bo'sh joy yo'q)
3. **Settings** → **Redeploy**
4. **Deploy Logs** ni tekshiring

---

## Tekshirish

Redeploy qilgandan keyin **Deploy Logs** da quyidagilar ko'rinishi kerak:

```
🔍 Environment variables tekshirilmoqda...
   TELEGRAM_BOT_TOKEN: ✅ Mavjud
   SUPABASE_URL: ✅ Mavjud
   SUPABASE_SERVICE_KEY: ✅ Mavjud
   PORT: 8080
   HOST: 0.0.0.0 (default)

✅ Server ishga tushdi: http://0.0.0.0:8080
✅ Bot polling ishlayapti
```

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

---

## Agar Hali Ham Ishlamasa

1. **Raw Editor** screenshot qiling (variable'lar ko'rinishi kerak)
2. **Deploy Logs** screenshot qiling (xatolik ko'rinishi kerak)
3. Men ko'rib, aniqroq yechim beraman

---

**Eslatma:** Railway'da variable'lar qo'shilgandan keyin **Redeploy** qilish kerak! ⚠️
