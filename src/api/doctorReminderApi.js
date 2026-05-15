const express = require('express');
const { enqueueDoctorReminderEvent, getDefaultDoctorReminderActions } = require('../services/doctorReminderService');
const { getDoctorByPhone } = require('../repository/doctorProfileRepo');

const router = express.Router();

function normalizeString(value) {
  return String(value || '').trim();
}

router.post('/reminders', async (req, res) => {
  try {
    const {
      doctorPhone,
      eventType,
      title,
      message,
      scheduledTime,
      actions,
      dedupeKey,
      metadata,
    } = req.body || {};

    const normalizedDoctorPhone = normalizeString(doctorPhone);
    if (!normalizedDoctorPhone || !message || !scheduledTime) {
      return res.status(400).json({
        ok: false,
        error: 'DOCTOR_PHONE_MESSAGE_AND_SCHEDULED_TIME_REQUIRED',
      });
    }

    const doctor = await getDoctorByPhone(normalizedDoctorPhone);
    if (!doctor) {
      return res.status(404).json({
        ok: false,
        error: 'DOCTOR_PROFILE_NOT_FOUND',
      });
    }

    const resolvedActions = Array.isArray(actions) && actions.length > 0
      ? actions
      : getDefaultDoctorReminderActions(eventType);

    const result = await enqueueDoctorReminderEvent({
      doctorPhone: normalizedDoctorPhone,
      eventType,
      title,
      message,
      scheduledTime,
      actions: resolvedActions,
      dedupeKey,
      metadata,
    });

    if (!result?.success) {
      return res.status(result?.missingTable ? 503 : 500).json({
        ok: false,
        error: result?.message || 'DOCTOR_REMINDER_CREATE_FAILED',
      });
    }

    return res.json({
      ok: true,
      reminder: result.data,
      deduped: !!result.deduped,
    });
  } catch (error) {
    console.error('Doctor reminder API xatolik:', error);
    return res.status(500).json({
      ok: false,
      error: 'DOCTOR_REMINDER_API_FAILED',
      message: error.message,
    });
  }
});

module.exports = router;