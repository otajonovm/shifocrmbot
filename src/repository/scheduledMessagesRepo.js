const supabase = require('../supabase');

function isScheduledMessagesTableMissingError(error) {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();

  return (
    message.includes('scheduled_messages') &&
    (message.includes('could not find the table') || message.includes('does not exist'))
  ) || (
    details.includes('scheduled_messages') &&
    (details.includes('could not find the table') || details.includes('does not exist'))
  ) || code === 'PGRST205';
}

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  const column = String(columnName || '').toLowerCase();

  return code === '42703' || (
    !!column && (
      message.includes(column) || details.includes(column)
    ) && (
      message.includes('column') || details.includes('column')
    )
  );
}

/**
 * Rejalashtirilgan xabar yaratish
 * @param {Object} params
 * @param {string} params.patientId - Patient ID
 * @param {string} params.message - Xabar matni
 * @param {Date|string} params.scheduledTime - Yuborish vaqti
 * @returns {Promise<Object|null>}
 */
async function createScheduledMessage(params) {
  const { patientId, message, scheduledTime, reminderKey = null } = params;

  if (!patientId || !message || !scheduledTime) {
    console.error('❌ Rejalashtirilgan xabar uchun kerakli parametrlar yo\'q:', params);
    return null;
  }

  try {
    const payload = {
      patient_id: patientId,
      message: message,
      scheduled_time: new Date(scheduledTime).toISOString(),
      status: 'pending'
    };

    if (reminderKey) {
      payload.reminder_key = reminderKey;
    }

    let { data, error } = await supabase
      .from('scheduled_messages')
      .insert([payload])
      .select();

    if (error && reminderKey && isMissingColumnError(error, 'reminder_key')) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.reminder_key;

      ({ data, error } = await supabase
        .from('scheduled_messages')
        .insert([fallbackPayload])
        .select());
    }

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
 * Rejalashtirilgan xabar yaratish (idempotent, reminder_key asosida)
 * @param {Object} params
 * @param {string} params.patientId
 * @param {string} params.message
 * @param {Date|string} params.scheduledTime
 * @param {string} params.reminderKey
 * @returns {Promise<Object|null>}
 */
async function createScheduledMessageUnique(params) {
  const { patientId, message, scheduledTime, reminderKey } = params || {};

  if (!reminderKey) {
    return createScheduledMessage({ patientId, message, scheduledTime });
  }

  try {
    const { data: existing, error: findError } = await supabase
      .from('scheduled_messages')
      .select('id, patient_id, reminder_key, status, scheduled_time')
      .eq('reminder_key', reminderKey)
      .limit(1)
      .maybeSingle();

    if (!findError && existing) {
      return { ...existing, _deduped: true };
    }

    if (findError && !isMissingColumnError(findError, 'reminder_key')) {
      console.warn('⚠️ reminder_key bo\'yicha qidirishda xatolik:', findError.message);
    }

    const created = await createScheduledMessage({
      patientId,
      message,
      scheduledTime,
      reminderKey
    });

    return created;
  } catch (err) {
    const code = String(err?.code || '').toUpperCase();
    if (code === '23505') {
      const { data: existing } = await supabase
        .from('scheduled_messages')
        .select('id, patient_id, reminder_key, status, scheduled_time')
        .eq('reminder_key', reminderKey)
        .limit(1)
        .maybeSingle();

      if (existing) {
        return { ...existing, _deduped: true };
      }
    }

    console.error('❌ createScheduledMessageUnique exception:', err);
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
        reminder_key,
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
      if (isScheduledMessagesTableMissingError(error)) {
        const missingTableError = new Error('SCHEDULED_MESSAGES_TABLE_MISSING');
        missingTableError.code = 'SCHEDULED_MESSAGES_TABLE_MISSING';
        missingTableError.details = error.message || error.details || null;
        throw missingTableError;
      }

      console.error('❌ Pending xabarlarni olishda xatolik:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    if (err?.code === 'SCHEDULED_MESSAGES_TABLE_MISSING') {
      throw err;
    }

    console.error('❌ Exception pending xabarlarni olishda:', err);
    return [];
  }
}

/**
 * Scheduled message ni ID bo'yicha olish
 * @param {string} messageId
 * @returns {Promise<Object|null>}
 */
async function getScheduledMessageById(messageId) {
  if (!messageId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('scheduled_messages')
      .select('id, patient_id, reminder_key, scheduled_time, message')
      .eq('id', messageId)
      .maybeSingle();

    if (error) {
      console.error('❌ scheduled_messages olishda xatolik:', error.message);
      return null;
    }

    return data || null;
  } catch (err) {
    console.error('❌ scheduled_messages exception:', err);
    return null;
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
  createScheduledMessageUnique,
  getPendingMessages,
  getScheduledMessageById,
  updateMessageStatus,
  scheduleFollowUpMessages
};
