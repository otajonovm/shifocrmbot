const supabase = require('../supabase');

function isMissingTableError(error, tableName) {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const table = String(tableName || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();

  return code === 'PGRST205' || (
    table && (
      message.includes(table) || details.includes(table)
    ) && (
      message.includes('table') || details.includes('table')
    )
  );
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeActions(actions, eventType) {
  if (Array.isArray(actions) && actions.length > 0) {
    return actions
      .map((action, index) => {
        if (!action) {
          return null;
        }

        const text = normalizeString(action.text || action.label || action.title);
        const actionKey = normalizeString(action.actionKey || action.key || action.callbackKey || `action_${index + 1}`)
          .replace(/[^a-zA-Z0-9_-]/g, '_');

        if (!text) {
          return null;
        }

        return {
          text,
          actionKey,
        };
      })
      .filter(Boolean);
  }

  const defaults = {
    upcoming_appointment: [
      { text: '✅ Boshlash', actionKey: 'start' },
      { text: '🔄 Ko‘chirish', actionKey: 'reschedule' },
      { text: '❌ Bekor qilish', actionKey: 'cancel' },
    ],
    follow_up: [
      { text: '📞 Aloqa qilindi', actionKey: 'contacted' },
      { text: '⏰ Ertaga eslat', actionKey: 'remind_tomorrow' },
      { text: '✅ Yopish', actionKey: 'close' },
    ],
    cancellation_alert: [
      { text: '👤 Waiting list', actionKey: 'waiting_list' },
      { text: '📅 Ko‘chirish', actionKey: 'reschedule' },
    ],
    daily_summary: [
      { text: '📋 Ko‘rildi', actionKey: 'reviewed' },
      { text: '✅ Yopish', actionKey: 'close' },
    ],
  };

  return defaults[eventType] || [
    { text: '✅ Tasdiqlash', actionKey: 'ack' },
    { text: '📝 Izoh', actionKey: 'note' },
  ];
}

async function createDoctorReminderUnique(params) {
  const {
    doctorPhone,
    eventType,
    title,
    message,
    scheduledTime,
    actionPayload = {},
    dedupeKey = null,
    metadata = {},
  } = params || {};

  const normalizedDoctorPhone = normalizeString(doctorPhone);
  if (!normalizedDoctorPhone || !message || !scheduledTime) {
    return { success: false, message: 'doctorPhone, message yoki scheduledTime yetishmaydi' };
  }

  try {
    if (dedupeKey) {
      const { data: existing, error: findError } = await supabase
        .from('doctor_reminders')
        .select('id, doctor_phone, event_type, title, message, scheduled_time, status, dedupe_key')
        .eq('dedupe_key', dedupeKey)
        .maybeSingle();

      if (!findError && existing) {
        return { success: true, data: existing, deduped: true };
      }
    }

    const payload = {
      doctor_phone: normalizedDoctorPhone,
      event_type: eventType || 'general',
      title: title || null,
      message,
      scheduled_time: new Date(scheduledTime).toISOString(),
      status: 'pending',
      action_payload: actionPayload || {},
      metadata: metadata || {},
    };

    if (dedupeKey) {
      payload.dedupe_key = dedupeKey;
    }

    const { data, error } = await supabase
      .from('doctor_reminders')
      .insert([payload])
      .select()
      .maybeSingle();

    if (error) {
      if (String(error?.code || '').toUpperCase() === '23505' && dedupeKey) {
        const { data: existing } = await supabase
          .from('doctor_reminders')
          .select('id, doctor_phone, event_type, title, message, scheduled_time, status, dedupe_key')
          .eq('dedupe_key', dedupeKey)
          .maybeSingle();

        if (existing) {
          return { success: true, data: existing, deduped: true };
        }
      }

      if (isMissingTableError(error, 'doctor_reminders')) {
        return { success: false, missingTable: true, message: 'doctor_reminders jadvali yoq' };
      }

      console.error('❌ doctor_reminders yaratishda xatolik:', error.message);
      return { success: false, message: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error('❌ doctor_reminders exception:', err);
    return { success: false, message: err?.message || String(err) };
  }
}

async function getPendingDoctorReminders() {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('doctor_reminders')
      .select('id, doctor_phone, event_type, title, message, scheduled_time, status, action_payload, metadata, dedupe_key, sent_at, failure_reason, acted_at, last_action_key, last_action_text')
      .eq('status', 'pending')
      .lte('scheduled_time', now)
      .order('scheduled_time', { ascending: true });

    if (error) {
      if (isMissingTableError(error, 'doctor_reminders')) {
        const missingTableError = new Error('DOCTOR_REMINDERS_TABLE_MISSING');
        missingTableError.code = 'DOCTOR_REMINDERS_TABLE_MISSING';
        missingTableError.details = error.message || error.details || null;
        throw missingTableError;
      }

      console.error('❌ doctor_reminders pending olishda xatolik:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    if (err?.code === 'DOCTOR_REMINDERS_TABLE_MISSING') {
      throw err;
    }

    console.error('❌ doctor_reminders exception:', err);
    return [];
  }
}

async function getDoctorReminderById(reminderId) {
  const normalizedId = normalizeString(reminderId);
  if (!normalizedId) {
    return null;
  }

  const { data, error } = await supabase
    .from('doctor_reminders')
    .select('id, doctor_phone, event_type, title, message, scheduled_time, status, action_payload, metadata, dedupe_key, sent_at, failure_reason, acted_at, last_action_key, last_action_text')
    .eq('id', normalizedId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, 'doctor_reminders')) {
      return null;
    }

    console.error('❌ doctor_reminders id bo\'yicha qidirishda xatolik:', error.message);
    return null;
  }

  return data || null;
}

async function updateDoctorReminderStatus(reminderId, status, options = {}) {
  const normalizedId = normalizeString(reminderId);
  const normalizedStatus = normalizeString(status);

  if (!normalizedId || !normalizedStatus) {
    return false;
  }

  const updatePayload = {
    status: normalizedStatus,
    updated_at: new Date().toISOString(),
  };

  if (options.failureReason) {
    updatePayload.failure_reason = options.failureReason;
  }

  if (normalizedStatus === 'sent') {
    updatePayload.sent_at = new Date().toISOString();
  }

  if (normalizedStatus === 'actioned') {
    updatePayload.acted_at = options.actedAt || new Date().toISOString();
    updatePayload.last_action_key = options.actionKey || null;
    updatePayload.last_action_text = options.actionText || null;
  }

  const { error } = await supabase
    .from('doctor_reminders')
    .update(updatePayload)
    .eq('id', normalizedId);

  if (error) {
    console.error(`❌ doctor_reminders status yangilashda xatolik (${normalizedId}):`, error.message);
    return false;
  }

  return true;
}

async function recordDoctorReminderAction(reminderId, actionKey, actionText) {
  const normalizedId = normalizeString(reminderId);
  if (!normalizedId) {
    return false;
  }

  return updateDoctorReminderStatus(normalizedId, 'actioned', {
    actionKey: normalizeString(actionKey),
    actionText: normalizeString(actionText),
    actedAt: new Date().toISOString(),
  });
}

module.exports = {
  createDoctorReminderUnique,
  getDoctorReminderById,
  getPendingDoctorReminders,
  normalizeActions,
  recordDoctorReminderAction,
  updateDoctorReminderStatus,
};