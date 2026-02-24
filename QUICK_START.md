# Tezkor Boshlash Yo'riqnomasi

## Botni ishga tushirish

### 1. PM2 orqali (Tavsiya etiladi - doimiy ishlab turishi uchun)

```powershell
# Avval PM2 ni o'rnatish (faqat bir marta)
.\setup-pm2.ps1

# Botni ishga tushirish
.\start-pm2.ps1
# yoki
pm2 start ecosystem.config.js

# Botni to'xtatish
.\stop-pm2.ps1
# yoki
pm2 stop shifocrm-telegram-bot

# Botni qayta ishga tushirish
.\restart-pm2.ps1
# yoki
pm2 restart shifocrm-telegram-bot

# Loglarni ko'rish
.\logs-pm2.ps1
# yoki
pm2 logs shifocrm-telegram-bot

# Bot holatini ko'rish
pm2 status
```

### 2. Oddiy ishga tushirish (development uchun)

**⚠️ Eslatma:** Agar PM2 orqali bot ishlayotgan bo'lsa, avval uni to'xtatishingiz kerak:

```powershell
# PM2 ni to'xtatish
pm2 stop shifocrm-telegram-bot
# yoki
pm2 delete shifocrm-telegram-bot

# Keyin oddiy ishga tushirish
npm start
# yoki
npm run dev
```

## Windows Startup Sozlash

Kompyuter qayta ishga tushganda bot avtomatik ishga tushishi uchun:

1. **PowerShell'ni Administrator sifatida oching**
2. Quyidagi buyruqni bajaring:
   ```powershell
   pm2 startup
   ```
3. Bu buyruq sizga qo'shimcha buyruq beradi, uni ko'chirib bajarishingiz kerak
4. Keyin:
   ```powershell
   pm2 save
   ```

## Muammolarni hal qilish

### Port 3001 band

Agar `EADDRINUSE: address already in use :::3001` xatolik bersa:

```powershell
# PM2 botni to'xtatish
pm2 stop shifocrm-telegram-bot

# Yoki portni ishlatayotgan jarayonni topish va to'xtatish
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Bot ishlamayapti

```powershell
# Loglarni tekshirish
pm2 logs shifocrm-telegram-bot --err

# Botni qayta ishga tushirish
pm2 restart shifocrm-telegram-bot
```

### PM2 botni topmayapti

```powershell
# Barcha PM2 processlarni ko'rish
pm2 list

# Botni qayta ishga tushirish
pm2 start ecosystem.config.js
pm2 save
```

## Foydali buyruqlar

```powershell
# Bot holatini ko'rish
pm2 status

# Real-time loglar
pm2 logs shifocrm-telegram-bot

# Botni to'xtatish
pm2 stop shifocrm-telegram-bot

# Botni qayta ishga tushirish
pm2 restart shifocrm-telegram-bot

# Botni butunlay o'chirish (PM2 dan)
pm2 delete shifocrm-telegram-bot

# Barcha PM2 processlarni ko'rish
pm2 list

# PM2 monitoring (real-time)
pm2 monit
```
