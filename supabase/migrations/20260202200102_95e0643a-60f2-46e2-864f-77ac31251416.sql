-- Allow drivers to view clients associated with their assigned routes
CREATE POLICY "Drivers can view clients of their routes"
ON public.clients
FOR SELECT
USING (
  is_driver() AND id IN (
    SELECT r.client_id FROM routes r
    WHERE r.id = ANY(get_driver_route_ids())
  )
);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';