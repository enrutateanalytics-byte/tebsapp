-- Remove the public SELECT policy that exposes vehicle and driver information
DROP POLICY IF EXISTS "Public can view units" ON public.units;