const supabase = require('../supabase');

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
 * @returns {Promise<string|null>} chat_id yoki null
 */
async function getTelegramChatIdByPhone(phone) {
  if (!phone) {
    return null;
  }
  const { data, error } = await supabase
    .from('telegram_chat_ids')
    .select('chat_id')
    .eq('phone', phone)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return String(data.chat_id);
}

/**
 * Telegram chat_id ni saqlaydi yoki yangilaydi (upsert)
 * @param {Object} params
 * @param {string} params.patientId
 * @param {string} params.chatId
 * @param {string} [params.username]
 * @param {string} [params.firstName]
 * @param {string} [params.phone]
 * @returns {Promise<boolean>}
 */
async function saveTelegramChatId({ patientId, chatId, username, firstName, phone }) {
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
  saveTelegramChatId,
};
