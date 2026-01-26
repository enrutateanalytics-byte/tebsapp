-- Fix routes table RLS policies - remove public access
-- Drop the problematic public access policy
DROP POLICY IF EXISTS "Public can view routes by client access" ON public.routes;

-- Drop duplicate client user policies and recreate as single PERMISSIVE policy
DROP POLICY IF EXISTS "Client users can view their routes" ON public.routes;
DROP POLICY IF EXISTS "Client users can view their client routes" ON public.routes;

-- Drop existing admin policies to recreate as PERMISSIVE
DROP POLICY IF EXISTS "Administrators can view all routes" ON public.routes;

-- Create PERMISSIVE policies requiring authentication
-- Administrators can view all routes
CREATE POLICY "Administrators can view all routes"
ON public.routes
FOR SELECT
TO authenticated
USING (is_administrator());

-- Client users can only view routes for their client
CREATE POLICY "Client users can view their client routes"
ON public.routes
FOR SELECT
TO authenticated
USING (client_id = get_user_client_id());