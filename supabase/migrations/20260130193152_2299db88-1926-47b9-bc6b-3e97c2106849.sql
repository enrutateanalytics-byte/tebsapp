-- Drop existing restrictive policy for supervisors on units
DROP POLICY IF EXISTS "Supervisors can view units of assigned clients" ON public.units;

-- Create new policy: Supervisors can view ALL units (for assignment purposes)
CREATE POLICY "Supervisors can view all units"
ON public.units
FOR SELECT
USING (is_supervisor());