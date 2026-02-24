# Botni PM2 orqali ishga tushirish
Write-Host "=== BOTNI PM2 ORQALI ISHGA TUSHIRISH ===" -ForegroundColor Cyan
Write-Host ""

# PM2 ni tekshirish
$pm2Installed = Get-Command pm2 -ErrorAction SilentlyContinue
if (-not $pm2Installed) {
    Write-Host "❌ PM2 o'rnatilmagan!" -ForegroundColor Red
    Write-Host "   Avval 'npm install -g pm2' yoki './setup-pm2.ps1' ni ishga tushiring!" -ForegroundColor Yellow
    exit 1
}

# Botni ishga tushirish
Write-Host "Botni ishga tushirish..." -ForegroundColor Yellow
pm2 start ecosystem.config.js

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Bot ishga tushirildi!" -ForegroundColor Green
    Write-Host ""
    pm2 status
    Write-Host ""
    Write-Host "Loglarni ko'rish: pm2 logs shifocrm-telegram-bot" -ForegroundColor Cyan
} else {
    Write-Host "❌ Xatolik yuz berdi!" -ForegroundColor Red
}
