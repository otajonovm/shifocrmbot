-- Cashback / referral tizimi
-- Supabase SQL Editor da ishga tushiring

CREATE TABLE IF NOT EXISTS patient_cashback_balances (
  patient_id TEXT PRIMARY KEY,
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned NUMERIC(14, 2) NOT NULL DEFAULT 0,
  lifetime_spent NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cashback_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'referral_bonus', 'adjust')),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(14, 2),
  payment_id TEXT,
  payment_amount NUMERIC(14, 2),
  related_patient_id TEXT,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bir to'lovdan bir marta earn / spend (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cashback_tx_earn_payment
  ON cashback_transactions(patient_id, payment_id, type)
  WHERE payment_id IS NOT NULL AND type IN ('earn', 'spend');

CREATE INDEX IF NOT EXISTS idx_cashback_tx_patient_created
  ON cashback_transactions(patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS patient_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_patient_id TEXT NOT NULL,
  referred_patient_id TEXT NOT NULL,
  referred_chat_id TEXT,
  bonus_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'bonus_paid', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  rewarded_at TIMESTAMPTZ,
  UNIQUE (referred_patient_id)
);

CREATE INDEX IF NOT EXISTS idx_patient_referrals_referrer
  ON patient_referrals(referrer_patient_id);

DROP TRIGGER IF EXISTS update_patient_cashback_balances_updated_at ON patient_cashback_balances;
CREATE TRIGGER update_patient_cashback_balances_updated_at
BEFORE UPDATE ON patient_cashback_balances
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

GRANT ALL ON TABLE public.patient_cashback_balances TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.cashback_transactions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.patient_referrals TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
