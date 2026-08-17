-- SQL ni 007 dan KEYIN ishga tushiring.
-- Jadvallar bor, lekin API (anon) ularni ko'rmasa shu fayl kerak.

GRANT ALL ON TABLE public.patient_cashback_balances TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.cashback_transactions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.patient_referrals TO anon, authenticated, service_role;

ALTER TABLE public.patient_cashback_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashback_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cashback_balances_bot_all ON public.patient_cashback_balances;
CREATE POLICY cashback_balances_bot_all
  ON public.patient_cashback_balances
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS cashback_tx_bot_all ON public.cashback_transactions;
CREATE POLICY cashback_tx_bot_all
  ON public.cashback_transactions
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS cashback_referrals_bot_all ON public.patient_referrals;
CREATE POLICY cashback_referrals_bot_all
  ON public.patient_referrals
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
