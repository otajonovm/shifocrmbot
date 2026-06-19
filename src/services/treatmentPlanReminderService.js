const supabase = require('../supabase');
const { getTelegramChatId } = require('../repository/telegramChatRepo');
const { createScheduledMessageUnique } = require('../repository/scheduledMessagesRepo');

const BATCH_LIMIT = 200;

function pickFirst(row, fieldNames) {
  for (const field of fieldNames) {
    if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== '') {
      return row[field];
    }
  }
  return null;
}

function isPendingRemindStatus(value) {
  const status = String(value || '').toLowerCase();
  if (!status) {
    return true;
  }

  return ['pending', 'scheduled', 'waiting', 'kutilmoqda'].some((token) => status.includes(token));
}

async function scheduleDueTreatmentPlanReminders() {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('treatment_plans')
    .select('*')
    .lte('remind_at', nowIso)
    .order('remind_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    if (String(error.message || '').toLowerCase().includes('treatment_plans')) {
      return { skipped: true, reason: 'TABLE_MISSING' };
    }
    console.warn('⚠️ treatment_plans eslatmalarini olishda xatolik:', error.message);
    return { scanned: 0, created: 0, deduped: 0, skipped: 0, error: error.message };
  }

  let scanned = 0;
  let created = 0;
  let deduped = 0;
  let skipped = 0;

  for (const row of data || []) {
    scanned += 1;

    const remindStatus = pickFirst(row, ['remind_status', 'reminder_status', 'status']);
    if (!isPendingRemindStatus(remindStatus)) {
      skipped += 1;
      continue;
    }

    const patientId = pickFirst(row, ['patient_id', 'patientId']);
    const message = pickFirst(row, ['remind_message', 'message', 'notes', 'title']);
    const remindAt = pickFirst(row, ['remind_at', 'scheduled_at']);

    if (!patientId || !message || !remindAt) {
      skipped += 1;
      continue;
    }

    const chatId = await getTelegramChatId(String(patientId));
    if (!chatId) {
      skipped += 1;
      continue;
    }

    const planId = String(row.id);
    const reminderKey = `treatment_plan:${planId}:${new Date(remindAt).toISOString()}`;

    const result = await createScheduledMessageUnique({
      patientId: String(patientId),
      message: String(message),
      scheduledTime: new Date(),
      reminderKey,
    });

    if (result && result._deduped) {
      deduped += 1;
    } else if (result) {
      created += 1;

      const { error: updateError } = await supabase
        .from('treatment_plans')
        .update({
          remind_status: 'scheduled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (updateError) {
        console.warn(`⚠️ treatment_plan remind_status yangilanmadi (${planId}):`, updateError.message);
      }
    }
  }

  return { scanned, created, deduped, skipped };
}

module.exports = {
  scheduleDueTreatmentPlanReminders,
};
