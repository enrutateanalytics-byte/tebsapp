-- Add username column to client_users table
ALTER TABLE public.client_users 
ADD COLUMN username text;

-- Create unique index on username
CREATE UNIQUE INDEX idx_client_users_username ON public.client_users(username) WHERE username IS NOT NULL;

-- Update existing users to have a username based on their name (slugified)
UPDATE public.client_users 
SET username = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g'), '(.)', '\1', 'g')) || '_' || SUBSTRING(id::text, 1, 4)
WHERE username IS NULL;