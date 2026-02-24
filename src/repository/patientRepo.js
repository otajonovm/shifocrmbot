const supabase = require('../supabase');

/**
 * @param {string|number} patientId 
 * @returns {Promise<Object|null>} 
 */
async function getPatientById(patientId) {
  if (!patientId) {
    return null;
  }
  const trimmed = String(patientId).trim();
  
  // Avval id bo'yicha qidirish (raqam bo'lsa)
  const numId = Number(trimmed);
  if (Number.isFinite(numId) && numId > 0) {
    const { data, error } = await supabase
      .from('patients')
      .select('id, full_name, phone')
      .eq('id', numId)
      .maybeSingle();
    if (!error && data) {
      console.log(`Patient topildi (id=${numId}):`, data.id, data.full_name);
      return data;
    }
    if (error) {
      console.warn(`Patient qidirishda xatolik (id=${numId}):`, error.message);
    }
  }
  
  // Keyin med_id bo'yicha qidirish (agar med_id field'i mavjud bo'lsa)
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('id, full_name, phone')
      .eq('med_id', trimmed)
      .maybeSingle();
    if (!error && data) {
      console.log(`Patient topildi (med_id=${trimmed}):`, data.id, data.full_name);
      return data;
    }
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (bu normal)
      console.warn(`med_id bo'yicha qidirishda xatolik:`, error.message);
    }
  } catch (err) {
    // med_id field'i yo'q bo'lishi mumkin, ignore qilamiz
    console.warn('med_id bo\'yicha qidirishda exception:', err.message);
  }
  
  console.log(`Patient topilmadi: ${trimmed}`);
  return null;
}

/**
 * Telefon bo'yicha patient ni topadi
 * @param {string} phone
 * @returns {Promise<Object|null>} Patient ma'lumotlari yoki null
 */
async function getPatientByPhone(phone) {
  if (!phone) {
    console.log('getPatientByPhone: phone bo\'sh');
    return null;
  }
  
  console.log(`🔍 Telefon raqam qidirilmoqda: "${phone}"`);
  
  // Telefon raqamni normalize qilish (+998901234567 formatida)
  const normalizedPhone = phone.replace(/[^\d+]/g, '');
  console.log(`📞 Normalize qilingan: "${normalizedPhone}"`);
  
  // Avval to'g'ridan-to'g'ri qidirish
  console.log(`1️⃣ To'g'ridan-to'g'ri qidirish: "${normalizedPhone}"`);
  let { data, error } = await supabase
    .from('patients')
    .select('id, full_name, phone')
    .eq('phone', normalizedPhone)
    .limit(1);
  
  if (error) {
    console.log(`❌ Xatolik (1):`, error.message);
  } else if (data && data.length > 0) {
    const found = data[0];
    console.log(`✅ Topildi (1):`, found.id, found.full_name, found.phone);
    return found;
  } else {
    console.log(`❌ Topilmadi (1)`);
  }
  
  // Agar + bilan boshlanmasa, +998 qo'shib qayta qidirish
  if (!normalizedPhone.startsWith('+')) {
    const withPlus = `+998${normalizedPhone.replace(/^998/, '')}`;
    console.log(`2️⃣ +998 qo'shib qidirish: "${withPlus}"`);
    ({ data, error } = await supabase
      .from('patients')
      .select('id, full_name, phone')
      .eq('phone', withPlus)
      .limit(1));
    
    if (error) {
      console.log(`❌ Xatolik (2):`, error.message);
    } else if (data && data.length > 0) {
      const found = data[0];
      console.log(`✅ Topildi (2):`, found.id, found.full_name, found.phone);
      return found;
    } else {
      console.log(`❌ Topilmadi (2)`);
    }
  }
  
  // Agar +998 bilan boshlansa, +siz qidirish
  if (normalizedPhone.startsWith('+998')) {
    const withoutPlus = normalizedPhone.replace(/^\+998/, '998');
    console.log(`3️⃣ +siz qidirish: "${withoutPlus}"`);
    ({ data, error } = await supabase
      .from('patients')
      .select('id, full_name, phone')
      .eq('phone', withoutPlus)
      .limit(1));
    
    if (error) {
      console.log(`❌ Xatolik (3):`, error.message);
    } else if (data && data.length > 0) {
      const found = data[0];
      console.log(`✅ Topildi (3):`, found.id, found.full_name, found.phone);
      return found;
    } else {
      console.log(`❌ Topilmadi (3)`);
    }
  }
  
  // Qo'shimcha variantlar: faqat raqamlar
  const digitsOnly = normalizedPhone.replace(/[^\d]/g, '');
  console.log(`📱 Faqat raqamlar: "${digitsOnly}"`);
  
  if (digitsOnly.length >= 9) {
    // Variant 4: 998940542722 formatida (998 + 9 raqam)
    const with998 = digitsOnly.startsWith('998') ? digitsOnly : `998${digitsOnly}`;
    console.log(`4️⃣ 998 bilan qidirish: "${with998}"`);
    ({ data, error } = await supabase
      .from('patients')
      .select('id, full_name, phone')
      .eq('phone', with998)
      .limit(1));
    
    if (!error && data && data.length > 0) {
      const found = data[0];
      console.log(`✅ Topildi (4):`, found.id, found.full_name, found.phone);
      return found;
    }
    
    // Variant 5: +998940542722 formatida
    const withPlus998 = `+${with998}`;
    console.log(`5️⃣ +998 bilan qidirish: "${withPlus998}"`);
    ({ data, error } = await supabase
      .from('patients')
      .select('id, full_name, phone')
      .eq('phone', withPlus998)
      .limit(1));
    
    if (!error && data && data.length > 0) {
      const found = data[0];
      console.log(`✅ Topildi (5):`, found.id, found.full_name, found.phone);
      return found;
    }
    
    // Variant 6: Faqat oxirgi 9 raqam (940542722)
    // Agar 998 bilan boshlansa, uni olib tashlash
    const last9Digits = digitsOnly.length >= 9 
      ? digitsOnly.slice(-9) 
      : digitsOnly;
    console.log(`6️⃣ Faqat oxirgi 9 raqam: "${last9Digits}"`);
    ({ data, error } = await supabase
      .from('patients')
      .select('id, full_name, phone')
      .eq('phone', last9Digits)
      .limit(1));
    
    if (!error && data && data.length > 0) {
      const found = data[0];
      console.log(`✅ Topildi (6):`, found.id, found.full_name, found.phone);
      return found;
    }
    
    // Variant 7: LIKE bilan qidirish (oxirgi 9 raqam bilan)
    console.log(`7️⃣ LIKE bilan qidirish (oxirgi 9 raqam): "${last9Digits}"`);
    ({ data, error } = await supabase
      .from('patients')
      .select('id, full_name, phone')
      .like('phone', `%${last9Digits}`)
      .limit(1));
    
    if (!error && data && data.length > 0) {
      const found = data[0];
      console.log(`✅ Topildi (7 - LIKE):`, found.id, found.full_name, found.phone);
      return found;
    }
    
    // Variant 8: ILIKE bilan qidirish (case-insensitive)
    console.log(`8️⃣ ILIKE bilan qidirish: "%${last9Digits}"`);
    ({ data, error } = await supabase
      .from('patients')
      .select('id, full_name, phone')
      .ilike('phone', `%${last9Digits}%`)
      .limit(1));
    
    if (!error && data && data.length > 0) {
      const found = data[0];
      console.log(`✅ Topildi (8 - ILIKE):`, found.id, found.full_name, found.phone);
      return found;
    }
  }
  
  console.log(`❌ Hech qanday variant bilan topilmadi`);
  console.log(`💡 Qidirilgan raqam: "${phone}"`);
  console.log(`💡 Normalize qilingan: "${normalizedPhone}"`);
  console.log(`💡 Faqat raqamlar: "${digitsOnly}"`);
  return null;
}

module.exports = {
  getPatientById,
  getPatientByPhone,
};
