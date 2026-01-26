-- Remove the public SELECT policy that exposes client contact information
DROP POLICY IF EXISTS "Public can view clients by access code" ON public.clients;

-- Client users should be able to view their own client record
CREATE POLICY "Client users can view their own client"
ON public.clients
FOR SELECT
USING (id = get_user_client_id());