# Botni PM2 orqali to'xtatish
Write-Host "=== BOTNI PM2 ORQALI TO'XTATISH ===" -ForegroundColor Cyan
Write-Host ""

pm2 stop shifocrm-telegram-bot

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Bot to'xtatildi!" -ForegroundColor Green
    Write-Host ""
    pm2 status
} else {
    Write-Host "❌ Xatolik yuz berdi!" -ForegroundColor Red
}
