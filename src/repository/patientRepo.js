const supabase = require('../supabase');

const PHONE_FIELD_CANDIDATES = [
  'phone',
  'phone_number',
  'mobile',
  'phone_no',
  'telephone',
  'tel',
  'contact_phone',
  'phone1',
  'phone_1',
  'phone2',
  'phone_2',
  'primary_phone',
  'secondary_phone',
  'mobile_phone',
  'cell_phone',
  'contact',
  'contact_number',
  'contact_phone_number',
  'phone_number_1',
  'phone_number_2',
  'client_phone',
  'client_phone_number',
  'lead_phone',
  'lead_phone_number',
];

const phoneFieldsCache = new Map();

function toDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function isMissingColumnError(error) {
  if (!error) {
    return false;
  }

  const message = String(error.message || '');
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    /column .* does not exist|Could not find the .* column/i.test(message)
  );
}

function normalizeFoundRecord(found, tableName, phoneField) {
  const row = { ...found };
  row.full_name = row.full_name || row.name;
  if (!row.phone && phoneField && row[phoneField]) {
    row.phone = row[phoneField];
  }
  return { ...row, _table: tableName };
}

async function detectPhoneFields(tableName) {
  if (phoneFieldsCache.has(tableName)) {
    return phoneFieldsCache.get(tableName);
  }

  const detectedFields = [];

  for (const field of PHONE_FIELD_CANDIDATES) {
    const { error } = await supabase
      .from(tableName)
      .select(field)
      .limit(1);

    if (!error) {
      detectedFields.push(field);
      continue;
    }

    if (!isMissingColumnError(error)) {
      console.warn(`⚠️ Field tekshirishda xatolik (${tableName}.${field}):`, error.message);
    }
  }

  const finalFields = detectedFields.length > 0 ? detectedFields : ['phone'];

  if (detectedFields.length === 0) {
    console.warn(`⚠️ Telefon field topilmadi (${tableName}), fallback: phone`);
  } else {
    console.log(`📞 Telefon field(lar) (${tableName}): ${finalFields.join(', ')}`);
  }

  phoneFieldsCache.set(tableName, finalFields);
  return finalFields;
}

async function searchByFieldVariants(tableName, fields, variantLabel, operator, value, successTag) {
  for (const field of fields) {
    let query = supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (operator === 'eq') {
      query = query.eq(field, value);
    } else if (operator === 'like') {
      query = query.like(field, value);
    } else if (operator === 'ilike') {
      query = query.ilike(field, value);
    } else {
      return null;
    }

    const { data, error } = await query;

    if (error) {
      if (!isMissingColumnError(error)) {
        console.log(`❌ Xatolik (${variantLabel}/${field}):`, error.message);
      }
      continue;
    }

    if (data && data.length > 0) {
      const found = normalizeFoundRecord(data[0], tableName, field);
      const logPhone = found.phone || found[field] || '';
      console.log(`✅ Topildi (${successTag || variantLabel}) [${tableName}.${field}]:`, found.id, found.full_name, logPhone);
      return found;
    }
  }

  console.log(`❌ Topilmadi (${variantLabel})`);
  return null;
}

async function searchByNormalizedDigitsFallback(tableName, fields, digitsOnly) {
  if (!digitsOnly || digitsOnly.length < 9) {
    return null;
  }

  const last9Digits = digitsOnly.slice(-9);
  console.log(`9️⃣ Normalized fallback qidirish (digits): "${digitsOnly}" / last9="${last9Digits}"`);

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.log('❌ Xatolik (9):', error.message);
    return null;
  }

  for (const row of data || []) {
    for (const field of fields) {
      if (!row[field]) {
        continue;
      }

      const rowDigits = toDigits(row[field]);
      if (!rowDigits) {
        continue;
      }

      if (rowDigits === digitsOnly || rowDigits.endsWith(last9Digits)) {
        const found = normalizeFoundRecord(row, tableName, field);
        console.log(`✅ Topildi (9 - normalized) [${tableName}.${field}]:`, found.id, found.full_name, found.phone || row[field]);
        return found;
      }
    }
  }

  console.log('❌ Topilmadi (9 - normalized)');
  return null;
}

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
 * Berilgan jadvaldan telefon raqam orqali qidirish (8 xil variant bilan)
 */
async function searchPhoneInTable(tableName, phone, normalizedPhone, digitsOnly) {
  console.log(`\n=== 🔎 QIDIRUV JADVALI: ${tableName.toUpperCase()} ===`);

  const phoneFields = await detectPhoneFields(tableName);
  console.log(`🔢 Qidiruv field(lar): ${phoneFields.join(', ')}`);
  
  // Avval to'g'ridan-to'g'ri qidirish
  console.log(`1️⃣ To'g'ridan-to'g'ri qidirish: "${normalizedPhone}"`);
  let found = await searchByFieldVariants(tableName, phoneFields, '1', 'eq', normalizedPhone, '1');
  if (found) {
    return found;
  }
  
  // Agar + bilan boshlanmasa, +998 qo'shib qayta qidirish
  if (!normalizedPhone.startsWith('+')) {
    const withPlus = `+998${normalizedPhone.replace(/^998/, '')}`;
    console.log(`2️⃣ +998 qo'shib qidirish: "${withPlus}"`);
    found = await searchByFieldVariants(tableName, phoneFields, '2', 'eq', withPlus, '2');
    if (found) {
      return found;
    }
  }
  
  // Agar +998 bilan boshlansa, +siz qidirish
  if (normalizedPhone.startsWith('+998')) {
    const withoutPlus = normalizedPhone.replace(/^\+998/, '998');
    console.log(`3️⃣ +siz qidirish: "${withoutPlus}"`);
    found = await searchByFieldVariants(tableName, phoneFields, '3', 'eq', withoutPlus, '3');
    if (found) {
      return found;
    }
  }
  
  if (digitsOnly.length >= 9) {
    // Variant 4: 998940542722 formatida (998 + 9 raqam)
    const with998 = digitsOnly.startsWith('998') ? digitsOnly : `998${digitsOnly}`;
    console.log(`4️⃣ 998 bilan qidirish: "${with998}"`);
    found = await searchByFieldVariants(tableName, phoneFields, '4', 'eq', with998, '4');
    if (found) {
      return found;
    }
    
    // Variant 5: +998940542722 formatida
    const withPlus998 = `+${with998}`;
    console.log(`5️⃣ +998 bilan qidirish: "${withPlus998}"`);
    found = await searchByFieldVariants(tableName, phoneFields, '5', 'eq', withPlus998, '5');
    if (found) {
      return found;
    }
    
    // Variant 6: Faqat oxirgi 9 raqam (940542722)
    const last9Digits = digitsOnly.length >= 9 ? digitsOnly.slice(-9) : digitsOnly;
    console.log(`6️⃣ Faqat oxirgi 9 raqam: "${last9Digits}"`);
    found = await searchByFieldVariants(tableName, phoneFields, '6', 'eq', last9Digits, '6');
    if (found) {
      return found;
    }
    
    // Variant 7: LIKE bilan qidirish (oxirgi 9 raqam bilan)
    console.log(`7️⃣ LIKE bilan qidirish (oxirgi 9 raqam): "${last9Digits}"`);
    found = await searchByFieldVariants(tableName, phoneFields, '7', 'like', `%${last9Digits}`, '7 - LIKE');
    if (found) {
      return found;
    }
    
    // Variant 8: ILIKE bilan qidirish (case-insensitive)
    console.log(`8️⃣ ILIKE bilan qidirish: "%${last9Digits}"`);
    found = await searchByFieldVariants(tableName, phoneFields, '8', 'ilike', `%${last9Digits}%`, '8 - ILIKE');
    if (found) {
      return found;
    }

    found = await searchByNormalizedDigitsFallback(tableName, phoneFields, digitsOnly);
    if (found) {
      return found;
    }
  }
  
  return null;
}

/**
 * Telefon bo'yicha patient (yoki lead) ni topadi
 * @param {string} phone
 * @returns {Promise<Object|null>} Patient yoki Lead ma'lumotlari yoki null
 */
async function getPatientByPhone(phone) {
  if (!phone) {
    console.log('getPatientByPhone: phone bo\'sh');
    return null;
  }
  
  console.log(`🔍 Telefon raqam qidirilmoqda (Patients va Leads): "${phone}"`);
  
  // Telefon raqamni normalize qilish (+998901234567 formatida)
  const normalizedPhone = phone.replace(/[^\d+]/g, '');
  const digitsOnly = normalizedPhone.replace(/[^\d]/g, '');
  
  // 1. Avval 'patients' jadvalidan qidirish
  let found = await searchPhoneInTable('patients', phone, normalizedPhone, digitsOnly);
  
  // 2. Agar patients'dan topilmasa, 'leads' jadvalidan qidirish
  if (!found) {
    found = await searchPhoneInTable('leads', phone, normalizedPhone, digitsOnly);
  }
  
  if (found) {
    return found;
  }
  
  console.log(`❌ Hech qanday jadvaldan topilmadi (patients, leads)`);
  console.log(`💡 Qidirilgan raqam: "${phone}"`);
  console.log(`💡 Normalize qilingan: "${normalizedPhone}"`);
  return null;
}

module.exports = {
  getPatientById,
  getPatientByPhone,
};
