const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

function decodeJwtRole(token) {
  try {
    const payloadPart = String(token || '').split('.')[1];
    if (!payloadPart) {
      return 'unknown';
    }
    const json = Buffer.from(payloadPart, 'base64url').toString('utf8');
    const payload = JSON.parse(json);
    return payload.role || payload.rol || 'unknown';
  } catch (_err) {
    return 'unknown';
  }
}

const supabaseKeyRole = decodeJwtRole(supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase environment variables topilmadi!');
  console.log('DEBUG -> URL:', supabaseUrl);
  console.log('DEBUG -> KEY:', supabaseKey ? '(mavjud)' : '(yo\'q)');
  throw new Error('SUPABASE_URL yoki SUPABASE_SERVICE_KEY Railway dashboardda kiritilmagan!');
}

if (supabaseKeyRole !== 'service_role') {
  console.warn(`⚠️ SUPABASE_SERVICE_KEY role="${supabaseKeyRole}" — keshbek uchun service_role kerak (anon emas).`);
  console.warn('   DigitalOcean: App-Level VA Component Variables ikkalasini ham yangilang.');
} else {
  console.log('✅ SUPABASE_SERVICE_KEY role=service_role');
}

const supabase = createClient(supabaseUrl.trim(), supabaseKey.trim(), {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

module.exports = supabase;
module.exports.supabaseKeyRole = supabaseKeyRole;