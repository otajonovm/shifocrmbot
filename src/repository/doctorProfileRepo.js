const supabase = require('../supabase');

const DEFAULT_DOCTOR_ROLE = 'doctor';
const DEFAULT_NOTIFICATION_PREFERENCE = 'all_appointments';

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

function normalizePhone(phone) {
  return String(phone || '').trim();
}

function normalizeNotificationPreference(preference) {
  const raw = String(preference || '').trim().toLowerCase();
  if (!raw) {
    return DEFAULT_NOTIFICATION_PREFERENCE;
  }

  if (['urgent_only', 'only urgent', 'urgent', 'only_urgent'].includes(raw)) {
    return 'urgent_only';
  }

  if (['daily_summary_only', 'daily summary only', 'summary_only'].includes(raw)) {
    return 'daily_summary_only';
  }

  if (['mute', 'muted', 'off', 'none'].includes(raw)) {
    return 'mute';
  }

  return DEFAULT_NOTIFICATION_PREFERENCE;
}

async function getDoctorByPhone(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return null;
  }

  const { data, error } = await supabase
    .from('doctor_profiles')
    .select('*')
    .eq('phone', normalizedPhone)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, 'doctor_profiles')) {
      return null;
    }
    console.error('❌ doctor_profiles phone bo\'yicha qidirishda xatolik:', error.message);
    return null;
  }

  return data || null;
}

async function getDoctorByChatId(chatId) {
  const normalizedChatId = String(chatId || '').trim();
  if (!normalizedChatId) {
    return null;
  }

  const { data, error } = await supabase
    .from('doctor_profiles')
    .select('*')
    .eq('chat_id', normalizedChatId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, 'doctor_profiles')) {
      return null;
    }
    console.error('❌ doctor_profiles chat_id bo\'yicha qidirishda xatolik:', error.message);
    return null;
  }

  return data || null;
}

async function upsertDoctorProfile({
  phone,
  chatId,
  username = null,
  firstName = null,
  fullName = null,
  role = DEFAULT_DOCTOR_ROLE,
  notificationPreference = DEFAULT_NOTIFICATION_PREFERENCE,
  isActive = true,
}) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedChatId = String(chatId || '').trim();

  if (!normalizedPhone || !normalizedChatId) {
    return { success: false, message: 'Doctor phone yoki chatId yetishmaydi' };
  }

  const payload = {
    phone: normalizedPhone,
    chat_id: normalizedChatId,
    telegram_username: username || null,
    telegram_first_name: firstName || null,
    full_name: fullName || null,
    role: role || DEFAULT_DOCTOR_ROLE,
    notification_preference: normalizeNotificationPreference(notificationPreference),
    is_active: isActive !== false,
    updated_at: new Date().toISOString(),
  };

  const existingByChat = await getDoctorByChatId(normalizedChatId);
  if (existingByChat && existingByChat.phone && existingByChat.phone !== normalizedPhone) {
    const updatedPayload = {
      telegram_username: username || existingByChat.telegram_username || null,
      telegram_first_name: firstName || existingByChat.telegram_first_name || null,
      full_name: fullName || existingByChat.full_name || null,
      role: role || existingByChat.role || DEFAULT_DOCTOR_ROLE,
      notification_preference: normalizeNotificationPreference(
        notificationPreference || existingByChat.notification_preference
      ),
      is_active: isActive !== false,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedByChat, error: updateByChatError } = await supabase
      .from('doctor_profiles')
      .update(updatedPayload)
      .eq('chat_id', normalizedChatId)
      .select()
      .maybeSingle();

    if (updateByChatError) {
      if (isMissingTableError(updateByChatError, 'doctor_profiles')) {
        return { success: false, missingTable: true, message: 'doctor_profiles jadvali yoq' };
      }
      console.error('❌ doctor_profiles chat_id bo\'yicha yangilashda xatolik:', updateByChatError.message);
      return { success: false, message: updateByChatError.message };
    }

    return {
      success: true,
      data: updatedByChat,
      warning: 'CHAT_ALREADY_BOUND_DIFFERENT_PHONE',
      warningMessage: 'Sizning Telegram akkauntingiz oldinroq boshqa telefon bilan bog\'langan. Eski bog\'lanish saqlandi.',
    };
  }

  const existingByPhone = await getDoctorByPhone(normalizedPhone);
  if (existingByPhone && existingByPhone.chat_id && existingByPhone.chat_id !== normalizedChatId) {
    return {
      success: false,
      code: 'PHONE_ALREADY_BOUND',
      message: 'Bu telefon raqami boshqa Telegram akkauntiga bog\'langan.',
    };
  }

  const { data, error } = await supabase
    .from('doctor_profiles')
    .upsert(payload, { onConflict: 'phone' })
    .select()
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, 'doctor_profiles')) {
      return { success: false, missingTable: true, message: 'doctor_profiles jadvali yoq' };
    }

    console.error('❌ doctor_profiles upsert xatolik:', error.message);
    return { success: false, message: error.message };
  }

  return { success: true, data };
}

async function updateDoctorNotificationPreference(chatId, preference) {
  const normalizedChatId = String(chatId || '').trim();
  if (!normalizedChatId) {
    return { success: false, message: 'chatId yoq' };
  }

  const { data, error } = await supabase
    .from('doctor_profiles')
    .update({
      notification_preference: normalizeNotificationPreference(preference),
      updated_at: new Date().toISOString(),
    })
    .eq('chat_id', normalizedChatId)
    .select()
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, 'doctor_profiles')) {
      return { success: false, missingTable: true, message: 'doctor_profiles jadvali yoq' };
    }

    console.error('❌ doctor_profiles preference yangilashda xatolik:', error.message);
    return { success: false, message: error.message };
  }

  return { success: true, data };
}

module.exports = {
  DEFAULT_DOCTOR_ROLE,
  DEFAULT_NOTIFICATION_PREFERENCE,
  getDoctorByPhone,
  getDoctorByChatId,
  normalizeNotificationPreference,
  upsertDoctorProfile,
  updateDoctorNotificationPreference,
};