-- Drop problematic policies that cause recursion
DROP POLICY IF EXISTS "Drivers can view routes assigned to their unit" ON public.routes;
DROP POLICY IF EXISTS "Drivers can view assignments for their unit" ON public.assignments;
DROP POLICY IF EXISTS "Drivers can update assignments for their unit" ON public.assignments;

-- Create a security definer function to get routes for driver's unit without recursion
CREATE OR REPLACE FUNCTION public.get_driver_route_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT a.route_id), ARRAY[]::uuid[])
  FROM assignments a
  WHERE a.unit_id = (
    SELECT unit_id FROM drivers WHERE user_id = auth.uid() AND is_active = true LIMIT 1
  )
$$;

-- Create a security definer function to check if driver has access to a specific assignment
CREATE OR REPLACE FUNCTION public.driver_can_access_assignment(assignment_unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assignment_unit_id = (
    SELECT unit_id FROM drivers WHERE user_id = auth.uid() AND is_active = true LIMIT 1
  )
$$;

-- Recreate the driver policy for routes using the security definer function
CREATE POLICY "Drivers can view routes assigned to their unit"
ON public.routes
FOR SELECT
USING (is_driver() AND id = ANY(get_driver_route_ids()));

-- Recreate the driver policy for assignments using the security definer function
CREATE POLICY "Drivers can view assignments for their unit"
ON public.assignments
FOR SELECT
USING (is_driver() AND driver_can_access_assignment(unit_id));

-- Recreate the driver update policy for assignments
CREATE POLICY "Drivers can update assignments for their unit"
ON public.assignments
FOR UPDATE
USING (is_driver() AND driver_can_access_assignment(unit_id));

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';