-- Drop existing policy and recreate with proper restrictions
DROP POLICY IF EXISTS "Administrators can view all admins" ON public.administrators;

-- Create restrictive policy for administrators only (PERMISSIVE for authenticated admins)
CREATE POLICY "Only administrators can view admins"
ON public.administrators
FOR SELECT
TO authenticated
USING (is_administrator());

-- Explicit deny for anon role (public access)
CREATE POLICY "Deny public access to administrators"
ON public.administrators
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Deny INSERT/UPDATE/DELETE for all (including authenticated non-admins)
CREATE POLICY "Only service role can modify administrators"
ON public.administrators
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);