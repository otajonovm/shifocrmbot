# Bot Serverini Network Orqali Kirish Mumkin Qilish

## Muammo

Bot serveri hozir faqat `localhost` (127.0.0.1) da ishlayapti. Bu shuni anglatadiki, faqat o'sha kompyuterni o'zidan kirish mumkin. Boshqa kompyuterlar yoki internet orqali kirish uchun sozlash kerak.

## Yechimlar

### Variant 1: Local Network (LAN) - Bir xil tarmoqda

Agar barcha kompyuterlar bir xil Wi-Fi yoki Ethernet tarmog'ida bo'lsa:

#### 1-qadam: IP manzilni topish

```powershell
.\get-ip.ps1
```

Yoki qo'lda:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*"
} | Select-Object IPAddress, InterfaceAlias
```

**Misol natija:**
```
IP: 192.168.1.100
Interface: Wi-Fi
```

#### 2-qadam: Windows Firewall'da portni ochish

**⚠️ MUHIM:** PowerShell'ni **Administrator sifatida** oching!

```powershell
.\setup-firewall.ps1
```

Yoki qo'lda:

```powershell
New-NetFirewallRule -DisplayName "Telegram Bot Server" `
    -Direction Inbound `
    -LocalPort 3001 `
    -Protocol TCP `
    -Action Allow
```

#### 3-qadam: Bot serverini qayta ishga tushirish

```powershell
pm2 restart shifocrm-telegram-bot
```

Yoki:

```powershell
.\restart-pm2.ps1
```

#### 4-qadam: ShifoCRM'da URL ni yangilash

ShifoCRM loyihasida `.env` faylga qo'shing:

```env
VITE_TELEGRAM_API_URL=http://192.168.1.100:3001
```

**⚠️ Eslatma:** `192.168.1.100` o'rniga o'z IP manzilingizni yozing!

#### 5-qadam: Test qilish

Boshqa kompyuterdan yoki telefon'dan test qiling:

```powershell
# Boshqa kompyuterdan
Invoke-WebRequest -Uri http://192.168.1.100:3001/health -UseBasicParsing
```

Yoki browser'dan: `http://192.168.1.100:3001/health`

---

### Variant 2: Internet Orqali (Production)

Agar internet orqali kirish kerak bo'lsa, bir nechta variant bor:

#### Variant 2A: Ngrok (Tezkor Test)

**1. Ngrok o'rnatish:**

```powershell
# Chocolatey orqali
choco install ngrok

# Yoki manual: https://ngrok.com/download
```

**2. Ngrok ishga tushirish:**

```powershell
ngrok http 3001
```

**3. Ngrok URL ni olish:**

Ngrok quyidagicha URL beradi:
```
Forwarding: https://abc123.ngrok.io -> http://localhost:3001
```

**4. ShifoCRM'da ishlatish:**

```env
VITE_TELEGRAM_API_URL=https://abc123.ngrok.io
```

**⚠️ Eslatma:** 
- Ngrok free versiyada har restart'dan keyin URL o'zgaradi
- Production uchun tavsiya etilmaydi
- Faqat test uchun

#### Variant 2B: VPS/Cloud Hosting (Production)

**Tavsiya etiladigan hosting'lar:**
- **Railway** (https://railway.app) - Oson, tekin boshlash
- **Render** (https://render.com) - Tekin tier mavjud
- **Heroku** (https://heroku.com) - Eski, lekin ishonchli
- **DigitalOcean** (https://digitalocean.com) - $5/oy
- **AWS EC2** (https://aws.amazon.com) - Kuchli, lekin murakkab

**Deploy qilish:**

1. **GitHub'ga yuklash:**
   ```powershell
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/shifocrm-telegram-bot.git
   git push -u origin main
   ```

2. **Railway'da deploy:**
   - Railway'ga kirib, "New Project" → "Deploy from GitHub repo"
   - Repo'ni tanlang
   - Environment variables qo'shing:
     - `TELEGRAM_BOT_TOKEN`
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_KEY`
     - `PORT` (Railway avtomatik beradi)
     - `BOT_API_KEY` (ixtiyoriy)

3. **URL ni olish:**
   Railway sizga URL beradi: `https://your-app.railway.app`

4. **ShifoCRM'da ishlatish:**
   ```env
   VITE_TELEGRAM_API_URL=https://your-app.railway.app
   ```

#### Variant 2C: Port Forwarding (Router)

Agar o'z serveringizda ishlatmoqchi bo'lsangiz:

1. **Router'da port forwarding sozlang:**
   - Router admin panel'ga kiring (odatda `192.168.1.1`)
   - Port Forwarding yoki Virtual Server bo'limiga o'ting
   - Yangi rule yarating:
     - External Port: 3001 (yoki boshqa)
     - Internal IP: Bot serveri kompyuterining IP manzili
     - Internal Port: 3001
     - Protocol: TCP

2. **Public IP manzilni topish:**
   ```powershell
   (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing).Content
   ```

3. **ShifoCRM'da ishlatish:**
   ```env
   VITE_TELEGRAM_API_URL=http://YOUR_PUBLIC_IP:3001
   ```

**⚠️ Xavfsizlik:**
- Port forwarding xavfsizlik xavfi tug'diradi
- API key ishlating (`BOT_API_KEY`)
- HTTPS ishlating (Let's Encrypt yoki Cloudflare)

---

## Sozlamalar

### Bot Server Sozlamalari

`.env` faylga qo'shing (ixtiyoriy):

```env
# HOST (default: 0.0.0.0 - barcha interfeyslar uchun)
HOST=0.0.0.0

# PORT (default: 3001)
PORT=3001
```

**HOST variantlari:**
- `0.0.0.0` - Barcha network interfeyslar (tavsiya etiladi)
- `localhost` yoki `127.0.0.1` - Faqat local (default)
- `192.168.1.100` - Aniq IP manzil

### CORS Sozlamalari

Production'da CORS'ni aniq domain'lar uchun sozlang:

`src/server.js` faylida:

```javascript
const allowedOrigins = [
  'http://localhost:5173', // Development
  'https://your-shifocrm-domain.com', // Production
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  // ...
});
```

---

## Test Qilish

### 1. Local Network Test

```powershell
# Bot serveri kompyuterida
.\get-ip.ps1

# Boshqa kompyuterdan
Invoke-WebRequest -Uri http://BOT_IP:3001/health -UseBasicParsing
```

### 2. Internet Test

```powershell
# Browser'dan
https://your-bot-url.com/health

# Yoki curl
curl https://your-bot-url.com/health
```

### 3. ShifoCRM'dan Test

Browser console'da:

```javascript
const response = await fetch('http://BOT_IP:3001/api/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    patient_id: '71583',
    message: 'Test xabar'
  })
});

const result = await response.json();
console.log(result);
```

---

## Muammolarni Hal Qilish

### 1. "Connection refused" yoki "ECONNREFUSED"

**Sabab:** Firewall portni bloklayapti yoki server ishlamayapti

**Yechim:**
```powershell
# Firewall rule tekshirish
Get-NetFirewallRule -DisplayName "Telegram Bot Server"

# Portni tekshirish
netstat -ano | findstr :3001

# Bot serverini qayta ishga tushirish
pm2 restart shifocrm-telegram-bot
```

### 2. "Timeout" yoki "Network unreachable"

**Sabab:** IP manzil noto'g'ri yoki tarmoqda muammo

**Yechim:**
```powershell
# IP manzilni qayta topish
.\get-ip.ps1

# Ping test
ping BOT_IP

# ShifoCRM .env faylini tekshirish
# VITE_TELEGRAM_API_URL to'g'ri bo'lishi kerak
```

### 3. CORS xatolik

**Sabab:** CORS sozlanmagan yoki noto'g'ri sozlangan

**Yechim:**
- `src/server.js` da CORS middleware tekshiring
- Production'da aniq domain'lar ko'rsating

### 4. Bot ishlamayapti

**Yechim:**
```powershell
# Loglarni ko'rish
pm2 logs shifocrm-telegram-bot

# Botni qayta ishga tushirish
pm2 restart shifocrm-telegram-bot

# Environment variables tekshirish
pm2 env 0
```

---

## Xavfsizlik

### 1. API Key Ishlatish

`.env` faylga qo'shing:

```env
BOT_API_KEY=your-secret-api-key-here
```

ShifoCRM `.env` faylga:

```env
VITE_TELEGRAM_API_KEY=your-secret-api-key-here
```

### 2. HTTPS Ishlatish (Production)

- Let's Encrypt (tekin SSL)
- Cloudflare (tekin SSL + CDN)
- Nginx reverse proxy

### 3. Firewall Sozlamalari

- Faqat kerakli portlarni oching
- IP whitelist ishlating (agar mumkin bo'lsa)
- Rate limiting qo'shing

---

## Foydali Buyruqlar

```powershell
# IP manzilni topish
.\get-ip.ps1

# Firewall sozlash
.\setup-firewall.ps1

# Botni qayta ishga tushirish
pm2 restart shifocrm-telegram-bot

# Loglarni ko'rish
pm2 logs shifocrm-telegram-bot

# Portni tekshirish
netstat -ano | findstr :3001

# Firewall rule'ni ko'rish
Get-NetFirewallRule -DisplayName "Telegram Bot Server"
```

---

## Qadam-baqadam: Local Network Sozlash

1. ✅ IP manzilni topish: `.\get-ip.ps1`
2. ✅ Firewall sozlash: `.\setup-firewall.ps1` (Administrator)
3. ✅ Botni qayta ishga tushirish: `pm2 restart shifocrm-telegram-bot`
4. ✅ ShifoCRM `.env` ga URL qo'shish: `VITE_TELEGRAM_API_URL=http://YOUR_IP:3001`
5. ✅ Test qilish: Browser'dan `http://YOUR_IP:3001/health`

---

**Tayyor! Endi boshqa kompyuterlar bot serveriga kirishlari mumkin!** 🎉
