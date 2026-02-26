-- Import processed (green) payment dates for 4US / L440 loan
-- Green dates from spreadsheet: 11 payments already made on these dates
-- Run after insert_loan_4us.sql (or ensure a loan exists with client = '4US' AND ref = 'L440')

UPDATE public.loans
SET
  paid_count = 11,
  payment_dates = '[
    "2025-10-02",
    "2025-10-08",
    "2025-10-16",
    "2025-10-20",
    "2025-11-04",
    "2026-01-22",
    "2026-01-28",
    "2026-02-02",
    "2026-02-09",
    "2026-02-18",
    "2026-02-23"
  ]'::jsonb,
  payment_notes = '["","","","","","","","","","","","","","","",""]'::jsonb
WHERE client = '4US'
  AND ref = 'L440';

-- Verify: should show 11 paid, 5 left
-- SELECT client, ref, paid_count, total_installments, payment_dates FROM public.loans WHERE client = '4US' AND ref = 'L440';
