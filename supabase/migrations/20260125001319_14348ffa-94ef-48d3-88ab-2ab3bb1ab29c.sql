-- Allow client users to read assignments for routes that belong to their client
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client users can view assignments for their client routes" ON public.assignments;
CREATE POLICY "Client users can view assignments for their client routes"
ON public.assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.routes r
    WHERE r.id = assignments.route_id
      AND r.client_id = public.get_user_client_id()
  )
);

-- (Optional but safe) Ensure client users can also read route records for their client
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

-- Note: we don't change existing public policies here; only ensure authenticated client users work.
DROP POLICY IF EXISTS "Client users can view their client routes" ON public.routes;
CREATE POLICY "Client users can view their client routes"
ON public.routes
FOR SELECT
USING (client_id = public.get_user_client_id());
