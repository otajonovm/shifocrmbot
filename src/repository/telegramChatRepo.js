const supabase = require('../supabase');

function buildPhoneCandidates(phone) {
  if (!phone || typeof phone !== 'string') {
    return [];
  }

  const cleaned = phone.replace(/[^\d+]/g, '');
  const digitsOnly = cleaned.replace(/[^\d]/g, '');
  const candidates = new Set();

  if (cleaned) {
    candidates.add(cleaned);
  }

  if (digitsOnly) {
    candidates.add(digitsOnly);
  }

  if (digitsOnly.length >= 9) {
    const last9 = digitsOnly.slice(-9);
    candidates.add(last9);

    const with998 = digitsOnly.startsWith('998') ? digitsOnly : `998${last9}`;
    candidates.add(with998);
    candidates.add(`+${with998}`);
  }

  if (!cleaned.startsWith('+') && digitsOnly) {
    const plus998 = `+998${digitsOnly.replace(/^998/, '')}`;
    candidates.add(plus998);
  }

  return Array.from(candidates).filter(Boolean);
}

/**
 * Patient ID bo'yicha Telegram chat_id ni topadi
 * @param {string} patientId
 * @returns {Promise<string|null>} chat_id yoki null
 */
/**
 * Patient ID bo'yicha Telegram chat_id ni topadi
 * @param {string|number} patientId - ShifoCRM'dagi patient ID
 * @returns {Promise<string|null>} chat_id yoki null
 */
async function getTelegramChatId(patientId) {
  if (!patientId) {
    return null;
  }
  // Avval to'g'ridan-to'g'ri qidirish
  const { data, error } = await supabase
    .from('telegram_chat_ids')
    .select('chat_id')
    .eq('patient_id', String(patientId))
    .maybeSingle();
  if (!error && data) {
    return String(data.chat_id);
  }
  return null;
}

/**
 * Telefon bo'yicha chat_id ni topadi
 * @param {string} phone
 * @returns {Promise<{patient_id: string, chat_id: string, phone?: string, locale?: string}|null>} chat info yoki null
 */
async function getTelegramChatIdByPhone(phone) {
  if (!phone) {
    return null;
  }

  const candidates = buildPhoneCandidates(phone);

  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from('telegram_chat_ids')
      .select('patient_id, chat_id, phone, locale')
      .eq('phone', candidate)
      .maybeSingle();

    if (!error && data) {
      return {
        patient_id: String(data.patient_id),
        chat_id: String(data.chat_id),
        phone: data.phone ? String(data.phone) : null,
        locale: data.locale ? String(data.locale) : 'uz',
      };
    }
  }

  if (candidates.length > 0) {
    const last9 = candidates.find(item => /^\d{9}$/.test(item));
    if (last9) {
      const { data, error } = await supabase
        .from('telegram_chat_ids')
        .select('patient_id, chat_id, phone, locale')
        .ilike('phone', `%${last9}%`)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return {
          patient_id: String(data.patient_id),
          chat_id: String(data.chat_id),
          phone: data.phone ? String(data.phone) : null,
          locale: data.locale ? String(data.locale) : 'uz',
        };
      }
    }
  }

  return null;
}

async function getLocaleByChatId(chatId) {
  if (!chatId) {
    return null;
  }

  const { data, error } = await supabase
    .from('telegram_chat_ids')
    .select('locale')
    .eq('chat_id', String(chatId))
    .maybeSingle();

  if (error || !data || !data.locale) {
    return null;
  }

  return data.locale === 'ru' ? 'ru' : 'uz';
}

async function updateLocaleByChatId(chatId, locale) {
  if (!chatId) {
    return false;
  }

  const normalizedLocale = locale === 'ru' ? 'ru' : 'uz';

  const { error } = await supabase
    .from('telegram_chat_ids')
    .update({
      locale: normalizedLocale,
      updated_at: new Date().toISOString(),
    })
    .eq('chat_id', String(chatId));

  if (error) {
    return false;
  }

  return true;
}

/**
 * Telegram chat_id ni saqlaydi yoki yangilaydi (upsert)
 * @param {Object} params
 * @param {string} params.patientId
 * @param {string} params.chatId
 * @param {string} [params.username]
 * @param {string} [params.firstName]
 * @param {string} [params.phone]
 * @param {'uz'|'ru'} [params.locale]
 * @returns {Promise<boolean>}
 */
async function saveTelegramChatId({ patientId, chatId, username, firstName, phone, locale }) {
  if (!patientId || !chatId) {
    console.error('saveTelegramChatId: patientId yoki chatId bo\'sh');
    return false;
  }
  
  console.log('💾 Telegram chat_id saqlanmoqda:');
  console.log('   patient_id:', patientId);
  console.log('   chat_id:', chatId);
  console.log('   username:', username);
  console.log('   first_name:', firstName);
  console.log('   phone:', phone);
  console.log('   locale:', locale || 'uz');
  
  try {
    // Avval: chat_id allaqachon boshqa patient_id bilan mavjud bo'lsa, uni o'chirish
    const { data: existingChat, error: checkError } = await supabase
      .from('telegram_chat_ids')
      .select('patient_id')
      .eq('chat_id', String(chatId))
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.warn('⚠️ chat_id tekshirishda xatolik:', checkError.message);
    } else if (existingChat && existingChat.patient_id !== String(patientId)) {
      // chat_id boshqa patient_id bilan mavjud, uni o'chirish
      console.log(`⚠️ chat_id ${chatId} boshqa patient_id (${existingChat.patient_id}) bilan mavjud, o'chirilmoqda...`);
      const { error: deleteError } = await supabase
        .from('telegram_chat_ids')
        .delete()
        .eq('chat_id', String(chatId));
      
      if (deleteError) {
        console.error('❌ Eski chat_id ni o\'chirishda xatolik:', deleteError);
        // Xatolik bo'lsa ham davom etamiz
      } else {
        console.log('✅ Eski chat_id o\'chirildi');
      }
    }
    
    // Endi upsert qilish
    const { data, error } = await supabase
      .from('telegram_chat_ids')
      .upsert(
        {
          patient_id: String(patientId),
          chat_id: String(chatId),
          username: username || null,
          first_name: firstName || null,
          phone: phone || null,
          locale: locale === 'ru' ? 'ru' : 'uz',
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'patient_id',
        }
      );
    
    if (error) {
      console.error('❌ Supabase upsert xatolik:', error);
      console.error('   Xatolik kodi:', error.code);
      console.error('   Xatolik xabari:', error.message);
      console.error('   Xatolik detallari:', error.details);
      return false;
    }
    
    console.log('✅ Telegram chat_id muvaffaqiyatli saqlandi');
    return true;
  } catch (err) {
    console.error('❌ Exception saveTelegramChatId:', err);
    return false;
  }
}

module.exports = {
  getTelegramChatId,
  getTelegramChatIdByPhone,
  getLocaleByChatId,
  updateLocaleByChatId,
  saveTelegramChatId,
};
