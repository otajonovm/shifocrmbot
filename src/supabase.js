const { createClient } = require('@supabase/supabase-js');

// O'zgaruvchilarni olinishi (null-safety bilan)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase environment variables topilmadi!');
  // Logda aynan nima kelayotganini ko'rish uchun:
  console.log('DEBUG -> URL:', supabaseUrl); 
  console.log('DEBUG -> KEY:', supabaseKey);
  
  throw new Error('SUPABASE_URL yoki SUPABASE_SERVICE_KEY Railway dashboardda kiritilmagan!');
}

// Bo'sh joylarni faqat qiymat mavjud bo'lgandagina olib tashlaymiz
const supabase = createClient(supabaseUrl.trim(), supabaseKey.trim());

module.exports = supabase;