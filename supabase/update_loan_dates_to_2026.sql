-- Shift loan dates from 2025 to 2026. Run in Supabase SQL Editor.

-- 1. start_date: add 1 year where year is 2025
UPDATE public.loans
SET start_date = start_date + interval '1 year'
WHERE EXTRACT(YEAR FROM start_date) = 2025;

-- 2. payment_dates: add 1 year to each date in the JSONB array
UPDATE public.loans
SET payment_dates = (
  SELECT COALESCE(
    (
      SELECT jsonb_agg(
        to_char((elem::text)::date + interval '1 year', 'YYYY-MM-DD')::jsonb
      )
      FROM jsonb_array_elements_text(payment_dates) AS elem
    ),
    '[]'::jsonb
  )
)
WHERE payment_dates IS NOT NULL
  AND jsonb_array_length(payment_dates) > 0;
