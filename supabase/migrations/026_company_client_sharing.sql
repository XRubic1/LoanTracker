-- Tie provisioned companies to owner_company_groups for shared worksheet clients.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS client_share_group_id BIGINT
  REFERENCES public.owner_company_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_companies_client_share_group
  ON public.companies (client_share_group_id)
  WHERE client_share_group_id IS NOT NULL;
