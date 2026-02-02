-- Allow client users to create their own QR codes
CREATE POLICY "Client users can create their own QR codes"
ON public.passenger_qr_codes
FOR INSERT
WITH CHECK (
  is_client_user() AND client_id = get_user_client_id()
);

-- Allow client users to view their own QR codes
CREATE POLICY "Client users can view their own QR codes"
ON public.passenger_qr_codes
FOR SELECT
USING (
  is_client_user() AND client_id = get_user_client_id()
);

-- Add location fields to passenger_boardings for GPS tracking
ALTER TABLE public.passenger_boardings
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric,
ADD COLUMN IF NOT EXISTS location_name text;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';