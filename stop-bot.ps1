# Botni to'xtatish skripti
Write-Host "=== BOTNI TO'XTATISH ===" -ForegroundColor Yellow
Write-Host ""

# Port 3001 ni ishlatayotgan jarayonni topish va to'xtatish
Write-Host "1. Port 3001 ni ishlatayotgan jarayonni topish..." -ForegroundColor Cyan
$portProcess = netstat -ano | findstr :3001 | ForEach-Object {
    if ($_ -match '\s+(\d+)$') {
        $matches[1]
    }
} | Select-Object -Unique

if ($portProcess) {
    foreach ($pid in $portProcess) {
        Write-Host "   Topildi: PID $pid" -ForegroundColor Green
        try {
            taskkill /PID $pid /F 2>&1 | Out-Null
            Write-Host "   ✅ To'xtatildi!" -ForegroundColor Green
        } catch {
            Write-Host "   ⚠️ To'xtatishda muammo" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "   Port 3001 bo'sh" -ForegroundColor Green
}

Write-Host ""
Write-Host "2. Barcha node jarayonlarini to'xtatish..." -ForegroundColor Cyan
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        Write-Host "   To'xtatilmoqda: PID $($proc.Id)" -ForegroundColor Yellow
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "   ✅ Barcha node jarayonlar to'xtatildi!" -ForegroundColor Green
} else {
    Write-Host "   Node jarayonlar topilmadi" -ForegroundColor Green
}

Write-Host ""
Write-Host "3. Portni tekshirish..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
$check = netstat -ano | findstr :3001
if ($check) {
    Write-Host "   ⚠️ Port hali ham band!" -ForegroundColor Red
    Write-Host "   Qolgan jarayonlar:" -ForegroundColor Yellow
    $check
} else {
    Write-Host "   ✅ Port 3001 bo'sh va tayyor!" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== YAKUN ===" -ForegroundColor Cyan
Write-Host "Bot to'xtatildi. Qayta ishga tushirish uchun: npm start" -ForegroundColor Green
