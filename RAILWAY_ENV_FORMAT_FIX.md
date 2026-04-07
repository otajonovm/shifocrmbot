# Railway ENV Format Xatolik - Yechim

## ❌ Xatolik

```
ERROR: invalid key-value pair "= SUPABASE_SERVICE_KEY=...": empty key
Error: Docker build failed
```

## 🔍 Sabab

ENV tab'da variable'lar noto'g'ri formatda qo'shilgan. Qator boshida `=` belgisi yoki bo'sh joy bor.

## ✅ YECHIM

### Qadam 1: Barcha Variable'larni O'chiring

1. Railway dashboard → **Variables** tab
2. Har bir variable'ni o'chiring:
   - `SUPABASE_SERVICE_KEY` → 3 nuqta → **Delete**
   - `SUPABASE_URL` → 3 nuqta → **Delete**
   - `TELEGRAM_BOT_TOKEN` → 3 nuqta → **Delete**

### Qadam 2: ENV Tab'da To'g'ri Formatda Qo'shing

1. **Variables** tab → **ENV** tab'ga o'ting
2. Quyidagilarni **to'g'ri formatda** qo'shing:

**✅ TO'G'RI FORMAT:**
```
TELEGRAM_BOT_TOKEN=8593671786:AAHEQFDVZ9Y_qTHjwcS0yxTM3T1hDJe-L_Q
SUPABASE_URL=https://qwngzvtanjlkvdbkvbew.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3bmd6dnRhbmpsa3ZkYmt2YmV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwODIwMDE5NCwiZXhwIjoyMDgzNjA2MTk0fQ.JzIhqv6JwMtQv0fyMH9T4310A4VDjVAIB7KOUZHqOCg
```

**❌ NOTO'G'RI FORMAT (Xatolik):**
```
= TELEGRAM_BOT_TOKEN=8593671786:...  ❌ (qator boshida =)
 TELEGRAM_BOT_TOKEN=8593671786:...   ❌ (qator boshida bo'sh joy)
"TELEGRAM_BOT_TOKEN=8593671786:..."  ❌ (tirnoq)
```

**⚠️ MUHIM:**
- ✅ Qator boshida **bo'sh joy yo'q**
- ✅ Qator boshida **`=` belgisi yo'q**
- ✅ **Tirnoq yo'q** (`"` belgisi ishlatmang)
- ✅ **Key=Value** formatida (masalan: `TELEGRAM_BOT_TOKEN=8593671786:...`)

3. **Save** tugmasini bosing

### Qadam 3: Redeploy Qiling

1. **Settings** tab'ga o'ting
2. **Redeploy** tugmasini bosing
3. Yoki **Deployments** → Eng yuqoridagi deployment → **Redeploy**

---

## 📋 To'g'ri Format Misoli

ENV tab'da quyidagicha ko'rinishi kerak:

```
TELEGRAM_BOT_TOKEN=8593671786:AAHEQFDVZ9Y_qTHjwcS0yxTM3T1hDJe-L_Q
SUPABASE_URL=https://qwngzvtanjlkvdbkvbew.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3bmd6dnRhbmpsa3ZkYmt2YmV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwODIwMDE5NCwiZXhwIjoyMDgzNjA2MTk0fQ.JzIhqv6JwMtQv0fyMH9T4310A4VDjVAIB7KOUZHqOCg
```

**Eslatma:**
- Har bir variable **alohida qator**da
- Qator boshida **bo'sh joy yo'q**
- **Tirnoq yo'q**
- **Key=Value** formatida

---

## ⚠️ Agar ENV Tab Ishlamasa

Agar ENV tab'da muammo bo'lsa, **qo'lda qo'shing**:

1. **Variables** tab → **+ New Variable**
2. Har birini alohida qo'shing:
   - **Name:** `TELEGRAM_BOT_TOKEN` (to'liq to'g'ri)
   - **Value:** `8593671786:AAHEQFDVZ9Y_qTHjwcS0yxTM3T1hDJe-L_Q` (tirnoq yo'q!)
   - **Add**
3. Xuddi shunday `SUPABASE_URL` va `SUPABASE_SERVICE_KEY` ni qo'shing
4. **Settings** → **Redeploy**

---

## ✅ Tekshirish

Redeploy qilgandan keyin **Build Logs** da quyidagilar ko'rinishi kerak:

```
✅ Build successful
✅ npm install completed
```

Va **Deploy Logs** da:

```
🔍 Environment variables tekshirilmoqda...
   TELEGRAM_BOT_TOKEN: ✅ Mavjud
   SUPABASE_URL: ✅ Mavjud
   SUPABASE_SERVICE_KEY: ✅ Mavjud

✅ Server ishga tushdi: http://0.0.0.0:8080
✅ Bot polling ishlayapti
```

---

**Tayyor! Endi bot Railway'da ishlaydi!** 🚀
