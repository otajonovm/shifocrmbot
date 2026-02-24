# ShifoCRM Integratsiya Muammolarni Hal Qilish

## PM2 o'rnatish server kodini o'zgartirmaydi

PM2 faqat process manager - u server kodini o'zgartirmaydi. Bot serveri `http://localhost:3001` da ishlayapti.

## Muammolar va yechimlar

### 1. CORS xatolik

**Muammo:** ShifoCRM frontend'dan so'rov yuborilganda CORS xatolik.

**Yechim:** CORS middleware qo'shildi. Agar hali ham muammo bo'lsa:

1. Bot serverini tekshiring:
   ```powershell
   pm2 logs shifocrm-telegram-bot
   ```

2. ShifoCRM'dan test qiling:
   ```javascript
   fetch('http://localhost:3001/health')
     .then(r => r.json())
     .then(console.log)
   ```

### 2. Server topilmayapti

**Muammo:** `fetch failed` yoki `ECONNREFUSED`

**Yechimlar:**

1. Bot serveri ishlayotganini tekshiring:
   ```powershell
   pm2 status
   ```

2. Portni tekshiring:
   ```powershell
   netstat -ano | findstr :3001
   ```

3. Botni qayta ishga tushiring:
   ```powershell
   pm2 restart shifocrm-telegram-bot
   ```

### 3. Environment variables

**Muammo:** ShifoCRM'da `VITE_TELEGRAM_API_URL` sozlanmagan

**Yechim:**

1. ShifoCRM loyihasida `.env` faylga qo'shing:
   ```
   VITE_TELEGRAM_API_URL=http://localhost:3001
   VITE_TELEGRAM_API_KEY=your-api-key  # agar bot'da BOT_API_KEY bo'lsa
   ```

2. Development server'ni qayta ishga tushiring (Vite/Next.js)

### 4. API key muammosi

**Muammo:** `401 UNAUTHORIZED`

**Yechim:**

1. Bot `.env` faylida `BOT_API_KEY` ni tekshiring
2. ShifoCRM `.env` faylida `VITE_TELEGRAM_API_KEY` ni tekshiring
3. Ikkalasi bir xil bo'lishi kerak

### 5. Patient topilmayapti

**Muammo:** `404 CHAT_ID_NOT_FOUND`

**Yechim:**

1. Patient bot'da ro'yxatdan o'tganini tekshiring:
   - Botga `/register` buyrug'ini yuborish kerak
   - Telefon raqamini kiritish kerak

2. Database'da tekshiring:
   ```sql
   SELECT * FROM telegram_chat_ids WHERE patient_id = 'YOUR_PATIENT_ID';
   ```

## Test qilish

### 1. Bot serverini test qilish

```powershell
# Health check
Invoke-WebRequest -Uri http://localhost:3001/health -UseBasicParsing

# Xabar yuborish test
$body = @{
    patient_id = "71583"
    message = "Test xabar"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3001/api/send -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
```

### 2. ShifoCRM'dan test qilish

```javascript
// Browser console'da yoki kodda
const response = await fetch('http://localhost:3001/api/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-KEY': 'your-api-key' // agar kerak bo'lsa
  },
  body: JSON.stringify({
    patient_id: '71583',
    message: 'Test xabar'
  })
});

const result = await response.json();
console.log(result);
```

## Production sozlash

### 1. Bot serverini deploy qilish

- Railway, Render, Vercel yoki boshqa hosting
- Environment variables'ni qo'shing
- HTTPS ishlating

### 2. ShifoCRM'da URL ni yangilash

```env
VITE_TELEGRAM_API_URL=https://your-bot-url.com
VITE_TELEGRAM_API_KEY=your-production-api-key
```

### 3. CORS sozlash

Production'da CORS'ni aniq domain'lar uchun sozlang:

```javascript
// src/server.js
const allowedOrigins = [
  'https://your-shifocrm-domain.com',
  'https://www.your-shifocrm-domain.com'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  // ...
});
```

## Foydali buyruqlar

```powershell
# Bot holatini ko'rish
pm2 status

# Loglarni ko'rish
pm2 logs shifocrm-telegram-bot

# Botni qayta ishga tushirish
pm2 restart shifocrm-telegram-bot

# Portni tekshirish
netstat -ano | findstr :3001

# Environment variables'ni tekshirish
pm2 env 0
```
