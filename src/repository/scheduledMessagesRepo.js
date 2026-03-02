const supabase = require('../supabase');

/**
 * Rejalashtirilgan xabar yaratish
 * @param {Object} params
 * @param {string} params.patientId - Patient ID
 * @param {string} params.message - Xabar matni
 * @param {Date|string} params.scheduledTime - Yuborish vaqti
 * @returns {Promise<Object|null>}
 */
async function createScheduledMessage(params) {
  const { patientId, message, scheduledTime } = params;

  if (!patientId || !message || !scheduledTime) {
    console.error('❌ Rejalashtirilgan xabar uchun kerakli parametrlar yo\'q:', params);
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('scheduled_messages')
      .insert([
        {
          patient_id: patientId,
          message: message,
          scheduled_time: new Date(scheduledTime).toISOString(),
          status: 'pending'
        }
      ])
      .select();

    if (error) {
      console.error('❌ Rejalashtirilgan xabar yaratishda xatolik:', error.message);
      return null;
    }

    console.log('✅ Rejalashtirilgan xabar yaratildi:', {
      patientId,
      messagePreview: message.substring(0, 50) + '...',
      scheduledTime
    });

    return data[0];
  } catch (err) {
    console.error('❌ Exception rejalashtirilgan xabar yaratishda:', err);
    return null;
  }
}

/**
 * Pending xabarlarni olish (yuborilishi kerak bo'lgan vaqti kelgan)
 * @returns {Promise<Array>}
 */
async function getPendingMessages() {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('scheduled_messages')
      .select(`
        id,
        patient_id,
        message,
        scheduled_time,
        telegram_chat_ids (
          chat_id,
          patient_id,
          phone
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_time', now)
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('❌ Pending xabarlarni olishda xatolik:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('❌ Exception pending xabarlarni olishda:', err);
    return [];
  }
}

/**
 * Xabarning statusini yangilash
 * @param {string} messageId - Message ID
 * @param {string} status - 'sent' yoki 'failed'
 * @param {string} failureReason - Xatolik sababi (agar bo'lsa)
 * @returns {Promise<boolean>}
 */
async function updateMessageStatus(messageId, status, failureReason = null) {
  try {
    const updateData = { status };
    if (failureReason) {
      updateData.failure_reason = failureReason;
    }
    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('scheduled_messages')
      .update(updateData)
      .eq('id', messageId);

    if (error) {
      console.error(`❌ Xabar statusini yangilashda xatolik (${messageId}):`, error.message);
      return false;
    }

    console.log(`✅ Xabar statusini yangilandi: ${messageId} -> ${status}`);
    return true;
  } catch (err) {
    console.error('❌ Exception xabar statusini yangilashda:', err);
    return false;
  }
}

/**
 * Tug'ma xabarlarni rejalashtirish (bemorni yakunlashdan keyin)
 * @param {Object} params
 * @param {string} params.patientId - Patient ID
 * @param {string} params.patientName - Bemor ismi
 * @param {string} params.phone - Telefon raqami
 * @param {Array<Object>} params.messages - Xabar massivi [{delayHours, text}, ...]
 * @returns {Promise<Array>}
 */
async function scheduleFollowUpMessages(params) {
  const { patientId, patientName, phone, messages } = params;

  if (!patientId || !messages || messages.length === 0) {
    console.error('❌ Follow-up xabarlarni rejalashtirish uchun kerakli parametrlar yo\'q');
    return [];
  }

  const createdMessages = [];

  for (const msg of messages) {
    const { delayHours, text } = msg;
    const scheduledTime = new Date(Date.now() + delayHours * 60 * 60 * 1000);

    const created = await createScheduledMessage({
      patientId,
      message: text,
      scheduledTime
    });

    if (created) {
      createdMessages.push(created);
      console.log(`✅ Follow-up xabar rejalashtiryldi: ${patientName} (${delayHours}h keyin)`);
    }
  }

  return createdMessages;
}

module.exports = {
  createScheduledMessage,
  getPendingMessages,
  updateMessageStatus,
  scheduleFollowUpMessages
};
