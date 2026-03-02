-- Rejalashtirilgan xabarlar jadvali
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (patient_id) REFERENCES telegram_chat_ids(patient_id) ON DELETE CASCADE
);

-- Status bo'yicha index (pending xabarlarni tez qidirish uchun)
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status_time 
ON scheduled_messages(status, scheduled_time) 
WHERE status = 'pending';

-- Patient bo'yicha index
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_patient_id 
ON scheduled_messages(patient_id);

-- Completion records jadvali (bemorni yakunlash ma'lumotlari)
CREATE TABLE IF NOT EXISTS patient_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  patient_name TEXT,
  phone TEXT,
  completion_date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (patient_id) REFERENCES telegram_chat_ids(patient_id) ON DELETE CASCADE
);

-- Patient ID bo'yicha index
CREATE INDEX IF NOT EXISTS idx_patient_completions_patient_id 
ON patient_completions(patient_id);

-- Chat ID bo'yicha index
CREATE INDEX IF NOT EXISTS idx_patient_completions_chat_id 
ON patient_completions(chat_id);

-- updated_at avtomatik yangilanishi uchun trigger (scheduled_messages)
DROP TRIGGER IF EXISTS update_scheduled_messages_updated_at ON scheduled_messages;

CREATE TRIGGER update_scheduled_messages_updated_at
BEFORE UPDATE ON scheduled_messages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- updated_at avtomatik yangilanishi uchun trigger (patient_completions)
DROP TRIGGER IF EXISTS update_patient_completions_updated_at ON patient_completions;

CREATE TRIGGER update_patient_completions_updated_at
BEFORE UPDATE ON patient_completions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
