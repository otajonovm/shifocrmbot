const supabase = require('../supabase');

/**
 * Bemorni yakunlash ma'lumotini saqlash
 * @param {Object} params
 * @param {string} params.patientId - Patient ID
 * @param {string} params.chatId - Telegram Chat ID
 * @param {string} params.patientName - Bemor ismi
 * @param {string} params.phone - Telefon raqami
 * @param {string} params.notes - Eslatmalar
 * @returns {Promise<Object|null>}
 */
async function recordPatientCompletion(params) {
  const { patientId, chatId, patientName, phone, notes } = params;

  if (!patientId || !chatId) {
    console.error('❌ Bemor yakunlashni saqlash uchun patient_id va chat_id kerak');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('patient_completions')
      .insert([
        {
          patient_id: patientId,
          chat_id: chatId,
          patient_name: patientName || null,
          phone: phone || null,
          notes: notes || null
        }
      ])
      .select();

    if (error) {
      console.error('❌ Bemor yakunlashni saqlashda xatolik:', error.message);
      return null;
    }

    console.log('✅ Bemor yakunlashi saqlandi:', {
      patientId,
      patientName,
      phone
    });

    return data[0];
  } catch (err) {
    console.error('❌ Exception bemor yakunlashni saqlashda:', err);
    return null;
  }
}

/**
 * Bemorning oxirgi yakunlash sanasini olish
 * @param {string} patientId - Patient ID
 * @returns {Promise<Object|null>}
 */
async function getPatientLastCompletion(patientId) {
  if (!patientId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('patient_completions')
      .select('*')
      .eq('patient_id', patientId)
      .order('completion_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Bemor yakunlash ma\'lumotini olishda xatolik:', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error('❌ Exception bemor yakunlash ma\'lumotini olishda:', err);
    return null;
  }
}

/**
 * Bemorning barcha yakunlash sanalarini olish
 * @param {string} patientId - Patient ID
 * @returns {Promise<Array>}
 */
async function getPatientCompletionHistory(patientId) {
  if (!patientId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('patient_completions')
      .select('*')
      .eq('patient_id', patientId)
      .order('completion_date', { ascending: false });

    if (error) {
      console.error('❌ Bemor yakunlash tarixini olishda xatolik:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('❌ Exception bemor yakunlash tarixini olishda:', err);
    return [];
  }
}

module.exports = {
  recordPatientCompletion,
  getPatientLastCompletion,
  getPatientCompletionHistory
};
