-- Add IMEI column to units table for Tracksolid GPS device linking
ALTER TABLE public.units
ADD COLUMN imei TEXT UNIQUE;

COMMENT ON COLUMN public.units.imei IS 'IMEI del dispositivo GPS Tracksolid';

-- Create index for faster lookups by IMEI
CREATE INDEX idx_units_imei ON public.units(imei) WHERE imei IS NOT NULL;