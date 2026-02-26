-- Seed loans from spreadsheet (4US section excluded per request).
-- Run in Supabase SQL Editor. Set owner_id to your auth.users id if you want these assigned, or leave NULL for legacy/unassigned.
-- Option: SET @owner_id = '<your-uuid>'; or replace NULL below.

INSERT INTO public.loans (
  client,
  ref,
  total,
  installment,
  paid_count,
  total_installments,
  start_date,
  freq_days,
  payment_dates,
  note,
  owner_id
) VALUES
-- Kanone: $100k, 4 x $25k, all 4 paid
(
  'Kanone',
  'L518',
  100000.00,
  25000.00,
  4,
  4,
  '2025-02-05',
  7,
  '["2025-02-05","2025-02-12","2025-02-20","2025-02-26"]'::jsonb,
  NULL,
  NULL
),
-- GBA GROUP: $30k, 12 x $2.5k; 6 paid (30-Dec missed), note about double for missed
(
  'GBA GROUP',
  'L406',
  30000.00,
  2500.00,
  6,
  12,
  '2024-12-30',
  7,
  '["2025-01-06","2025-01-12","2025-01-20","2025-01-26","2025-02-02","2025-02-09"]'::jsonb,
  'missed; double for missed loan',
  NULL
),
-- Wire Cargo: $40k, 14 x $2,857.14; 5 paid
(
  'Wire Cargo',
  'L514',
  40000.00,
  2857.14,
  5,
  14,
  '2025-01-27',
  7,
  '["2025-01-27","2025-02-03","2025-02-10","2025-02-18","2025-02-24"]'::jsonb,
  NULL,
  NULL
),
-- Lizard Transport: $12k, 10 x $1.2k; 3 paid
(
  'Lizard Transport',
  'L523',
  12000.00,
  1200.00,
  3,
  10,
  '2025-02-09',
  7,
  '["2025-02-09","2025-02-17","2025-02-24"]'::jsonb,
  NULL,
  NULL
),
-- ATI CARRIERS: $15k, 10 x $1.5k; 3 paid
(
  'ATI CARRIERS',
  'L525',
  15000.00,
  1500.00,
  3,
  10,
  '2025-02-09',
  7,
  '["2025-02-09","2025-02-17","2025-02-25"]'::jsonb,
  NULL,
  NULL
),
-- SAPA: $20k, 15 x $1,333.33; 1 paid
(
  'SAPA',
  'L529',
  20000.00,
  1333.33,
  1,
  15,
  '2025-02-24',
  7,
  '["2025-02-24"]'::jsonb,
  NULL,
  NULL
);
