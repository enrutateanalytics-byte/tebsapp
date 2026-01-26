-- Add stops column to routes table to store parsed KML stops/placemarks
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS stops jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.routes.stops IS 'JSON array of stops from KML file with name, lat, lng';