const supabase = require('../supabase');

async function upsertAppointmentResponse({
  scheduledMessageId,
  patientId,
  leadId,
  reminderKey,
  response,
  respondedAt,
}) {
  if (!scheduledMessageId || !patientId || !response) {
    console.error('❌ Appointment response uchun kerakli parametrlar yetishmaydi');
    return null;
  }

  try {
    const payload = {
      scheduled_message_id: scheduledMessageId,
      patient_id: String(patientId),
      lead_id: leadId ? String(leadId) : null,
      reminder_key: reminderKey || null,
      response: response,
      responded_at: respondedAt ? new Date(respondedAt).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('appointment_responses')
      .upsert(payload, { onConflict: 'scheduled_message_id' })
      .select()
      .maybeSingle();

    if (error) {
      console.error('❌ appointment_responses upsert xatolik:', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error('❌ appointment_responses upsert exception:', err);
    return null;
  }
}

module.exports = {
  upsertAppointmentResponse,
};
