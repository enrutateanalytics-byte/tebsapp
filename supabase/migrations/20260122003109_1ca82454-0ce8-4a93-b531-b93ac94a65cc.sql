-- Create administrators table to track admin users
CREATE TABLE public.administrators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on administrators
ALTER TABLE public.administrators ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is administrator
CREATE OR REPLACE FUNCTION public.is_administrator()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.administrators
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create routes table
CREATE TABLE public.routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  kml_file_path TEXT,
  origin_address TEXT,
  destination_address TEXT,
  estimated_duration_minutes INTEGER,
  distance_km DECIMAL(10, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on routes
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

-- Create units table
CREATE TABLE public.units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plate_number TEXT NOT NULL UNIQUE,
  model TEXT,
  brand TEXT,
  year INTEGER,
  capacity INTEGER NOT NULL DEFAULT 40,
  driver_name TEXT,
  driver_phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on units
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Create assignments table
CREATE TABLE public.assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  assignment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME,
  end_time TIME,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on assignments
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Create gps_positions table for real-time tracking
CREATE TABLE public.gps_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  speed DECIMAL(6, 2),
  heading DECIMAL(5, 2),
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on gps_positions
ALTER TABLE public.gps_positions ENABLE ROW LEVEL SECURITY;

-- Create index for efficient GPS queries
CREATE INDEX idx_gps_positions_unit_id ON public.gps_positions(unit_id);
CREATE INDEX idx_gps_positions_recorded_at ON public.gps_positions(recorded_at DESC);

-- RLS Policies for administrators table
CREATE POLICY "Administrators can view all admins"
ON public.administrators FOR SELECT
USING (is_administrator());

-- RLS Policies for clients
CREATE POLICY "Administrators can view all clients"
ON public.clients FOR SELECT
USING (is_administrator());

CREATE POLICY "Administrators can create clients"
ON public.clients FOR INSERT
WITH CHECK (is_administrator());

CREATE POLICY "Administrators can update clients"
ON public.clients FOR UPDATE
USING (is_administrator());

CREATE POLICY "Administrators can delete clients"
ON public.clients FOR DELETE
USING (is_administrator());

-- RLS Policies for routes
CREATE POLICY "Administrators can view all routes"
ON public.routes FOR SELECT
USING (is_administrator());

CREATE POLICY "Administrators can create routes"
ON public.routes FOR INSERT
WITH CHECK (is_administrator());

CREATE POLICY "Administrators can update routes"
ON public.routes FOR UPDATE
USING (is_administrator());

CREATE POLICY "Administrators can delete routes"
ON public.routes FOR DELETE
USING (is_administrator());

-- RLS Policies for units
CREATE POLICY "Administrators can view all units"
ON public.units FOR SELECT
USING (is_administrator());

CREATE POLICY "Administrators can create units"
ON public.units FOR INSERT
WITH CHECK (is_administrator());

CREATE POLICY "Administrators can update units"
ON public.units FOR UPDATE
USING (is_administrator());

CREATE POLICY "Administrators can delete units"
ON public.units FOR DELETE
USING (is_administrator());

-- RLS Policies for assignments
CREATE POLICY "Administrators can view all assignments"
ON public.assignments FOR SELECT
USING (is_administrator());

CREATE POLICY "Administrators can create assignments"
ON public.assignments FOR INSERT
WITH CHECK (is_administrator());

CREATE POLICY "Administrators can update assignments"
ON public.assignments FOR UPDATE
USING (is_administrator());

CREATE POLICY "Administrators can delete assignments"
ON public.assignments FOR DELETE
USING (is_administrator());

-- RLS Policies for gps_positions
CREATE POLICY "Administrators can view all gps positions"
ON public.gps_positions FOR SELECT
USING (is_administrator());

CREATE POLICY "Administrators can insert gps positions"
ON public.gps_positions FOR INSERT
WITH CHECK (is_administrator());

-- Create storage bucket for KML files
INSERT INTO storage.buckets (id, name, public) VALUES ('kml-files', 'kml-files', false);

-- Storage policies for KML files
CREATE POLICY "Administrators can view KML files"
ON storage.objects FOR SELECT
USING (bucket_id = 'kml-files' AND public.is_administrator());

CREATE POLICY "Administrators can upload KML files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kml-files' AND public.is_administrator());

CREATE POLICY "Administrators can delete KML files"
ON storage.objects FOR DELETE
USING (bucket_id = 'kml-files' AND public.is_administrator());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_routes_updated_at
BEFORE UPDATE ON public.routes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_units_updated_at
BEFORE UPDATE ON public.units
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at
BEFORE UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();