-- Drop the old driver route policy
DROP POLICY IF EXISTS "Drivers can view routes assigned to their unit" ON public.routes;

-- Create a function to get route IDs assigned to a driver (by driver_id OR unit_id)
CREATE OR REPLACE FUNCTION public.get_driver_route_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT a.route_id), ARRAY[]::uuid[])
  FROM assignments a
  WHERE a.driver_id = (
    SELECT id FROM drivers WHERE user_id = auth.uid() AND is_active = true LIMIT 1
  )
  OR a.unit_id = (
    SELECT unit_id FROM drivers WHERE user_id = auth.uid() AND is_active = true LIMIT 1
  )
$$;

-- Recreate the driver policy for routes
CREATE POLICY "Drivers can view routes assigned to them"
ON public.routes
FOR SELECT
USING (is_driver() AND id = ANY(get_driver_route_ids()));

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';