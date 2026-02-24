# Botni toza ishga tushirish skripti
Write-Host "=== BOTNI TOZA ISHGA TUSHIRISH ===" -ForegroundColor Cyan
Write-Host ""

# 1. Eski jarayonlarni to'xtatish
Write-Host "1. Eski jarayonlarni to'xtatish..." -ForegroundColor Yellow
$portProcess = netstat -ano | findstr :3001 | ForEach-Object {
    if ($_ -match '\s+(\d+)$') {
        $matches[1]
    }
} | Select-Object -Unique

if ($portProcess) {
    foreach ($pid in $portProcess) {
        taskkill /PID $pid /F 2>&1 | Out-Null
    }
}

Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

Write-Host "   ✅ Eski jarayonlar to'xtatildi!" -ForegroundColor Green
Write-Host ""

# 2. Portni tekshirish
Write-Host "2. Portni tekshirish..." -ForegroundColor Yellow
$check = netstat -ano | findstr :3001
if ($check) {
    Write-Host "   ⚠️ Port hali ham band!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "   ✅ Port 3001 bo'sh va tayyor!" -ForegroundColor Green
}
Write-Host ""

# 3. Botni ishga tushirish
Write-Host "3. Botni ishga tushirish..." -ForegroundColor Cyan
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "Loglarni ko'rish uchun bu oynani yopmang!" -ForegroundColor Yellow
Write-Host "To'xtatish uchun Ctrl+C bosing" -ForegroundColor Yellow
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

npm start
