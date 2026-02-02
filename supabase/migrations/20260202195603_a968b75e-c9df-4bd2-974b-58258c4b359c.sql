-- Drop the old driver policy for viewing assignments
DROP POLICY IF EXISTS "Drivers can view assignments for their unit" ON public.assignments;

-- Create a new policy that allows drivers to view assignments either by driver_id OR by unit_id
CREATE POLICY "Drivers can view their assignments"
ON public.assignments
FOR SELECT
USING (
  is_driver() AND (
    driver_id = get_driver_id() 
    OR driver_can_access_assignment(unit_id)
  )
);

-- Also update the update policy
DROP POLICY IF EXISTS "Drivers can update assignments for their unit" ON public.assignments;

CREATE POLICY "Drivers can update their assignments"
ON public.assignments
FOR UPDATE
USING (
  is_driver() AND (
    driver_id = get_driver_id() 
    OR driver_can_access_assignment(unit_id)
  )
);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';