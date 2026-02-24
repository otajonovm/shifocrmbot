# PM2 Sozlash Yo'riqnomasi

PM2 botni doimiy ishlab turishi uchun process manager. Bu botni serverda 24/7 ishlab turishi uchun eng oson va ishonchli yechim.

## Qadam 1: PM2 ni o'rnatish

```powershell
npm install -g pm2
```

Yoki avtomatik sozlash skriptini ishga tushiring:

```powershell
.\setup-pm2.ps1
```

## Qadam 2: Botni PM2 orqali ishga tushirish

```powershell
pm2 start ecosystem.config.js
```

Yoki:

```powershell
.\start-pm2.ps1
```

## Qadam 3: PM2 ni saqlash

Bu muhim! Botni saqlash kerak, aks holda kompyuter qayta ishga tushganda bot ishga tushmaydi:

```powershell
pm2 save
```

## Qadam 4: Windows Startup sozlash (majburiy)

Kompyuter qayta ishga tushganda bot avtomatik ishga tushishi uchun:

1. **PowerShell'ni Administrator sifatida oching** (o'ng tugma > Run as Administrator)
2. Quyidagi buyruqni bajaring:

```powershell
pm2 startup
```

3. Bu buyruq sizga qo'shimcha buyruq beradi, masalan:
   ```
   [PM2] To setup the Startup Script, copy/paste the following command:
   pm2 startup win32 -u Администратор --hp C:\Users\Администратор
   ```

4. Bu buyruqni ko'chirib, **o'sha o'sha Administrator PowerShell oynasida** bajarishingiz kerak.

5. Keyin yana:
   ```powershell
   pm2 save
   ```

Endi kompyuter qayta ishga tushganda bot avtomatik ishga tushadi!

## Foydali buyruqlar

### Botni boshqarish

```powershell
# Botni ishga tushirish
pm2 start shifocrm-telegram-bot
# yoki
.\start-pm2.ps1

# Botni to'xtatish
pm2 stop shifocrm-telegram-bot
# yoki
.\stop-pm2.ps1

# Botni qayta ishga tushirish
pm2 restart shifocrm-telegram-bot
# yoki
.\restart-pm2.ps1

# Botni butunlay o'chirish (PM2 dan)
pm2 delete shifocrm-telegram-bot
```

### Loglarni ko'rish

```powershell
# Real-time loglar
pm2 logs shifocrm-telegram-bot
# yoki
.\logs-pm2.ps1

# Oxirgi 100 qator
pm2 logs shifocrm-telegram-bot --lines 100

# Faqat xatoliklar
pm2 logs shifocrm-telegram-bot --err

# Loglarni tozalash
pm2 flush
```

### Bot holatini ko'rish

```powershell
# Barcha processlar
pm2 status

# Batafsil ma'lumot
pm2 show shifocrm-telegram-bot

# Monitoring (real-time)
pm2 monit
```

### Boshqa foydali buyruqlar

```powershell
# Barcha processlarni qayta ishga tushirish
pm2 restart all

# Barcha processlarni to'xtatish
pm2 stop all

# PM2 ni o'chirish (lekin processlar ishlaydi)
pm2 kill

# PM2 ni qayta ishga tushirish
pm2 resurrect
```

## Muammolarni hal qilish

### Bot ishga tushmayapti

1. Loglarni tekshiring:
   ```powershell
   pm2 logs shifocrm-telegram-bot --err
   ```

2. `.env` faylni tekshiring - barcha o'zgaruvchilar to'g'ri ko'rsatilganmi?

3. Portni tekshiring:
   ```powershell
   netstat -ano | findstr :3001
   ```

### Bot qayta ishga tushganda ishga tushmayapti

1. PM2 startup sozlanganligini tekshiring:
   ```powershell
   pm2 startup
   ```

2. PM2 save qilinganligini tekshiring:
   ```powershell
   pm2 list
   ```
   Agar bot ro'yxatda bo'lsa, `pm2 save` qiling.

### Loglar to'lib ketgan

```powershell
# Loglarni tozalash
pm2 flush

# Yoki logs/ papkasini tozalash
Remove-Item logs\* -Force
```

## PM2 afzalliklari

- ✅ **Avtomatik qayta ishga tushadi**: Bot crash bo'lsa, avtomatik qayta ishga tushadi
- ✅ **Memory limit**: 500MB dan oshsa, avtomatik qayta ishga tushadi
- ✅ **Loglar**: Barcha loglar `logs/` papkasida saqlanadi
- ✅ **Monitoring**: Real-time monitoring va status
- ✅ **Startup**: Kompyuter qayta ishga tushganda avtomatik ishga tushadi
- ✅ **Zero downtime**: Restart paytida ham ishlaydi

## Alternativ yechimlar

Agar PM2 ishlamasa, quyidagi variantlarni ko'rib chiqing:

1. **NSSM (Windows Service)**: `nssm install ShifoCRMBot node C:\path\to\src\index.js`
2. **Task Scheduler**: Windows Task Scheduler orqali
3. **Docker**: Docker container sifatida
4. **Cloud hosting**: Railway, Render, Vercel (eng oson)
