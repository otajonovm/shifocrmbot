# Railway Troubleshooting - Variables Qo'shilgan, Lekin Ishlamayapti

## Muammo

Environment variables qo'shilgan, lekin bot hali ham xatolik ko'rsatmoqda:
```
❌ Supabase environment variables topilmadi!
SUPABASE_URL: ❌ Yo'q
SUPABASE_SERVICE_KEY: ❌ Yo'q
```

## Yechimlar

### 1. Bot'ni Restart Qiling ⭐ (ENG MUHIM!)

Variables qo'shilgandan keyin **mutlaqo restart qilish kerak**:

1. Railway dashboard → **Deployments** tab
2. Eng yuqoridagi deployment'ni tanlang
3. **Restart** tugmasini bosing
4. Yoki **Settings** → **Redeploy** tugmasini bosing

**⚠️ Eslatma:** Variables qo'shilgandan keyin bot avtomatik restart bo'lmaydi!

---

### 2. Variable Nomlarini Tekshiring

Variable nomlari **to'liq to'g'ri** bo'lishi kerak (katta-kichik harf):

✅ **TO'G'RI:**
```
SUPABASE_URL
SUPABASE_SERVICE_KEY
TELEGRAM_BOT_TOKEN
```

❌ **NOTO'G'RI:**
```
supabase_url          (kichik harf)
Supabase_Url          (aralash)
SUPABASE-URL          (tire ishlatilgan)
SUPABASE URL          (bo'sh joy)
```

---

### 3. Variable Qiymatlarini Tekshiring

Qiymatlar **bo'sh bo'lmasligi** kerak:

✅ **TO'G'RI:**
```
SUPABASE_URL = https://abcdefghijklmnop.supabase.co
SUPABASE_SERVICE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

❌ **NOTO'G'RI:**
```
SUPABASE_URL =                    (bo'sh)
SUPABASE_URL = https://           (noto'g'ri URL)
SUPABASE_SERVICE_KEY =            (bo'sh)
```

---

### 4. Railway Variables Bo'limini Tekshiring

1. Railway dashboard → **Variables** tab
2. Quyidagilar **mavjud** va **to'g'ri** ekanligini tekshiring:

```
✅ TELEGRAM_BOT_TOKEN
✅ SUPABASE_URL
✅ SUPABASE_SERVICE_KEY
```

Agar yo'q bo'lsa, qo'shing:
- **New Variable** tugmasini bosing
- **Name:** `SUPABASE_URL` (to'liq to'g'ri)
- **Value:** Supabase URL (to'liq)
- **Add** tugmasini bosing

---

### 5. Variable Qiymatlarini Qayta Ko'chirib Qo'shing

Ba'zida Railway variable'ni to'g'ri o'qimaydi. Qayta qo'shing:

1. **Variables** tab → Variable'ni o'chiring (Delete)
2. **New Variable** → Qayta qo'shing
3. **Restart** qiling

---

### 6. Build Logs'ni Tekshiring

1. Railway dashboard → **Deployments** → **View logs**
2. **Build Logs** tab'ga o'ting
3. Quyidagilar ko'rinishi kerak:

```
✅ Build successful
✅ npm install completed
```

Agar build xatolik bo'lsa, uni tuzatish kerak.

---

### 7. Deploy Logs'ni Tekshiring

1. **Deploy Logs** tab'ga o'ting
2. Quyidagilar ko'rinishi kerak:

**✅ To'g'ri sozlangan bo'lsa:**
```
✅ Server ishga tushdi: http://0.0.0.0:3001
✅ Bot polling ishlayapti
```

**❌ Xatolik bo'lsa:**
```
❌ Supabase environment variables topilmadi!
```

---

## Qadam-baqadam Tekshirish

### Qadam 1: Variables Mavjudligini Tekshirish

Railway dashboard → **Variables** tab:

```
✅ TELEGRAM_BOT_TOKEN = 1234567890:ABC... (mavjud)
✅ SUPABASE_URL = https://xxxxx.supabase.co (mavjud)
✅ SUPABASE_SERVICE_KEY = eyJhbGci... (mavjud)
```

Agar bittasi ham yo'q bo'lsa → **Qo'shing**

### Qadam 2: Variable Nomlarini Tekshirish

Nomlar **to'liq to'g'ri** bo'lishi kerak:
- `SUPABASE_URL` (katta harflar, underscore)
- `SUPABASE_SERVICE_KEY` (katta harflar, underscore)
- `TELEGRAM_BOT_TOKEN` (katta harflar, underscore)

### Qadam 3: Variable Qiymatlarini Tekshirish

Qiymatlar **bo'sh bo'lmasligi** kerak va **to'liq** bo'lishi kerak:
- `SUPABASE_URL`: `https://` bilan boshlanishi kerak
- `SUPABASE_SERVICE_KEY`: `eyJ` bilan boshlanishi kerak (JWT token)
- `TELEGRAM_BOT_TOKEN`: `:` belgisi bo'lishi kerak

### Qadam 4: Restart Qiling

**Variables** qo'shilgandan keyin:
1. **Deployments** tab → **Restart** tugmasini bosing
2. Yoki **Settings** → **Redeploy**

### Qadam 5: Loglarni Tekshiring

**Deploy Logs** tab'da quyidagilar ko'rinishi kerak:

```
✅ Server ishga tushdi: http://0.0.0.0:3001
✅ Bot polling ishlayapti
```

---

## Tezkor Test

Variables qo'shilgandan keyin:

1. **Restart** qiling
2. Bir necha daqiqadan keyin **Deploy Logs** ni oching
3. Quyidagilar ko'rinishi kerak:

```
✅ Server ishga tushdi
✅ Bot polling ishlayapti
```

Agar hali ham xatolik bo'lsa:

1. **Variables** tab → Variable nomlarini va qiymatlarini qayta tekshiring
2. Agar noto'g'ri bo'lsa → O'chirib, qayta qo'shing
3. **Restart** qiling

---

## Eng Keng Tarqalgan Xatoliklar

### 1. "Variables qo'shildi, lekin restart qilinmadi"
**Yechim:** **Restart** qiling!

### 2. "Variable nomi noto'g'ri" (masalan, `supabase_url` o'rniga `SUPABASE_URL`)
**Yechim:** Nomni to'g'rilang yoki o'chirib, qayta qo'shing

### 3. "Variable qiymati bo'sh"
**Yechim:** To'liq qiymatni qo'shing

### 4. "Variable qiymati noto'g'ri" (masalan, `https://` yo'q)
**Yechim:** To'g'ri qiymatni qo'shing

---

## Agar Hali Ham Ishlamasa

1. **Variables** tab → Barcha variable'larni screenshot qiling
2. **Deploy Logs** → Eng oxirgi xatolikni screenshot qiling
3. Men ko'rib, aniqroq yechim beraman

---

**Eslatma:** Variables qo'shilgandan keyin **mutlaqo restart qilish kerak!** ⚠️
