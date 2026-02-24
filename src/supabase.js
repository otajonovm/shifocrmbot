const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase environment variables topilmadi!');
  console.error('   SUPABASE_URL:', supabaseUrl ? 'Mavjud' : '❌ Yo\'q');
  console.error('   SUPABASE_SERVICE_KEY:', supabaseKey ? 'Mavjud' : '❌ Yo\'q');
  console.error('');
  console.error('💡 Railway dashboard\'da quyidagilarni qo\'shing:');
  console.error('   Railway → Variables → New Variable');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_KEY');
  throw new Error('SUPABASE_URL va SUPABASE_SERVICE_KEY .env faylda ko\'rsatilgan bo\'lishi kerak');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
