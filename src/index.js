require('dotenv').config();
const { app, PORT } = require('./server');
// Bot avtomatik ishga tushadi (bot.js import qilinganda)

// HOST environment variable (default: 0.0.0.0 - barcha network interfeyslar uchun)
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`✅ Server ishga tushdi: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`✅ Bot polling ishlayapti`);
  
  // Local IP manzilni ko'rsatish (agar 0.0.0.0 bo'lsa)
  if (HOST === '0.0.0.0') {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    const localIPs = [];
    
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      for (const iface of interfaces) {
        // Faqat IPv4 va internal bo'lmagan (yoki internal) manzillarni ko'rsatish
        if (iface.family === 'IPv4' && !iface.internal) {
          localIPs.push(`http://${iface.address}:${PORT}`);
        }
      }
    }
    
    if (localIPs.length > 0) {
      console.log(`\n🌐 Boshqa kompyuterlar uchun URL'lar:`);
      localIPs.forEach(ip => console.log(`   ${ip}`));
      console.log(`\n💡 ShifoCRM .env faylida quyidagilardan birini ishlating:`);
      localIPs.forEach(ip => console.log(`   VITE_TELEGRAM_API_URL=${ip}`));
    }
  }
});
