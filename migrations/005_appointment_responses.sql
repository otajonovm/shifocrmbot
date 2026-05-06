-- Appointment response storage for inline button replies
CREATE TABLE IF NOT EXISTS appointment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_message_id UUID NOT NULL,
  patient_id TEXT NOT NULL,
  lead_id TEXT,
  reminder_key TEXT,
  response TEXT NOT NULL, -- yes | no
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (scheduled_message_id),
  FOREIGN KEY (patient_id) REFERENCES telegram_chat_ids(patient_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_appointment_responses_patient_id
ON appointment_responses(patient_id);

CREATE INDEX IF NOT EXISTS idx_appointment_responses_lead_id
ON appointment_responses(lead_id);

CREATE INDEX IF NOT EXISTS idx_appointment_responses_responded_at
ON appointment_responses(responded_at);

DROP TRIGGER IF EXISTS update_appointment_responses_updated_at ON appointment_responses;

CREATE TRIGGER update_appointment_responses_updated_at
BEFORE UPDATE ON appointment_responses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
