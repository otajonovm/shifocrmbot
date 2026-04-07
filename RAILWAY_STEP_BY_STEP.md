# Railway Variables - Qadam-baqadam Yechim (Screenshot bilan)

## ❌ Muammo

Variables qo'shilgan, lekin bot hali ham xatolik ko'rsatmoqda:
```
SUPABASE_URL: ❌ Yo'q
SUPABASE_SERVICE_KEY: ❌ Yo'q
```

## ✅ YECHIM (Qadam-baqadam)

### QADAM 1: Railway Dashboard'ga Kiring

1. https://railway.app ga kiring
2. Project'ni tanlang (`shifocrmbot`)
3. **Variables** tab'ga o'ting

### QADAM 2: Barcha Eski Variable'larni O'chiring

**⚠️ MUHIM:** Avval barcha eski variable'larni o'chiring!

1. Har bir variable'ni o'chiring:
   - `SUPABASE_SERVICE_KEY` → 3 nuqta (o'ng burchakda) → **Delete**
   - `SUPABASE_URL` → 3 nuqta → **Delete**
   - `TELEGRAM_BOT_TOKEN` → 3 nuqta → **Delete**

### QADAM 3: ENV Tab Orqali Qo'shing ⭐

**⚠️ MUHIM:** JSON tab emas, **ENV tab** ishlating!

1. **Variables** tab'da **ENV** tugmasini bosing (JSON tugmasining yonida)
2. Quyidagilarni **key=value** formatida qo'shing (har biri alohida qatorda):

```
TELEGRAM_BOT_TOKEN=8593671786:AAHEQFDVZ9Y_qTHjwcS0yxTM3T1hDJe-L_Q
SUPABASE_URL=https://qwngzvtanjlkvdbkvbew.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3bmd6dnRhbmpsa3ZkYmt2YmV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwODIwMDE5NCwiZXhwIjoyMDgzNjA2MTk0fQ.JzIhqv6JwMtQv0fyMH9T4310A4VDjVAIB7KOUZHqOCg
```

**⚠️ MUHIM:**
- ✅ Har bir variable **alohida qator**da
- ✅ **Tirnoq yo'q** (`"` belgisi ishlatmang)
- ✅ **Bo'sh joy yo'q** (`=` belgisining atrofida)
- ✅ **Key=Value** formatida (masalan: `TELEGRAM_BOT_TOKEN=8593671786:...`)

3. **Save** tugmasini bosing

### QADAM 4: Redeploy Qiling (ENG MUHIM!)

**⚠️ MUHIM:** Restart yetarli emas! **Redeploy** qilish kerak!

1. **Settings** tab'ga o'ting
2. **Redeploy** tugmasini bosing
3. Yoki **Deployments** → Eng yuqoridagi deployment → **Redeploy** tugmasini bosing

**Eslatma:** Redeploy 1-2 daqiqa davom etadi.

### QADAM 5: Loglarni Tekshiring

Redeploy qilgandan keyin (1-2 daqiqadan keyin):

1. **Deployments** tab'ga o'ting
2. Eng yuqoridagi deployment'ni tanlang
3. **View logs** tugmasini bosing
4. **Deploy Logs** tab'ga o'ting
5. Quyidagilar ko'rinishi kerak:

```
🔍 Environment variables tekshirilmoqda...
   TELEGRAM_BOT_TOKEN: ✅ Mavjud
   SUPABASE_URL: ✅ Mavjud
   SUPABASE_SERVICE_KEY: ✅ Mavjud

📋 Barcha environment variables:
   TELEGRAM_BOT_TOKEN = 8593671786:AAHEQ...
   SUPABASE_URL = https://qwngzvtanjlkvdbkvbew.supabase.co
   SUPABASE_SERVICE_KEY = eyJhbGci...

✅ Server ishga tushdi: http://0.0.0.0:8080
✅ Bot polling ishlayapti
```

---

## ❌ Agar ENV Tab Yo'q Bo'lsa

Agar Railway'da ENV tab yo'q bo'lsa, **qo'lda qo'shing**:

### Variant 2: Qo'lda Qo'shish

1. **Variables** tab → **+ New Variable** tugmasini bosing
2. **TELEGRAM_BOT_TOKEN** qo'shing:
   - **Name:** `TELEGRAM_BOT_TOKEN` (to'liq to'g'ri, katta harflar)
   - **Value:** `8593671786:AAHEQFDVZ9Y_qTHjwcS0yxTM3T1hDJe-L_Q` (tirnoq yo'q!)
   - **Add** tugmasini bosing

3. **+ New Variable** → **SUPABASE_URL** qo'shing:
   - **Name:** `SUPABASE_URL` (to'liq to'g'ri)
   - **Value:** `https://qwngzvtanjlkvdbkvbew.supabase.co` (tirnoq yo'q!)
   - **Add** tugmasini bosing

4. **+ New Variable** → **SUPABASE_SERVICE_KEY** qo'shing:
   - **Name:** `SUPABASE_SERVICE_KEY` (to'liq to'g'ri)
   - **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3bmd6dnRhbmpsa3ZkYmt2YmV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwODIwMDE5NCwiZXhwIjoyMDgzNjA2MTk0fQ.JzIhqv6JwMtQv0fyMH9T4310A4VDjVAIB7KOUZHqOCg` (to'liq, tirnoq yo'q!)
   - **Add** tugmasini bosing

5. **Settings** → **Redeploy**

---

## ⚠️ ENG KENG TARQALGAN XATOLIKLAR

### 1. "Variables qo'shildi, lekin redeploy qilinmadi"
**Yechim:** **Redeploy** qiling! (Restart yetarli emas!)

### 2. "JSON format ishlatilgan"
**Yechim:** ENV format ishlating! (key=value, tirnoq yo'q)

### 3. "Variable nomi noto'g'ri"
**Yechim:** Nom to'liq to'g'ri bo'lishi kerak: `TELEGRAM_BOT_TOKEN` (katta harflar)

### 4. "Variable qiymatida tirnoq bor"
**Yechim:** Tirnoqni olib tashlang! (`"8593671786:..."` emas, `8593671786:...`)

---

## 📋 Tekshirish Ro'yxati

Redeploy qilgandan keyin quyidagilarni tekshiring:

- [ ] Variables tab'da 3 ta variable ko'rinmoqdami?
- [ ] Variable nomlari to'g'rimi? (`TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`)
- [ ] Variable qiymatlari to'liqmi? (bo'sh emas)
- [ ] Redeploy qilinganmi? (Settings → Redeploy)
- [ ] Deploy Logs'da `✅ Mavjud` ko'rinmoqdami?

---

## 🎯 Eng Ishonchli Yechim

1. **Barcha eski variable'larni o'chiring**
2. **ENV tab orqali qo'shing** (JSON emas!)
3. **Redeploy qiling** (Restart emas!)
4. **Loglarni tekshiring**

---

**Tayyor! Endi bot Railway'da ishlaydi!** 🚀
