-- Remove the public SELECT policy that exposes GPS tracking data
DROP POLICY IF EXISTS "Public can view gps positions" ON public.gps_positions;