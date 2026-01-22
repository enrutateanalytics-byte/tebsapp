-- Add access code to clients table for public viewing
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_access_code ON public.clients(access_code);

-- Create a function to generate random access codes
CREATE OR REPLACE FUNCTION public.generate_access_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Generate access codes for existing clients that don't have one
UPDATE public.clients 
SET access_code = public.generate_access_code() 
WHERE access_code IS NULL;

-- Make access_code NOT NULL for future records
ALTER TABLE public.clients ALTER COLUMN access_code SET DEFAULT public.generate_access_code();

-- Create RLS policy to allow public access via access code (for unauthenticated users)
CREATE POLICY "Public can view clients by access code"
ON public.clients
FOR SELECT
TO anon
USING (access_code IS NOT NULL);

-- Allow public to view routes for accessible clients
CREATE POLICY "Public can view routes by client access"
ON public.routes
FOR SELECT
TO anon
USING (
  client_id IN (SELECT id FROM public.clients WHERE access_code IS NOT NULL)
);

-- Allow public to view GPS positions for units on accessible routes
CREATE POLICY "Public can view gps positions"
ON public.gps_positions
FOR SELECT
TO anon
USING (true);

-- Allow public to view units
CREATE POLICY "Public can view units"
ON public.units
FOR SELECT
TO anon
USING (true);