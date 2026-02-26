-- Insert 4US loan (L440): client 4US, provider Other/DMV, total 23835.04, factoring fee 676.64, 16 installments @ 1531.98
-- Effective total = 23835.04 + 676.64 = 24511.68; installment = 24511.68 / 16 = 1531.98
-- Run in Supabase SQL Editor. Uses auth.uid() so the loan is owned by the current user.
-- If running as a service or without auth, replace auth.uid() with your owner UUID.

INSERT INTO public.loans (
  owner_id,
  client,
  ref,
  total,
  installment,
  paid_count,
  total_installments,
  start_date,
  freq_days,
  payment_dates,
  payment_notes,
  note,
  provider_type,
  provider_name,
  factoring_fee
) VALUES (
  auth.uid(),
  '4US',
  'L440',
  23835.04,
  1531.98,
  0,
  16,
  '2026-02-26',
  7,
  '[]'::jsonb,
  '[]'::jsonb,
  NULL,
  'Other',
  'DMV',
  676.64
);
