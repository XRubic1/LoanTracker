-- Realtime + RLS: FULL replica identity so UPDATE/DELETE payloads include row data
-- that Realtime can authorize against SELECT policies for each subscriber.
-- Tables are already in supabase_realtime (see 006–024); this only upgrades identity.

ALTER TABLE public.loans REPLICA IDENTITY FULL;
ALTER TABLE public.reserves REPLICA IDENTITY FULL;
ALTER TABLE public.client_insurance REPLICA IDENTITY FULL;
ALTER TABLE public.insurance_verification REPLICA IDENTITY FULL;
ALTER TABLE public.aaa_payments REPLICA IDENTITY FULL;
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER TABLE public.worksheet_entries REPLICA IDENTITY FULL;
ALTER TABLE public.companies REPLICA IDENTITY FULL;
