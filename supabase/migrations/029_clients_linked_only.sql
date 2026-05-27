-- Clients visibility should follow linked_owner_ids() only.
-- This removes global client pooling across all provisioned companies.

DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients FOR SELECT
  USING (
    owner_id IN (SELECT public.linked_owner_ids())
    OR owner_id IS NULL
  );
