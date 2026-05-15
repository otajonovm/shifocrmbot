-- Doktor profillari va doctor reminder queue
CREATE TABLE IF NOT EXISTS doctor_profiles (
  phone TEXT PRIMARY KEY,
  chat_id TEXT,
  telegram_username TEXT,
  telegram_first_name TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'doctor',
  notification_preference TEXT NOT NULL DEFAULT 'all_appointments',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index faqat chat_id mavjud bo'lganda
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_profiles_chat_id_unique ON doctor_profiles(chat_id)
WHERE chat_id IS NOT NULL AND chat_id != '';
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_role ON doctor_profiles(role);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_active ON doctor_profiles(is_active);

CREATE TABLE IF NOT EXISTS doctor_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_phone TEXT NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT,
  message TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, actioned, skipped
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT,
  sent_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,
  last_action_key TEXT,
  last_action_text TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_doctor_reminders_doctor_phone
    FOREIGN KEY (doctor_phone) REFERENCES doctor_profiles(phone) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_reminders_dedupe_key_unique ON doctor_reminders(dedupe_key)
WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doctor_reminders_status_time
ON doctor_reminders(status, scheduled_time)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_doctor_reminders_doctor_phone
ON doctor_reminders(doctor_phone);

DROP TRIGGER IF EXISTS update_doctor_profiles_updated_at ON doctor_profiles;
CREATE TRIGGER update_doctor_profiles_updated_at
BEFORE UPDATE ON doctor_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_doctor_reminders_updated_at ON doctor_reminders;
CREATE TRIGGER update_doctor_reminders_updated_at
BEFORE UPDATE ON doctor_reminders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();