-- Fix administrators table RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Only administrators can view admins" ON public.administrators;
DROP POLICY IF EXISTS "Deny public access to administrators" ON public.administrators;
DROP POLICY IF EXISTS "Only service role can modify administrators" ON public.administrators;

-- Create PERMISSIVE policy for authenticated administrators only
-- This explicitly requires authentication AND administrator role
CREATE POLICY "Authenticated administrators can view admin emails"
ON public.administrators
FOR SELECT
TO authenticated
USING (is_administrator());

-- No policy for 'anon' role means anonymous users have NO access by default
-- No policy for INSERT/UPDATE/DELETE means only service_role can modify (via supabase-admin)