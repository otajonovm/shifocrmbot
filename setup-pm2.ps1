# PM2 o'rnatish va sozlash skripti
Write-Host "=== PM2 O'RNATISH VA SOZLASH ===" -ForegroundColor Cyan
Write-Host ""

# 1. PM2 ni o'rnatish
Write-Host "1. PM2 ni o'rnatish..." -ForegroundColor Yellow
npm install -g pm2

if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ PM2 o'rnatishda xatolik!" -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ PM2 muvaffaqiyatli o'rnatildi!" -ForegroundColor Green
Write-Host ""

# 2. Logs papkasini yaratish
Write-Host "2. Logs papkasini yaratish..." -ForegroundColor Yellow
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
    Write-Host "   ✅ Logs papkasi yaratildi!" -ForegroundColor Green
} else {
    Write-Host "   ✅ Logs papkasi allaqachon mavjud!" -ForegroundColor Green
}
Write-Host ""

# 3. Botni PM2 orqali ishga tushirish
Write-Host "3. Botni PM2 orqali ishga tushirish..." -ForegroundColor Yellow
pm2 start ecosystem.config.js

if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Botni ishga tushirishda xatolik!" -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ Bot PM2 orqali ishga tushirildi!" -ForegroundColor Green
Write-Host ""

# 4. PM2 ni saqlash (qayta ishga tushganda avtomatik ishga tushishi uchun)
Write-Host "4. PM2 konfiguratsiyasini saqlash..." -ForegroundColor Yellow
pm2 save

Write-Host "   ✅ PM2 konfiguratsiya saqlandi!" -ForegroundColor Green
Write-Host ""

# 5. Windows startup sozlash
Write-Host "5. Windows startup sozlash..." -ForegroundColor Yellow
Write-Host "   Quyidagi buyruqni ADMINISTRATOR sifatida bajarishingiz kerak:" -ForegroundColor Yellow
Write-Host "   pm2 startup" -ForegroundColor Cyan
Write-Host ""
Write-Host "   ⚠️  Eslatma: Bu buyruqni alohida PowerShell oynasida (Run as Administrator) bajarishingiz kerak!" -ForegroundColor Yellow
Write-Host ""

# 6. Status ko'rsatish
Write-Host "6. Bot holati:" -ForegroundColor Yellow
pm2 status
Write-Host ""

Write-Host "=== TAYYOR! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Foydali buyruqlar:" -ForegroundColor Cyan
Write-Host "  pm2 logs shifocrm-telegram-bot    - Loglarni ko'rish" -ForegroundColor White
Write-Host "  pm2 status                        - Bot holatini ko'rish" -ForegroundColor White
Write-Host "  pm2 restart shifocrm-telegram-bot - Botni qayta ishga tushirish" -ForegroundColor White
Write-Host "  pm2 stop shifocrm-telegram-bot    - Botni to'xtatish" -ForegroundColor White
Write-Host ""
