-- Telegram chat_ids jadvali
CREATE TABLE IF NOT EXISTS telegram_chat_ids (
  patient_id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  username TEXT,
  first_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint chat_id uchun (bir chat_id faqat bitta patient'ga tegishli)
CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_chat_ids_chat_id_unique ON telegram_chat_ids(chat_id);

-- Index chat_id uchun (tez qidirish)
CREATE INDEX IF NOT EXISTS idx_telegram_chat_ids_chat_id ON telegram_chat_ids(chat_id);

-- Index telefon uchun (telefon bo'yicha qidirish)
CREATE INDEX IF NOT EXISTS idx_telegram_chat_ids_phone ON telegram_chat_ids(phone);

-- updated_at avtomatik yangilanishi uchun trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger yaratishdan oldin o'chirish (agar mavjud bo'lsa)
DROP TRIGGER IF EXISTS update_telegram_chat_ids_updated_at ON telegram_chat_ids;

CREATE TRIGGER update_telegram_chat_ids_updated_at
BEFORE UPDATE ON telegram_chat_ids
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
