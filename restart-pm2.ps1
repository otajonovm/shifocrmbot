# Botni PM2 orqali qayta ishga tushirish
Write-Host "=== BOTNI PM2 ORQALI QAYTA ISHGA TUSHIRISH ===" -ForegroundColor Cyan
Write-Host ""

pm2 restart shifocrm-telegram-bot

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Bot qayta ishga tushirildi!" -ForegroundColor Green
    Write-Host ""
    pm2 status
    Write-Host ""
    Write-Host "Loglarni ko'rish: pm2 logs shifocrm-telegram-bot" -ForegroundColor Cyan
} else {
    Write-Host "❌ Xatolik yuz berdi!" -ForegroundColor Red
}
