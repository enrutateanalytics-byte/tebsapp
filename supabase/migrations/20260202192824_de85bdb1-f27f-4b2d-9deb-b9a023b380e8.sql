-- =============================================
-- DRIVER APP MIGRATION
-- =============================================

-- 1. Create drivers table
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text,
  email text NOT NULL,
  unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on drivers
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- 2. Modify assignments table for trip control
ALTER TABLE public.assignments
  ADD COLUMN driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN actual_start_time timestamptz,
  ADD COLUMN actual_end_time timestamptz,
  ADD COLUMN started_by_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL;

-- 3. Create passenger_qr_codes table
CREATE TABLE public.passenger_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  employee_name text NOT NULL,
  employee_id text,
  qr_code text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  allowed_route_ids uuid[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on passenger_qr_codes
ALTER TABLE public.passenger_qr_codes ENABLE ROW LEVEL SECURITY;

-- 4. Create passenger_boardings table
CREATE TABLE public.passenger_boardings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES assignments(id) ON DELETE CASCADE NOT NULL,
  passenger_qr_id uuid REFERENCES passenger_qr_codes(id) ON DELETE SET NULL,
  qr_code_scanned text NOT NULL,
  route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  boarded_at timestamptz DEFAULT now() NOT NULL,
  is_valid boolean DEFAULT false,
  validation_message text
);

-- Enable RLS on passenger_boardings
ALTER TABLE public.passenger_boardings ENABLE ROW LEVEL SECURITY;

-- 5. Create is_driver function
CREATE OR REPLACE FUNCTION public.is_driver()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.drivers
    WHERE user_id = auth.uid() AND is_active = true
  );
END;
$$;

-- 6. Create function to get driver's unit_id
CREATE OR REPLACE FUNCTION public.get_driver_unit_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT unit_id FROM public.drivers
    WHERE user_id = auth.uid() AND is_active = true
    LIMIT 1
  );
END;
$$;

-- 7. Create function to get driver id
CREATE OR REPLACE FUNCTION public.get_driver_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT id FROM public.drivers
    WHERE user_id = auth.uid() AND is_active = true
    LIMIT 1
  );
END;
$$;

-- =============================================
-- RLS POLICIES FOR DRIVERS TABLE
-- =============================================

-- Administrators can do everything
CREATE POLICY "Administrators can view all drivers"
ON public.drivers FOR SELECT
USING (is_administrator());

CREATE POLICY "Administrators can create drivers"
ON public.drivers FOR INSERT
WITH CHECK (is_administrator());

CREATE POLICY "Administrators can update drivers"
ON public.drivers FOR UPDATE
USING (is_administrator());

CREATE POLICY "Administrators can delete drivers"
ON public.drivers FOR DELETE
USING (is_administrator());

-- Drivers can view their own record
CREATE POLICY "Drivers can view own record"
ON public.drivers FOR SELECT
USING (user_id = auth.uid());

-- =============================================
-- RLS POLICIES FOR PASSENGER_QR_CODES TABLE
-- =============================================

-- Administrators can do everything
CREATE POLICY "Administrators can view all passenger_qr_codes"
ON public.passenger_qr_codes FOR SELECT
USING (is_administrator());

CREATE POLICY "Administrators can create passenger_qr_codes"
ON public.passenger_qr_codes FOR INSERT
WITH CHECK (is_administrator());

CREATE POLICY "Administrators can update passenger_qr_codes"
ON public.passenger_qr_codes FOR UPDATE
USING (is_administrator());

CREATE POLICY "Administrators can delete passenger_qr_codes"
ON public.passenger_qr_codes FOR DELETE
USING (is_administrator());

-- Supervisors can manage passenger_qr_codes for assigned clients
CREATE POLICY "Supervisors can view passenger_qr_codes of assigned clients"
ON public.passenger_qr_codes FOR SELECT
USING (is_supervisor() AND client_id = ANY(get_supervisor_client_ids()));

CREATE POLICY "Supervisors can create passenger_qr_codes for assigned clients"
ON public.passenger_qr_codes FOR INSERT
WITH CHECK (is_supervisor() AND client_id = ANY(get_supervisor_client_ids()));

CREATE POLICY "Supervisors can update passenger_qr_codes of assigned clients"
ON public.passenger_qr_codes FOR UPDATE
USING (is_supervisor() AND client_id = ANY(get_supervisor_client_ids()));

-- Drivers can view QR codes for routes they are assigned to
CREATE POLICY "Drivers can view passenger_qr_codes for their routes"
ON public.passenger_qr_codes FOR SELECT
USING (
  is_driver() AND (
    -- QR code is allowed for a route assigned to driver's unit
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.unit_id = get_driver_unit_id()
        AND a.route_id = ANY(allowed_route_ids)
    )
  )
);

-- =============================================
-- RLS POLICIES FOR PASSENGER_BOARDINGS TABLE
-- =============================================

-- Administrators can view all boardings
CREATE POLICY "Administrators can view all passenger_boardings"
ON public.passenger_boardings FOR SELECT
USING (is_administrator());

-- Administrators can insert boardings
CREATE POLICY "Administrators can create passenger_boardings"
ON public.passenger_boardings FOR INSERT
WITH CHECK (is_administrator());

-- Supervisors can view boardings for their clients
CREATE POLICY "Supervisors can view passenger_boardings of assigned clients"
ON public.passenger_boardings FOR SELECT
USING (
  is_supervisor() AND (
    route_id IN (
      SELECT id FROM routes WHERE client_id = ANY(get_supervisor_client_ids())
    )
  )
);

-- Drivers can view their own boardings
CREATE POLICY "Drivers can view their own boardings"
ON public.passenger_boardings FOR SELECT
USING (is_driver() AND driver_id = get_driver_id());

-- Drivers can insert boardings for assignments they started
CREATE POLICY "Drivers can create boardings for their active trips"
ON public.passenger_boardings FOR INSERT
WITH CHECK (
  is_driver() AND (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_id
        AND a.started_by_driver_id = get_driver_id()
        AND a.actual_end_time IS NULL
    )
  )
);

-- =============================================
-- ADDITIONAL RLS POLICIES FOR ASSIGNMENTS (for drivers)
-- =============================================

-- Drivers can view assignments for their unit
CREATE POLICY "Drivers can view assignments for their unit"
ON public.assignments FOR SELECT
USING (is_driver() AND unit_id = get_driver_unit_id());

-- Drivers can update assignments for their unit (start/end trip)
CREATE POLICY "Drivers can update assignments for their unit"
ON public.assignments FOR UPDATE
USING (is_driver() AND unit_id = get_driver_unit_id());

-- =============================================
-- ADDITIONAL RLS POLICIES FOR ROUTES (for drivers)
-- =============================================

-- Drivers can view routes assigned to their unit
CREATE POLICY "Drivers can view routes assigned to their unit"
ON public.routes FOR SELECT
USING (
  is_driver() AND (
    id IN (
      SELECT route_id FROM assignments WHERE unit_id = get_driver_unit_id()
    )
  )
);

-- =============================================
-- ADDITIONAL RLS POLICIES FOR UNITS (for drivers)
-- =============================================

-- Drivers can view their assigned unit
CREATE POLICY "Drivers can view their assigned unit"
ON public.units FOR SELECT
USING (is_driver() AND id = get_driver_unit_id());

-- =============================================
-- ADDITIONAL RLS POLICIES FOR CLIENTS (for drivers)
-- =============================================

-- Drivers can view clients for routes assigned to their unit
CREATE POLICY "Drivers can view clients for their routes"
ON public.clients FOR SELECT
USING (
  is_driver() AND (
    id IN (
      SELECT r.client_id FROM routes r
      JOIN assignments a ON a.route_id = r.id
      WHERE a.unit_id = get_driver_unit_id()
    )
  )
);

-- =============================================
-- TRIGGER FOR updated_at on new tables
-- =============================================

CREATE TRIGGER update_drivers_updated_at
BEFORE UPDATE ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_passenger_qr_codes_updated_at
BEFORE UPDATE ON public.passenger_qr_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();