-- Backfill payment_amounts from Deduction Dates (uneven schedules).
-- Closed loans: total_installments = actual deduction count.
BEGIN;

UPDATE public.loans SET
  payment_dates = '["2025-10-09", "2025-10-17", "2025-10-23", "2025-10-31", "2025-11-07", "2025-11-14", "2025-11-21", "2025-12-05", "2025-12-11", "2025-12-17", "2026-01-02", "2026-01-09"]'::jsonb,
  payment_amounts = '[2000.0, 2000.0, 2000.0, 2000.0, 1000.0, 3000.0, 2000.0, 1000.0, 1000.0, 1000.0, 2000.0, 1000.0]'::jsonb,
  paid_count = 12,
  total_installments = 12
WHERE ref = 'L304';

UPDATE public.loans SET
  payment_dates = '["2025-04-04", "2025-04-11", "2025-04-21", "2025-04-28", "2025-05-05", "2025-05-16", "2025-05-27", "2025-06-02", "2025-06-09", "2025-06-16", "2025-06-27", "2025-07-07", "2025-07-15"]'::jsonb,
  payment_amounts = '[12500.0, 6250.0, 6250.0, 6250.0, 6250.0, 12500.0, 6250.0, 6250.0, 6250.0, 6250.0, 12500.0, 6250.0, 6250.0]'::jsonb,
  paid_count = 13,
  total_installments = 13
WHERE ref = 'L305';

UPDATE public.loans SET
  payment_dates = '["2025-04-15", "2025-04-23", "2025-04-29", "2025-05-06", "2025-05-13", "2025-05-20", "2025-05-27", "2025-06-03", "2025-06-10", "2025-06-17", "2025-06-24", "2025-07-01", "2025-07-09", "2025-07-16", "2025-07-22", "2025-07-28"]'::jsonb,
  payment_amounts = '[1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0]'::jsonb,
  paid_count = 16,
  total_installments = 16
WHERE ref = 'L313';

UPDATE public.loans SET
  payment_dates = '["2025-04-16", "2025-04-23", "2025-04-30", "2025-05-07", "2025-05-14", "2025-05-21", "2025-05-28", "2025-06-04", "2025-06-11", "2025-06-18", "2025-06-25", "2025-07-02", "2025-07-09", "2025-07-16", "2025-07-23", "2025-07-30"]'::jsonb,
  payment_amounts = '[1562.5, 1562.5, 1562.5, 1562.5, 1562.5, 1562.5, 1562.5, 1562.5, 1562.5, 1562.5, 1562.5, 1562.5, 1562.5, 1562.5, 1562.5, 1562.5]'::jsonb,
  paid_count = 16,
  total_installments = 16
WHERE ref = 'L314';

UPDATE public.loans SET
  payment_dates = '["2025-05-22", "2025-05-30", "2025-06-18", "2025-07-31"]'::jsonb,
  payment_amounts = '[2012.94, 670.98, 670.98, 2012.95]'::jsonb,
  paid_count = 4,
  total_installments = 4
WHERE ref = 'L315';

UPDATE public.loans SET
  payment_dates = '["2025-05-14", "2025-05-19", "2025-05-27", "2025-06-02", "2025-06-09", "2025-06-16", "2025-06-23", "2025-06-30", "2025-07-07", "2025-07-14", "2025-07-21", "2025-07-28", "2025-08-04", "2025-08-11", "2025-08-18", "2025-08-25"]'::jsonb,
  payment_amounts = '[1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98]'::jsonb,
  paid_count = 16,
  total_installments = 16
WHERE ref = 'L319';

UPDATE public.loans SET
  payment_dates = '["2025-05-20", "2025-05-27", "2025-06-02", "2025-06-09", "2025-06-16", "2025-06-23", "2025-06-30", "2025-07-07"]'::jsonb,
  payment_amounts = '[6250.0, 6250.0, 6250.0, 6250.0, 6250.0, 6250.0, 6250.0, 6250.0]'::jsonb,
  paid_count = 8,
  total_installments = 8
WHERE ref = 'L327';

UPDATE public.loans SET
  payment_dates = '["2025-05-21", "2025-05-28", "2025-06-04", "2025-06-12"]'::jsonb,
  payment_amounts = '[1000.0, 1000.0, 1000.0, 1000.0]'::jsonb,
  paid_count = 4,
  total_installments = 4
WHERE ref = 'L328';

UPDATE public.loans SET
  payment_dates = '["2025-05-21", "2025-05-29", "2025-06-02", "2025-06-09", "2025-06-17", "2025-06-23", "2025-07-01"]'::jsonb,
  payment_amounts = '[1000.0, 1000.0, 1000.0, 1000.0, 1000.0, 1000.0, 1000.0]'::jsonb,
  paid_count = 7,
  total_installments = 7
WHERE ref = 'L330';

UPDATE public.loans SET
  payment_dates = '["2025-05-28", "2025-06-05", "2025-06-11", "2025-06-20", "2025-06-25", "2025-07-03", "2025-07-11", "2025-07-16"]'::jsonb,
  payment_amounts = '[3486.67, 3486.67, 3486.67, 3486.67, 3486.67, 3486.67, 3486.67, 3486.67]'::jsonb,
  paid_count = 8,
  total_installments = 8
WHERE ref = 'L331';

UPDATE public.loans SET
  payment_dates = '["2025-05-22", "2025-05-30", "2025-06-06", "2025-06-13"]'::jsonb,
  payment_amounts = '[10632.68, 13290.85, 13290.85, 13290.85]'::jsonb,
  paid_count = 4,
  total_installments = 4
WHERE ref = 'L332';

UPDATE public.loans SET
  payment_dates = '["2025-06-10", "2025-06-17", "2025-06-24", "2025-07-01", "2025-07-08", "2025-07-15", "2025-07-22", "2025-07-29", "2025-08-05", "2025-08-12", "2025-08-19", "2025-08-27", "2025-09-03", "2025-09-09", "2025-09-16", "2025-09-23"]'::jsonb,
  payment_amounts = '[1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98, 1531.98]'::jsonb,
  paid_count = 16,
  total_installments = 16
WHERE ref = 'L341';

UPDATE public.loans SET
  payment_dates = '["2025-07-03", "2025-07-10", "2025-07-17"]'::jsonb,
  payment_amounts = '[6666.66, 6666.66, 6666.68]'::jsonb,
  paid_count = 3,
  total_installments = 3
WHERE ref = 'L351';

UPDATE public.loans SET
  payment_dates = '["2025-06-18", "2025-06-25", "2025-07-03", "2025-07-11"]'::jsonb,
  payment_amounts = '[1250.0, 1250.0, 1250.0, 1250.0]'::jsonb,
  paid_count = 4,
  total_installments = 4
WHERE ref = 'L353';

UPDATE public.loans SET
  payment_dates = '["2025-06-23", "2025-06-30", "2025-07-07", "2025-07-14", "2025-07-21", "2025-07-28", "2025-08-04", "2025-08-11", "2025-08-18", "2025-08-25"]'::jsonb,
  payment_amounts = '[3000.0, 3000.0, 3000.0, 3000.0, 3000.0, 3000.0, 3000.0, 3000.0, 3000.0, 3000.0]'::jsonb,
  paid_count = 10,
  total_installments = 10
WHERE ref = 'L355';

UPDATE public.loans SET
  payment_dates = '["2025-07-01", "2025-07-09", "2025-07-15", "2025-07-23", "2025-07-30", "2025-08-06", "2025-08-13", "2025-08-20", "2025-08-26", "2025-09-02", "2025-09-18", "2025-09-24", "2025-10-02", "2025-10-06", "2025-10-16"]'::jsonb,
  payment_amounts = '[383.0, 383.0, 383.0, 383.0, 383.0, 383.0, 383.0, 383.0, 383.0, 383.0, 766.0, 383.0, 383.0, 383.0, 383.0]'::jsonb,
  paid_count = 15,
  total_installments = 15
WHERE ref = 'L361';

UPDATE public.loans SET
  payment_dates = '["2025-07-03", "2025-07-08", "2025-07-14", "2025-07-21", "2025-07-29", "2025-08-04"]'::jsonb,
  payment_amounts = '[1166.67, 1166.67, 1166.67, 1166.67, 1166.67, 1166.65]'::jsonb,
  paid_count = 6,
  total_installments = 6
WHERE ref = 'L363';

UPDATE public.loans SET
  payment_dates = '["2025-07-08", "2025-07-16", "2025-07-22", "2025-07-29", "2025-08-05", "2025-08-12", "2025-08-20", "2025-08-27", "2025-09-03", "2025-09-09", "2025-09-16", "2025-09-23", "2025-09-30", "2025-10-09", "2025-10-21", "2025-10-27"]'::jsonb,
  payment_amounts = '[5744.92, 5744.92, 5744.92, 5744.92, 5744.92, 5744.92, 5744.92, 5744.92, 5744.92, 5744.92, 5744.92, 5744.92, 5744.92, 5744.92, 5744.92, 5744.92]'::jsonb,
  paid_count = 16,
  total_installments = 16
WHERE ref = 'L366';

UPDATE public.loans SET
  payment_dates = '["2025-07-18", "2025-07-25", "2025-08-01", "2025-08-15", "2025-08-22"]'::jsonb,
  payment_amounts = '[3228.7, 3228.7, 3228.7, 3228.7, 3228.7]'::jsonb,
  paid_count = 5,
  total_installments = 5
WHERE ref = 'L373';

UPDATE public.loans SET
  payment_dates = '["2025-07-22", "2025-07-30", "2025-08-05"]'::jsonb,
  payment_amounts = '[1333.33, 1333.33, 1333.34]'::jsonb,
  paid_count = 3,
  total_installments = 3
WHERE ref = 'L376';

UPDATE public.loans SET
  payment_dates = '["2025-07-25", "2025-08-01", "2025-08-15", "2025-08-22", "2025-08-29", "2025-09-05", "2025-09-19", "2025-09-26", "2025-10-03", "2025-10-10", "2025-10-17", "2025-10-24", "2025-10-31", "2025-11-07"]'::jsonb,
  payment_amounts = '[1914.97, 1914.97, 3829.94, 1914.97, 1914.97, 1914.97, 3829.94, 1914.97, 1914.97, 1914.97, 1914.97, 1914.97, 1914.97, 1914.97]'::jsonb,
  paid_count = 14,
  total_installments = 14
WHERE ref = 'L381';

UPDATE public.loans SET
  payment_dates = '["2025-08-13", "2025-08-20", "2025-08-28", "2025-09-03", "2025-09-10", "2025-09-17", "2025-09-24", "2025-10-01", "2025-10-08", "2025-10-15"]'::jsonb,
  payment_amounts = '[1200.0, 1200.0, 1200.0, 1200.0, 1200.0, 1200.0, 1200.0, 1200.0, 1200.0, 1200.0]'::jsonb,
  paid_count = 10,
  total_installments = 10
WHERE ref = 'L399';

UPDATE public.loans SET
  payment_dates = '["2025-08-18", "2025-08-26", "2025-09-02", "2025-09-11", "2025-09-19", "2025-09-27", "2025-10-05", "2025-10-13"]'::jsonb,
  payment_amounts = '[986.44, 986.44, 986.44, 988.44, 986.44, 986.44, 986.44, 984.47]'::jsonb,
  paid_count = 8,
  total_installments = 8
WHERE ref = 'L400';

UPDATE public.loans SET
  payment_dates = '["2025-08-15", "2025-08-27", "2025-09-03"]'::jsonb,
  payment_amounts = '[1166.66, 1166.66, 1166.68]'::jsonb,
  paid_count = 3,
  total_installments = 3
WHERE ref = 'L402';

UPDATE public.loans SET
  payment_dates = '["2025-08-22"]'::jsonb,
  payment_amounts = '[15000.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L411';

UPDATE public.loans SET
  payment_dates = '["2025-08-29"]'::jsonb,
  payment_amounts = '[10000.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L415';

UPDATE public.loans SET
  payment_dates = '["2025-09-04", "2025-09-11", "2025-09-18", "2025-09-25", "2025-10-06", "2025-10-14", "2025-10-22", "2025-10-29", "2025-11-03", "2025-11-10"]'::jsonb,
  payment_amounts = '[5000.0, 5000.0, 5000.0, 5000.0, 5000.0, 5000.0, 5000.0, 2000.0, 1000.0, 1000.0]'::jsonb,
  paid_count = 10,
  total_installments = 10
WHERE ref = 'L416';

UPDATE public.loans SET
  payment_dates = '["2025-09-12", "2025-09-19", "2025-09-26", "2025-10-03", "2025-10-10", "2025-10-17"]'::jsonb,
  payment_amounts = '[5000.0, 5000.0, 5000.0, 5000.0, 5000.0, 5000.0]'::jsonb,
  paid_count = 6,
  total_installments = 6
WHERE ref = 'L421';

UPDATE public.loans SET
  payment_dates = '["2025-09-12", "2025-09-26"]'::jsonb,
  payment_amounts = '[1266.66, 2533.34]'::jsonb,
  paid_count = 2,
  total_installments = 2
WHERE ref = 'L423';

UPDATE public.loans SET
  payment_dates = '["2025-09-15", "2025-09-22", "2025-09-29", "2025-10-06", "2025-10-14", "2025-10-20", "2025-10-27", "2025-11-05", "2025-11-12", "2025-11-19", "2025-11-26", "2025-12-03", "2025-12-10", "2025-12-17", "2025-12-24", "2025-12-31", "2026-01-07", "2026-01-14", "2026-01-21", "2026-01-28", "2026-02-04", "2026-02-11", "2026-02-18", "2026-02-25", "2026-03-04", "2026-03-11", "2026-03-18", "2026-03-25", "2026-04-01", "2026-04-08", "2026-04-15", "2026-04-22", "2026-04-29", "2026-05-06", "2026-05-13", "2026-05-20", "2026-05-27", "2026-06-03", "2026-06-10", "2026-06-17", "2026-06-24", "2026-07-01", "2026-07-08", "2026-07-15", "2026-07-22", "2026-07-29", "2026-08-05", "2026-08-12", "2026-08-19"]'::jsonb,
  payment_amounts = '[1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15, 1346.15]'::jsonb,
  paid_count = GREATEST(paid_count, 49)
WHERE ref = 'L425R';

UPDATE public.loans SET
  payment_dates = '["2025-09-19"]'::jsonb,
  payment_amounts = '[15000.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L427';

UPDATE public.loans SET
  payment_dates = '["2025-09-25", "2025-10-02", "2025-10-09", "2025-10-16", "2025-10-23", "2025-10-30", "2025-11-06", "2025-11-13", "2025-11-20", "2025-11-27"]'::jsonb,
  payment_amounts = '[1200.0, 1200.0, 1200.0, 1200.0, 1200.0, 1200.0, 1200.0, 1200.0, 1200.0, 1200.0]'::jsonb,
  paid_count = 10,
  total_installments = 10
WHERE ref = 'L431';

UPDATE public.loans SET
  payment_dates = '["2025-10-14", "2025-10-22"]'::jsonb,
  payment_amounts = '[2350.0, 3150.0]'::jsonb,
  paid_count = 2,
  total_installments = 2
WHERE ref = 'L435';

UPDATE public.loans SET
  payment_dates = '["2025-10-03"]'::jsonb,
  payment_amounts = '[15000.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L442';

UPDATE public.loans SET
  payment_dates = '["2025-10-09", "2025-10-15"]'::jsonb,
  payment_amounts = '[1100.0, 1100.0]'::jsonb,
  paid_count = 2,
  total_installments = 2
WHERE ref = 'L447';

UPDATE public.loans SET
  payment_dates = '["2025-10-10"]'::jsonb,
  payment_amounts = '[20000.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L453';

UPDATE public.loans SET
  payment_dates = '["2025-10-17", "2025-10-24"]'::jsonb,
  payment_amounts = '[12000.0, 18000.0]'::jsonb,
  paid_count = 2,
  total_installments = 2
WHERE ref = 'L455';

UPDATE public.loans SET
  payment_dates = '["2025-10-31", "2025-11-06", "2025-11-12", "2025-11-12", "2025-11-14", "2025-11-24", "2025-11-30", "2025-12-04", "2026-11-07"]'::jsonb,
  payment_amounts = '[4224.76, 1995.0, 5775.24, 1005.0, 5000.0, 5000.0, 5000.0, 2445.5, 2554.5]'::jsonb,
  paid_count = 9,
  total_installments = 9
WHERE ref = 'L458';

UPDATE public.loans SET
  payment_dates = '["2025-11-14"]'::jsonb,
  payment_amounts = '[25000.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L470';

UPDATE public.loans SET
  payment_dates = '["2025-11-19", "2025-11-26", "2025-12-03", "2025-12-10", "2025-12-17", "2025-12-24", "2025-12-31", "2026-01-08", "2026-01-15", "2026-01-21", "2026-01-28", "2026-02-04", "2026-02-11", "2026-02-19", "2026-02-25", "2026-03-04"]'::jsonb,
  payment_amounts = '[765.99, 765.99, 765.99, 765.99, 765.99, 765.99, 765.99, 765.99, 765.99, 765.99, 765.99, 765.99, 765.99, 765.99, 765.99, 765.99]'::jsonb,
  paid_count = 16,
  total_installments = 16
WHERE ref = 'L471';

UPDATE public.loans SET
  payment_dates = '["2025-11-19", "2025-12-03", "2025-12-05", "2025-12-10", "2025-12-17", "2025-12-24", "2025-12-31", "2026-01-07", "2026-01-14", "2026-01-21"]'::jsonb,
  payment_amounts = '[1200.0, 1200.0, 1200.0, 1200.0, 1200.0, 1200.0, 1200.0, 1200.0, 1200.0, 1200.0]'::jsonb,
  paid_count = 10,
  total_installments = 10
WHERE ref = 'L472';

UPDATE public.loans SET
  payment_dates = '["2025-11-21"]'::jsonb,
  payment_amounts = '[12000.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L473';

UPDATE public.loans SET
  payment_dates = '["2025-11-20", "2025-11-24"]'::jsonb,
  payment_amounts = '[24000.0, 6000.0]'::jsonb,
  paid_count = 2,
  total_installments = 2
WHERE ref = 'L474';

UPDATE public.loans SET
  payment_dates = '["2025-11-26", "2025-12-03", "2025-12-10", "2025-12-18", "2025-12-26", "2025-12-31", "2026-01-08", "2026-01-16", "2026-01-23", "2026-01-30", "2026-02-06", "2026-02-17", "2026-02-27"]'::jsonb,
  payment_amounts = '[1785.0, 1785.0, 1785.0, 1785.0, 1785.0, 1785.0, 1785.0, 1785.0, 1785.0, 1785.0, 1785.0, 1785.0, 3580.0]'::jsonb,
  paid_count = 13,
  total_installments = 13
WHERE ref = 'L475';

UPDATE public.loans SET
  payment_dates = '["2025-11-26", "2025-12-03", "2025-12-17", "2025-12-24", "2025-12-31", "2026-01-07", "2026-01-14", "2026-01-21"]'::jsonb,
  payment_amounts = '[1875.0, 1875.0, 1875.0, 1875.0, 1875.0, 1875.0, 1875.0, 1875.0]'::jsonb,
  paid_count = 8,
  total_installments = 8
WHERE ref = 'L476';

UPDATE public.loans SET
  payment_dates = '["2025-11-26", "2025-12-12", "2025-12-15", "2025-12-26", "2026-01-02", "2026-01-12"]'::jsonb,
  payment_amounts = '[4642.85, 18571.42, 2000.0, 4642.85, 9285.71, 9285.75]'::jsonb,
  paid_count = 6,
  total_installments = 6
WHERE ref = 'L478';

UPDATE public.loans SET
  payment_dates = '["2025-12-15"]'::jsonb,
  payment_amounts = '[15450.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L487';

UPDATE public.loans SET
  payment_dates = '["2025-12-18", "2025-12-31", "2026-01-08", "2026-01-15", "2026-01-23", "2026-01-29", "2026-02-05", "2026-02-12", "2026-02-19"]'::jsonb,
  payment_amounts = '[3500.0, 7000.0, 3500.0, 3500.0, 3500.0, 3500.0, 3500.0, 3500.0, 3500.0]'::jsonb,
  paid_count = 9,
  total_installments = 9
WHERE ref = 'L490';

UPDATE public.loans SET
  payment_dates = '["2025-12-15", "2025-12-22", "2025-12-29", "2026-01-05", "2026-01-12", "2026-01-20"]'::jsonb,
  payment_amounts = '[1666.67, 1666.67, 1666.67, 1666.67, 1666.67, 1666.65]'::jsonb,
  paid_count = 6,
  total_installments = 6
WHERE ref = 'L491';

UPDATE public.loans SET
  payment_dates = '["2025-12-26"]'::jsonb,
  payment_amounts = '[15000.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L493';

UPDATE public.loans SET
  payment_dates = '["2026-01-02", "2026-01-09", "2026-01-16", "2026-01-23", "2026-01-30", "2026-02-06"]'::jsonb,
  payment_amounts = '[5000.0, 5000.0, 5000.0, 5000.0, 5000.0, 5000.0]'::jsonb,
  paid_count = 6,
  total_installments = 6
WHERE ref = 'L500';

UPDATE public.loans SET
  payment_dates = '["2026-01-06"]'::jsonb,
  payment_amounts = '[2000.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L501';

UPDATE public.loans SET
  payment_dates = '["2026-01-07", "2026-01-14", "2026-01-21", "2026-01-28"]'::jsonb,
  payment_amounts = '[2634.4, 2634.4, 2634.4, 2634.4]'::jsonb,
  paid_count = 4,
  total_installments = 4
WHERE ref = 'L502';

UPDATE public.loans SET
  payment_dates = '["2026-01-06", "2026-01-13", "2026-01-22", "2026-01-28", "2026-02-04", "2026-02-11", "2026-02-18", "2026-02-25", "2026-03-04", "2026-03-11", "2026-03-18", "2026-03-25"]'::jsonb,
  payment_amounts = '[833.33, 833.33, 833.33, 833.33, 833.33, 833.33, 833.33, 833.33, 833.33, 833.33, 833.33, 833.37]'::jsonb,
  paid_count = 12,
  total_installments = 12
WHERE ref = 'L503';

UPDATE public.loans SET
  payment_dates = '["2026-01-02", "2026-01-09", "2026-01-16", "2026-01-20"]'::jsonb,
  payment_amounts = '[12500.0, 12500.0, 12500.0, 12500.0]'::jsonb,
  paid_count = 4,
  total_installments = 4
WHERE ref = 'L504';

UPDATE public.loans SET
  payment_dates = '["2026-01-27"]'::jsonb,
  payment_amounts = '[5000.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L505';

UPDATE public.loans SET
  payment_dates = '["2026-01-12", "2026-01-21"]'::jsonb,
  payment_amounts = '[1000.0, 1000.0]'::jsonb,
  paid_count = 2,
  total_installments = 2
WHERE ref = 'L509';

UPDATE public.loans SET
  payment_dates = '["2025-01-16", "2025-01-23", "2025-01-30", "2025-02-06", "2025-02-13", "2025-02-20"]'::jsonb,
  payment_amounts = '[1666.66, 1666.66, 1666.66, 1666.66, 1666.66, 1666.7]'::jsonb,
  paid_count = 6,
  total_installments = 6
WHERE ref = 'L510';

UPDATE public.loans SET
  payment_dates = '["2026-01-28", "2026-02-04", "2026-02-11", "2026-02-18", "2026-02-25", "2026-03-06", "2026-03-13", "2026-03-20", "2026-03-27", "2026-04-03", "2026-04-10", "2026-04-17"]'::jsonb,
  payment_amounts = '[2083.33, 2083.33, 2083.33, 2083.33, 2083.33, 2083.33, 2083.33, 2083.33, 2083.33, 2083.33, 2083.33, 2083.37]'::jsonb,
  paid_count = 12,
  total_installments = 12
WHERE ref = 'L513';

UPDATE public.loans SET
  payment_dates = '["2026-02-03", "2026-02-10", "2026-02-17"]'::jsonb,
  payment_amounts = '[1166.66, 1166.66, 1166.68]'::jsonb,
  paid_count = 3,
  total_installments = 3
WHERE ref = 'L517';

UPDATE public.loans SET
  payment_dates = '["2025-02-04", "2025-02-05"]'::jsonb,
  payment_amounts = '[2500.0, 2500.0]'::jsonb,
  paid_count = 2,
  total_installments = 2
WHERE ref = 'L519';

UPDATE public.loans SET
  payment_dates = '["2026-02-06", "2026-02-12"]'::jsonb,
  payment_amounts = '[20000.0, 12000.0]'::jsonb,
  paid_count = 2,
  total_installments = 2
WHERE ref = 'L520';

UPDATE public.loans SET
  payment_dates = '["2026-02-06", "2026-02-13", "2026-02-13", "2026-02-20", "2026-02-20", "2026-02-27", "2026-02-27", "2026-03-05", "2026-03-06", "2026-03-12", "2026-03-13", "2026-03-19", "2026-03-20", "2026-03-26", "2026-03-27", "2026-04-02"]'::jsonb,
  payment_amounts = '[12500.0, 2916.66, 12500.0, 5000.0, 12500.0, 5000.0, 12500.0, 5000.0, 12500.0, 2916.66, 12500.0, 7083.34, 12500.0, 5000.0, 12500.0, 2083.34]'::jsonb,
  paid_count = 16,
  total_installments = 16
WHERE ref = 'L521';

UPDATE public.loans SET
  payment_dates = '["2026-02-06", "2026-02-13", "2026-02-20", "2026-02-27", "2026-03-06", "2026-03-13"]'::jsonb,
  payment_amounts = '[3333.33, 3333.33, 3333.33, 3333.33, 3333.33, 3333.35]'::jsonb,
  paid_count = 6,
  total_installments = 6
WHERE ref = 'L522';

UPDATE public.loans SET
  payment_dates = '["2026-02-23", "2026-03-03", "2026-03-09", "2026-03-16", "2026-03-23"]'::jsonb,
  payment_amounts = '[2000.0, 2000.0, 2000.0, 2000.0, 2000.0]'::jsonb,
  paid_count = 5,
  total_installments = 5
WHERE ref = 'L526';

UPDATE public.loans SET
  payment_dates = '["2026-02-18", "2026-03-18", "2026-02-25", "2026-03-25", "2026-03-04", "2026-04-08", "2026-03-11", "2026-04-15", "2026-03-18", "2026-04-22", "2026-03-25", "2026-04-01", "2026-04-08", "2026-04-15", "2026-04-22", "2026-04-29", "2026-05-06"]'::jsonb,
  payment_amounts = '[3333.33, 10000.0, 3333.33, 10000.0, 3333.33, 10000.0, 3333.33, 10000.0, 3333.33, 10000.0, 3333.33, 3333.33, 3333.33, 3333.33, 3333.33, 3333.33, 3333.37]'::jsonb,
  paid_count = 17,
  total_installments = 17
WHERE ref = 'L527';

UPDATE public.loans SET
  payment_dates = '["2026-02-23"]'::jsonb,
  payment_amounts = '[25000.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L532';

UPDATE public.loans SET
  payment_dates = '["2026-03-13", "2026-03-20", "2026-03-27", "2026-04-03", "2026-04-10", "2026-04-24", "2026-05-01", "2026-05-15"]'::jsonb,
  payment_amounts = '[1000.0, 1000.0, 1000.0, 1000.0, 1000.0, 2000.0, 1000.0, 2000.0]'::jsonb,
  paid_count = 8,
  total_installments = 8
WHERE ref = 'L541';

UPDATE public.loans SET
  payment_dates = '["2026-03-18", "2026-03-25", "2026-04-01", "2026-04-08", "2026-04-15", "2026-04-22", "2026-04-29", "2026-05-06", "2026-05-13", "2026-05-20", "2026-06-03"]'::jsonb,
  payment_amounts = '[4166.67, 4166.67, 4166.67, 4166.67, 4166.67, 4166.67, 4166.67, 4166.67, 4166.67, 4166.67, 4166.67]'::jsonb,
  paid_count = GREATEST(paid_count, 11)
WHERE ref = 'L542';

UPDATE public.loans SET
  payment_dates = '["2026-03-19", "2026-03-26", "2026-04-02", "2026-04-09", "2026-04-17", "2026-04-24"]'::jsonb,
  payment_amounts = '[2500.0, 2500.0, 2500.0, 2500.0, 2500.0, 2500.0]'::jsonb,
  paid_count = 6,
  total_installments = 6
WHERE ref = 'L544';

UPDATE public.loans SET
  payment_dates = '["2026-03-25", "2026-04-01", "2026-04-09", "2026-04-15", "2026-04-22", "2026-04-29", "2026-05-06", "2026-05-13", "2026-05-20", "2026-05-27", "2026-06-05", "2026-06-10", "2026-06-17", "2026-06-24", "2026-07-01", "2026-07-08"]'::jsonb,
  payment_amounts = '[1875.0, 1875.0, 1875.0, 1875.0, 1875.0, 1875.0, 1875.0, 1875.0, 1875.0, 1875.0, 1875.0, 1875.0, 1875.0, 1875.0, 1875.0, 1875.0]'::jsonb,
  paid_count = 16,
  total_installments = 16
WHERE ref = 'L548';

UPDATE public.loans SET
  payment_dates = '["2026-03-27", "2026-04-03", "2026-04-10", "2026-04-20", "2026-04-27", "2026-05-04", "2026-05-15", "2026-05-22", "2026-06-01", "2026-06-10", "2026-06-22", "2026-06-29", "2026-07-07", "2026-07-15"]'::jsonb,
  payment_amounts = '[2500.0, 2500.0, 2500.0, 2500.0, 2500.0, 2500.0, 5000.0, 2500.0, 2500.0, 5000.0, 2500.0, 2500.0, 2500.0, 2500.0]'::jsonb,
  paid_count = 14,
  total_installments = 14
WHERE ref = 'L549';

UPDATE public.loans SET
  payment_dates = '["2026-03-30", "2026-04-06", "2026-04-13", "2026-04-20", "2026-04-27", "2026-05-04", "2026-05-12", "2026-05-18", "2026-05-26", "2026-06-03", "2026-06-11", "2026-06-15", "2026-06-23", "2026-07-01", "2026-07-17"]'::jsonb,
  payment_amounts = '[3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 6250.0]'::jsonb,
  paid_count = 15,
  total_installments = 15
WHERE ref = 'L550';

UPDATE public.loans SET
  payment_dates = '["2026-01-27", "2026-02-03", "2026-02-10", "2026-02-17", "2026-02-24"]'::jsonb,
  payment_amounts = '[5381.17, 5381.17, 5381.17, 5381.17, 5381.17]'::jsonb,
  paid_count = 5,
  total_installments = 5
WHERE ref = 'L551';

UPDATE public.loans SET
  payment_dates = '["2026-04-02", "2026-04-09", "2026-04-16", "2026-04-23", "2026-04-30", "2026-05-07", "2026-05-14", "2026-05-21"]'::jsonb,
  payment_amounts = '[4095.29, 4095.29, 4095.29, 4095.29, 4095.29, 4095.29, 4095.29, 4095.29]'::jsonb,
  paid_count = 8,
  total_installments = 8
WHERE ref = 'L552';

UPDATE public.loans SET
  payment_dates = '["2026-04-02", "2026-04-09", "2026-04-16", "2026-04-23", "2026-04-30", "2026-05-07", "2026-05-14", "2026-05-21"]'::jsonb,
  payment_amounts = '[4095.29, 4095.29, 4095.29, 4095.29, 4095.29, 4095.29, 4095.29, 4095.29]'::jsonb,
  paid_count = 8,
  total_installments = 8
WHERE ref = 'L553';

UPDATE public.loans SET
  payment_dates = '["2026-04-01", "2026-04-08", "2026-04-15", "2026-04-22", "2026-05-04"]'::jsonb,
  payment_amounts = '[5265.53, 5265.53, 5265.53, 5265.53, 5265.53]'::jsonb,
  paid_count = 5,
  total_installments = 5
WHERE ref = 'L554';

UPDATE public.loans SET
  payment_dates = '["2026-03-30", "2026-04-06", "2026-04-13", "2026-04-20", "2026-04-27", "2026-05-04"]'::jsonb,
  payment_amounts = '[1666.66, 1666.66, 1666.66, 1666.66, 1666.66, 1666.7]'::jsonb,
  paid_count = 6,
  total_installments = 6
WHERE ref = 'L557';

UPDATE public.loans SET
  payment_dates = '["2026-04-03", "2026-04-10", "2026-04-17", "2026-04-24", "2026-05-01", "2026-05-08", "2026-05-15", "2026-05-22", "2026-05-29", "2026-06-05", "2026-06-12", "2026-06-26", "2026-07-03", "2026-07-10", "2026-07-17"]'::jsonb,
  payment_amounts = '[3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 3125.0, 6250.0, 3125.0, 3125.0, 3125.0]'::jsonb,
  paid_count = 15,
  total_installments = 15
WHERE ref = 'L560';

UPDATE public.loans SET
  payment_dates = '["2026-04-09"]'::jsonb,
  payment_amounts = '[20000.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L563';

UPDATE public.loans SET
  payment_dates = '["2026-04-13", "2026-04-24", "2026-05-08", "2026-05-15"]'::jsonb,
  payment_amounts = '[2677.88, 5355.76, 5355.76, 2677.88]'::jsonb,
  paid_count = 4,
  total_installments = 4
WHERE ref = 'L564';

UPDATE public.loans SET
  payment_dates = '["2026-04-14", "2026-04-21", "2026-04-28", "2026-05-05", "2026-05-12", "2026-05-20", "2026-05-26", "2026-06-02", "2026-06-09", "2026-06-16"]'::jsonb,
  payment_amounts = '[6000.0, 6000.0, 6000.0, 6000.0, 6000.0, 6000.0, 6000.0, 6000.0, 6000.0, 6000.0]'::jsonb,
  paid_count = 10,
  total_installments = 10
WHERE ref = 'L566';

UPDATE public.loans SET
  payment_dates = '["2026-04-15", "2026-04-20"]'::jsonb,
  payment_amounts = '[12500.0, 12500.0]'::jsonb,
  paid_count = 2,
  total_installments = 2
WHERE ref = 'L569';

UPDATE public.loans SET
  payment_dates = '["2026-04-16", "2026-04-23", "2026-04-30", "2026-05-07"]'::jsonb,
  payment_amounts = '[5000.0, 5000.0, 5000.0, 5000.0]'::jsonb,
  paid_count = 4,
  total_installments = 4
WHERE ref = 'L570';

UPDATE public.loans SET
  payment_dates = '["2026-04-21", "2026-05-06", "2026-05-11", "2026-05-18"]'::jsonb,
  payment_amounts = '[1250.0, 1250.0, 1250.0, 1250.0]'::jsonb,
  paid_count = 4,
  total_installments = 4
WHERE ref = 'L571';

UPDATE public.loans SET
  payment_dates = '["2026-04-24", "2026-04-30", "2026-05-08"]'::jsonb,
  payment_amounts = '[5000.0, 5000.0, 10000.0]'::jsonb,
  paid_count = 3,
  total_installments = 3
WHERE ref = 'L574';

UPDATE public.loans SET
  payment_dates = '["2026-07-23", "2026-07-27", "2026-08-06", "2026-08-14", "2026-08-18"]'::jsonb,
  payment_amounts = '[2916.67, 2916.67, 2916.67, 2916.67, 2916.67]'::jsonb,
  paid_count = GREATEST(paid_count, 5)
WHERE ref = 'L575';

UPDATE public.loans SET
  payment_dates = '["2026-05-14", "2026-07-03", "2026-07-07", "2026-07-13", "2026-07-23", "2026-07-27", "2026-08-06", "2026-08-14", "2026-08-18"]'::jsonb,
  payment_amounts = '[833.33, 833.33, 833.33, 833.33, 833.33, 833.33, 833.33, 833.33, 833.33]'::jsonb,
  paid_count = GREATEST(paid_count, 9)
WHERE ref = 'L577';

UPDATE public.loans SET
  payment_dates = '["2026-04-05", "2026-05-22", "2026-05-29", "2026-06-05", "2026-06-12", "2026-06-19", "2026-06-19", "2026-06-26", "2026-07-03", "2026-07-10"]'::jsonb,
  payment_amounts = '[12000.0, 12000.0, 12000.0, 12000.0, 12000.0, 12000.0, 12000.0, 12000.0, 12000.0, 12000.0]'::jsonb,
  paid_count = 10,
  total_installments = 10
WHERE ref = 'L581';

UPDATE public.loans SET
  payment_dates = '["2026-05-07", "2026-05-14"]'::jsonb,
  payment_amounts = '[2500.0, 2500.0]'::jsonb,
  paid_count = 2,
  total_installments = 2
WHERE ref = 'L585';

UPDATE public.loans SET
  payment_dates = '["2026-05-07", "2026-05-11"]'::jsonb,
  payment_amounts = '[10500.0, 9500.0]'::jsonb,
  paid_count = 2,
  total_installments = 2
WHERE ref = 'L588';

UPDATE public.loans SET
  payment_dates = '["2026-06-12", "2026-06-18", "2026-06-26", "2026-07-03", "2026-07-10", "2026-07-17", "2026-07-24", "2026-07-31", "2026-08-07", "2026-08-14", "2026-08-21"]'::jsonb,
  payment_amounts = '[4419.0, 2209.5, 2209.5, 2209.5, 2209.5, 2209.5, 2209.5, 2209.5, 2209.5, 2209.5, 2209.5]'::jsonb,
  paid_count = GREATEST(paid_count, 11)
WHERE ref = 'L590';

UPDATE public.loans SET
  payment_dates = '["2025-05-15", "2025-07-14", "2025-07-21", "2026-05-26", "2026-06-02", "2026-06-12", "2026-06-19", "2026-06-26", "2026-07-03"]'::jsonb,
  payment_amounts = '[1500.0, 500.0, 500.0, 1500.0, 1500.0, 1500.0, 1500.0, 1500.0, 1500.0]'::jsonb,
  paid_count = GREATEST(paid_count, 9)
WHERE ref = 'L591';

UPDATE public.loans SET
  payment_dates = '["2026-05-14", "2026-05-21", "2026-05-28", "2026-06-05", "2026-06-11", "2026-06-18"]'::jsonb,
  payment_amounts = '[1442.44, 1442.44, 1442.44, 1442.44, 1442.44, 1442.44]'::jsonb,
  paid_count = 6,
  total_installments = 6
WHERE ref = 'L593';

UPDATE public.loans SET
  payment_dates = '["2026-05-11", "2026-05-19", "2026-05-26", "2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22", "2026-06-29"]'::jsonb,
  payment_amounts = '[4095.3, 4095.3, 4095.3, 4095.3, 4095.3, 4095.3, 4095.3, 4095.3]'::jsonb,
  paid_count = 8,
  total_installments = 8
WHERE ref = 'L594';

UPDATE public.loans SET
  payment_dates = '["2026-05-20", "2026-05-27", "2026-06-02", "2026-06-09", "2026-06-16", "2026-06-23", "2026-06-30", "2026-07-07"]'::jsonb,
  payment_amounts = '[6552.47, 6552.47, 6552.47, 6552.47, 6552.47, 6552.47, 6552.47, 6552.47]'::jsonb,
  paid_count = 8,
  total_installments = 8
WHERE ref = 'L595';

UPDATE public.loans SET
  payment_dates = '["2026-05-29", "2026-06-05", "2026-06-12", "2026-06-18", "2026-06-26", "2026-07-03"]'::jsonb,
  payment_amounts = '[5000.0, 2000.0, 1000.0, 1000.0, 1000.0, 500.0]'::jsonb,
  paid_count = 6,
  total_installments = 6
WHERE ref = 'L599';

UPDATE public.loans SET
  payment_dates = '["2026-05-22", "2026-05-29"]'::jsonb,
  payment_amounts = '[15000.0, 15000.0]'::jsonb,
  paid_count = 2,
  total_installments = 2
WHERE ref = 'L600';

UPDATE public.loans SET
  payment_dates = '["2026-05-19", "2026-05-26", "2026-06-02", "2026-06-09", "2026-06-16", "2026-06-23", "2026-06-25", "2026-07-02"]'::jsonb,
  payment_amounts = '[5625.0, 5625.0, 5625.0, 5625.0, 5625.0, 5625.0, 5625.0, 5625.0]'::jsonb,
  paid_count = 8,
  total_installments = 8
WHERE ref = 'L601';

UPDATE public.loans SET
  payment_dates = '["2026-06-05", "2026-06-08", "2026-06-15", "2026-06-22"]'::jsonb,
  payment_amounts = '[2820.36, 2820.36, 2916.08, 2916.08]'::jsonb,
  paid_count = 4,
  total_installments = 4
WHERE ref = 'L604';

UPDATE public.loans SET
  payment_dates = '["2026-05-26", "2026-06-02", "2026-06-09"]'::jsonb,
  payment_amounts = '[10000.0, 10000.0, 10000.0]'::jsonb,
  paid_count = 3,
  total_installments = 3
WHERE ref = 'L605';

UPDATE public.loans SET
  payment_dates = '["2026-05-28", "2026-06-04", "2026-06-11", "2026-06-18", "2026-06-25", "2026-07-02", "2026-07-09", "2026-07-16", "2026-07-23", "2026-07-30"]'::jsonb,
  payment_amounts = '[5009.7, 5009.7, 5009.7, 5009.7, 5009.7, 5009.7, 5009.7, 5009.7, 5009.7, 5009.7]'::jsonb,
  paid_count = 10,
  total_installments = 10
WHERE ref = 'L607';

UPDATE public.loans SET
  payment_dates = '["2026-05-29", "2026-06-05", "2026-06-12", "2026-06-26", "2026-07-10", "2026-07-17", "2026-07-24", "2026-07-31", "2026-08-07", "2026-08-14"]'::jsonb,
  payment_amounts = '[3333.33, 3333.33, 3333.33, 6666.66, 6666.66, 3333.33, 3333.33, 3333.33, 3333.33, 3333.37]'::jsonb,
  paid_count = 10,
  total_installments = 10
WHERE ref = 'L610';

UPDATE public.loans SET
  payment_dates = '["2026-05-26"]'::jsonb,
  payment_amounts = '[30000.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L611';

UPDATE public.loans SET
  payment_dates = '["2026-06-02"]'::jsonb,
  payment_amounts = '[10300.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L615';

UPDATE public.loans SET
  payment_dates = '["2026-06-03", "2026-06-09"]'::jsonb,
  payment_amounts = '[5000.0, 20000.0]'::jsonb,
  paid_count = 2,
  total_installments = 2
WHERE ref = 'L617';

UPDATE public.loans SET
  payment_dates = '["2026-06-11", "2026-06-18", "2026-06-25", "2026-07-02", "2026-07-09", "2026-07-16", "2026-07-23", "2026-07-30", "2026-08-06", "2026-08-14", "2026-08-20"]'::jsonb,
  payment_amounts = '[1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0, 1250.0]'::jsonb,
  paid_count = GREATEST(paid_count, 11)
WHERE ref = 'L618';

UPDATE public.loans SET
  payment_dates = '["2026-06-25", "2026-07-02", "2026-07-09", "2026-07-16"]'::jsonb,
  payment_amounts = '[6000.0, 3000.0, 3000.0, 3000.0]'::jsonb,
  paid_count = 4,
  total_installments = 4
WHERE ref = 'L619';

UPDATE public.loans SET
  payment_dates = '["2026-06-15", "2026-06-22", "2026-06-29", "2026-07-06"]'::jsonb,
  payment_amounts = '[1166.67, 1166.67, 1166.67, 3499.99]'::jsonb,
  paid_count = 4,
  total_installments = 4
WHERE ref = 'L620';

UPDATE public.loans SET
  payment_dates = '["2026-07-10", "2026-07-17", "2026-07-24", "2026-08-03", "2026-08-14"]'::jsonb,
  payment_amounts = '[1000.0, 1000.0, 1000.0, 1000.0, 1000.0]'::jsonb,
  paid_count = 5,
  total_installments = 5
WHERE ref = 'L621';

UPDATE public.loans SET
  payment_dates = '["2026-06-15", "2026-06-22"]'::jsonb,
  payment_amounts = '[7000.0, 28000.0]'::jsonb,
  paid_count = 2,
  total_installments = 2
WHERE ref = 'L622';

UPDATE public.loans SET
  payment_dates = '["2026-06-15"]'::jsonb,
  payment_amounts = '[30000.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L623';

UPDATE public.loans SET
  payment_dates = '["2026-06-22", "2026-06-30"]'::jsonb,
  payment_amounts = '[2500.0, 2500.0]'::jsonb,
  paid_count = 2,
  total_installments = 2
WHERE ref = 'L624';

UPDATE public.loans SET
  payment_dates = '["2026-06-23"]'::jsonb,
  payment_amounts = '[20000.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L627';

UPDATE public.loans SET
  payment_dates = '["2026-06-29", "2026-07-06", "2026-07-13", "2026-07-20"]'::jsonb,
  payment_amounts = '[7500.0, 7500.0, 7500.0, 7500.0]'::jsonb,
  paid_count = 4,
  total_installments = 4
WHERE ref = 'L628';

-- L630 skipped: flat $5000 x 16; Excel mixed a $3000 partial into Deduction Dates.

UPDATE public.loans SET
  payment_dates = '["2026-07-09", "2026-07-16", "2026-07-23", "2026-07-30", "2026-08-06", "2026-08-13", "2026-08-20"]'::jsonb,
  payment_amounts = '[2812.5, 2812.5, 2812.5, 2812.5, 2812.5, 2812.5, 2812.5]'::jsonb,
  paid_count = GREATEST(paid_count, 7)
WHERE ref = 'L638';

-- L639 skipped: Excel Deduction Dates mixed non-installment rows ($1428.27 etc.)
-- into a flat $6000 x 10 schedule. Keep payment_amounts empty; use installment.

UPDATE public.loans SET
  payment_dates = '["2026-07-13", "2026-07-20", "2026-07-27", "2026-08-04", "2026-08-11", "2026-08-17"]'::jsonb,
  payment_amounts = '[2500.0, 2500.0, 2500.0, 2500.0, 2500.0, 2500.0]'::jsonb,
  paid_count = 6,
  total_installments = 6
WHERE ref = 'L640';

UPDATE public.loans SET
  payment_dates = '["2026-07-08", "2026-07-13"]'::jsonb,
  payment_amounts = '[10000.0, 10000.0]'::jsonb,
  paid_count = 2,
  total_installments = 2
WHERE ref = 'L641';

UPDATE public.loans SET
  payment_dates = '["2026-07-23", "2026-07-30", "2026-08-06", "2026-08-13", "2026-08-20"]'::jsonb,
  payment_amounts = '[1000.0, 1000.0, 1000.0, 1000.0, 1000.0]'::jsonb,
  paid_count = 5,
  total_installments = 5
WHERE ref = 'L643';

UPDATE public.loans SET
  payment_dates = '["2026-07-20", "2026-07-27", "2026-08-03", "2026-08-17", "2026-08-20"]'::jsonb,
  payment_amounts = '[12000.0, 12000.0, 12000.0, 12000.0, 12000.0]'::jsonb,
  paid_count = GREATEST(paid_count, 5)
WHERE ref = 'L644';

UPDATE public.loans SET
  payment_dates = '["2026-07-20", "2026-07-29", "2026-08-05", "2026-08-12", "2026-08-19"]'::jsonb,
  payment_amounts = '[1875.0, 1875.0, 1875.0, 1875.0, 1875.0]'::jsonb,
  paid_count = GREATEST(paid_count, 5)
WHERE ref = 'L645';

UPDATE public.loans SET
  payment_dates = '["2026-07-24", "2026-07-31", "2026-08-07", "2026-08-14"]'::jsonb,
  payment_amounts = '[5000.0, 5000.0, 5000.0, 5000.0]'::jsonb,
  paid_count = GREATEST(paid_count, 4)
WHERE ref = 'L647';

UPDATE public.loans SET
  payment_dates = '["2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24"]'::jsonb,
  payment_amounts = '[250.0, 250.0, 250.0, 250.0, 250.0]'::jsonb,
  paid_count = GREATEST(paid_count, 5)
WHERE ref = 'L650';

UPDATE public.loans SET
  payment_dates = '["2026-07-20", "2026-07-27", "2026-08-03", "2026-08-10"]'::jsonb,
  payment_amounts = '[7500.0, 7500.0, 7500.0, 7500.0]'::jsonb,
  paid_count = 4,
  total_installments = 4
WHERE ref = 'L651';

UPDATE public.loans SET
  payment_dates = '["2026-07-31", "2026-08-14", "2026-08-07", "2026-08-14"]'::jsonb,
  payment_amounts = '[12500.0, 3000.0, 12500.0, 12500.0]'::jsonb,
  paid_count = 4,
  total_installments = 4
WHERE ref = 'L653';

UPDATE public.loans SET
  payment_dates = '["2026-07-29"]'::jsonb,
  payment_amounts = '[25000.0]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L654';

UPDATE public.loans SET
  payment_dates = '["2026-07-28"]'::jsonb,
  payment_amounts = '[1414.51]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L658';

UPDATE public.loans SET
  payment_dates = '["2026-08-07"]'::jsonb,
  payment_amounts = '[36657.5]'::jsonb,
  paid_count = 1,
  total_installments = 1
WHERE ref = 'L661';

UPDATE public.loans SET
  payment_dates = '["2026-08-10", "2026-08-17"]'::jsonb,
  payment_amounts = '[10843.42, 5421.71]'::jsonb,
  paid_count = GREATEST(paid_count, 2)
WHERE ref = 'L662';

UPDATE public.loans SET
  payment_dates = '["2026-08-06", "2026-08-14", "2026-08-19"]'::jsonb,
  payment_amounts = '[2000.0, 2000.0, 2000.0]'::jsonb,
  paid_count = GREATEST(paid_count, 3)
WHERE ref = 'L664';

UPDATE public.loans SET
  payment_dates = '["2026-08-18"]'::jsonb,
  payment_amounts = '[2500.0]'::jsonb,
  paid_count = GREATEST(paid_count, 1)
WHERE ref = 'L665';

-- L670 skipped: Deduction Dates length exceeded schedule; keep flat installment.
COMMIT;
