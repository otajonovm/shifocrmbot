-- Appointment reminder flow (B) uchun migration
-- A: Offsets (24h, 2h) - kodda
-- C: Timezone (explicit field)
-- C: Dedupe (DB-level unique key)

ALTER TABLE IF EXISTS leads
ADD COLUMN IF NOT EXISTS appointment_timezone TEXT;

UPDATE leads
SET appointment_timezone = 'Asia/Tashkent'
WHERE appointment_timezone IS NULL OR appointment_timezone = '';

ALTER TABLE IF EXISTS leads
ALTER COLUMN appointment_timezone SET DEFAULT 'Asia/Tashkent';

ALTER TABLE IF EXISTS scheduled_messages
ADD COLUMN IF NOT EXISTS reminder_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_messages_reminder_key_unique
ON scheduled_messages(reminder_key)
WHERE reminder_key IS NOT NULL;
