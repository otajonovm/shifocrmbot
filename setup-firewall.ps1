# Windows Firewall'da port 3001 ni ochish skripti
Write-Host "=== WINDOWS FIREWALL SOZLASH ===" -ForegroundColor Cyan
Write-Host ""

# Administrator huquqlarini tekshirish
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ Xatolik: Bu skriptni Administrator sifatida ishga tushirish kerak!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Qanday qilish:" -ForegroundColor Yellow
    Write-Host "1. PowerShell'ni yoping" -ForegroundColor White
    Write-Host "2. PowerShell'ni o'ng tugma bilan bosing va 'Run as Administrator' ni tanlang" -ForegroundColor White
    Write-Host "3. Qayta bu skriptni ishga tushiring" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "✅ Administrator huquqlari mavjud" -ForegroundColor Green
Write-Host ""

# Firewall rule mavjudligini tekshirish
$existingRule = Get-NetFirewallRule -DisplayName "Telegram Bot Server" -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "⚠️  Firewall rule allaqachon mavjud" -ForegroundColor Yellow
    Write-Host "   O'chirib, qayta yaratilmoqda..." -ForegroundColor Yellow
    Remove-NetFirewallRule -DisplayName "Telegram Bot Server" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Yangi firewall rule yaratish
Write-Host "🔧 Firewall rule yaratilmoqda..." -ForegroundColor Cyan

try {
    New-NetFirewallRule -DisplayName "Telegram Bot Server" `
        -Direction Inbound `
        -LocalPort 3001 `
        -Protocol TCP `
        -Action Allow `
        -Description "ShifoCRM Telegram Bot Server - Port 3001" `
        -ErrorAction Stop
    
    Write-Host "✅ Firewall rule muvaffaqiyatli yaratildi!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Rule ma'lumotlari:" -ForegroundColor Cyan
    Write-Host "   Nomi: Telegram Bot Server" -ForegroundColor White
    Write-Host "   Port: 3001" -ForegroundColor White
    Write-Host "   Protokol: TCP" -ForegroundColor White
    Write-Host "   Harakat: Allow (Ruxsat berish)" -ForegroundColor White
    Write-Host ""
    Write-Host "✅ Endi boshqa kompyuterlar bot serveriga kirishlari mumkin!" -ForegroundColor Green
} catch {
    Write-Host "❌ Xatolik: Firewall rule yaratishda muammo" -ForegroundColor Red
    Write-Host "   Xatolik: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Qo'lda yaratish uchun quyidagi buyruqni bajaring:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "New-NetFirewallRule -DisplayName 'Telegram Bot Server' -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "=== YAKUN ===" -ForegroundColor Cyan
