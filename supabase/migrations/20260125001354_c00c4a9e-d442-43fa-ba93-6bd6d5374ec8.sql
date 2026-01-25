-- Update policy to allow client users to view GPS positions for units assigned to their routes
-- This joins through assignments to check if the unit is on a route the client owns

DROP POLICY IF EXISTS "Client users can view gps positions for their routes" ON public.gps_positions;

CREATE POLICY "Client users can view gps positions for their routes"
ON public.gps_positions
FOR SELECT
USING (
  unit_id IN (
    SELECT a.unit_id
    FROM assignments a
    JOIN routes r ON a.route_id = r.id
    WHERE r.client_id = public.get_user_client_id()
      AND a.status = 'in_progress'
  )
);