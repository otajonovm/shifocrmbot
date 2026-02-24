# Kompyuterning IP manzilini topish skripti
Write-Host "=== KOMPYUTERNING IP MANZILLARI ===" -ForegroundColor Cyan
Write-Host ""

# Barcha network interfeyslarni olish
$networkInterfaces = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*"
} | Select-Object IPAddress, InterfaceAlias, PrefixLength

if ($networkInterfaces) {
    Write-Host "📡 Topilgan IP manzillar:" -ForegroundColor Green
    Write-Host ""
    
    $localIPs = @()
    foreach ($interface in $networkInterfaces) {
        $ip = $interface.IPAddress
        $name = $interface.InterfaceAlias
        $prefix = $interface.PrefixLength
        
        Write-Host "   IP: $ip" -ForegroundColor Yellow
        Write-Host "   Interface: $name" -ForegroundColor Gray
        Write-Host "   Subnet: /$prefix" -ForegroundColor Gray
        Write-Host ""
        
        $localIPs += $ip
    }
    
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🌐 Bot serveri URL'lar:" -ForegroundColor Green
    Write-Host ""
    
    foreach ($ip in $localIPs) {
        $url = "http://$ip:3001"
        Write-Host "   $url" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "💡 ShifoCRM .env faylida quyidagilardan birini ishlating:" -ForegroundColor Cyan
    Write-Host ""
    foreach ($ip in $localIPs) {
        Write-Host "   VITE_TELEGRAM_API_URL=http://$ip:3001" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "⚠️  Eslatma: Windows Firewall'da port 3001 ni ochish kerak!" -ForegroundColor Yellow
    Write-Host "   Quyidagi buyruqni Administrator sifatida bajaring:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   New-NetFirewallRule -DisplayName 'Telegram Bot Server' -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "❌ IP manzillar topilmadi" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== YAKUN ===" -ForegroundColor Cyan
