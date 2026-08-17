-- Keshbek jadvallari uchun ruxsat (007 dan KEYIN ishga tushiring)
-- RLS ni o'chiramiz: bot backend service_role/anon bilan ishlashi kerak.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.patient_cashback_balances TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.cashback_transactions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.patient_referrals TO anon, authenticated, service_role;

ALTER TABLE public.patient_cashback_balances DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashback_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_referrals DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cashback_balances_bot_all ON public.patient_cashback_balances;
DROP POLICY IF EXISTS cashback_tx_bot_all ON public.cashback_transactions;
DROP POLICY IF EXISTS cashback_referrals_bot_all ON public.patient_referrals;

NOTIFY pgrst, 'reload schema';
