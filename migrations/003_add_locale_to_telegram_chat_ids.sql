-- Telegram foydalanuvchisi tanlagan tilni saqlash uchun locale ustuni
ALTER TABLE telegram_chat_ids
ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'uz';

-- Noto'g'ri qiymatlar bo'lsa defaultga keltirish
UPDATE telegram_chat_ids
SET locale = 'uz'
WHERE locale IS NULL OR locale NOT IN ('uz', 'ru');

-- Kelajakda faqat ruxsat etilgan qiymatlar kirishi uchun check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'telegram_chat_ids_locale_check'
  ) THEN
    ALTER TABLE telegram_chat_ids
    ADD CONSTRAINT telegram_chat_ids_locale_check CHECK (locale IN ('uz', 'ru'));
  END IF;
END $$;
