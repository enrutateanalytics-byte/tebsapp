-- Drop the existing policy that checks for 'in_progress' status
DROP POLICY IF EXISTS "Client users can view gps positions for their routes" ON public.gps_positions;

-- Create new policy that shows GPS positions for any unit assigned to client routes (no status check)
CREATE POLICY "Client users can view gps positions for their routes"
ON public.gps_positions
FOR SELECT
USING (
  unit_id IN (
    SELECT a.unit_id
    FROM assignments a
    JOIN routes r ON a.route_id = r.id
    WHERE r.client_id = public.get_user_client_id()
  )
);