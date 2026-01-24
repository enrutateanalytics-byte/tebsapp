-- Create table for client users (users who access the public app)
CREATE TABLE public.client_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(email)
);

-- Enable RLS
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_client_users_updated_at
  BEFORE UPDATE ON public.client_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if current user is a client user
CREATE OR REPLACE FUNCTION public.is_client_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.client_users
    WHERE user_id = auth.uid() AND is_active = true
  );
END;
$$;

-- Function to get the client_id of the current user
CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT client_id FROM public.client_users
    WHERE user_id = auth.uid() AND is_active = true
    LIMIT 1
  );
END;
$$;

-- RLS Policies for client_users table
-- Administrators can do everything
CREATE POLICY "Administrators can view all client users"
ON public.client_users FOR SELECT
USING (public.is_administrator());

CREATE POLICY "Administrators can create client users"
ON public.client_users FOR INSERT
WITH CHECK (public.is_administrator());

CREATE POLICY "Administrators can update client users"
ON public.client_users FOR UPDATE
USING (public.is_administrator());

CREATE POLICY "Administrators can delete client users"
ON public.client_users FOR DELETE
USING (public.is_administrator());

-- Client users can view their own record
CREATE POLICY "Client users can view own record"
ON public.client_users FOR SELECT
USING (user_id = auth.uid());

-- Update routes policy: client users can view routes of their client
CREATE POLICY "Client users can view their routes"
ON public.routes FOR SELECT
USING (client_id = public.get_user_client_id());

-- Update gps_positions policy: client users can view positions for their client's routes
CREATE POLICY "Client users can view gps positions for their routes"
ON public.gps_positions FOR SELECT
USING (
  assignment_id IN (
    SELECT a.id FROM public.assignments a
    JOIN public.routes r ON a.route_id = r.id
    WHERE r.client_id = public.get_user_client_id()
  )
);

-- Client users can view units assigned to their routes
CREATE POLICY "Client users can view assigned units"
ON public.units FOR SELECT
USING (
  id IN (
    SELECT a.unit_id FROM public.assignments a
    JOIN public.routes r ON a.route_id = r.id
    WHERE r.client_id = public.get_user_client_id()
  )
);

-- Client users can view assignments for their routes
CREATE POLICY "Client users can view their assignments"
ON public.assignments FOR SELECT
USING (
  route_id IN (
    SELECT id FROM public.routes
    WHERE client_id = public.get_user_client_id()
  )
);