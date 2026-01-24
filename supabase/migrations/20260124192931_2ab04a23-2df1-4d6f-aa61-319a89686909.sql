-- Create table for caching API tokens and rate limit state
CREATE TABLE public.api_rate_limit_state (
  id text DEFAULT 'tracksolid' PRIMARY KEY,
  cached_token text,
  token_expires_at timestamptz,
  cached_locations jsonb,
  locations_expires_at timestamptz,
  daily_call_count integer DEFAULT 0 NOT NULL,
  daily_reset_at timestamptz DEFAULT (now() + interval '24 hours') NOT NULL,
  is_blocked boolean DEFAULT false NOT NULL,
  blocked_until timestamptz,
  consecutive_failures integer DEFAULT 0 NOT NULL,
  last_success_at timestamptz,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- IMPORTANT: Block public access (sensitive tokens)
ALTER TABLE api_rate_limit_state ENABLE ROW LEVEL SECURITY;

-- Deny all public access - only service role can access
CREATE POLICY "Deny all public access" ON api_rate_limit_state
  FOR ALL USING (false) WITH CHECK (false);

-- Insert initial state row
INSERT INTO api_rate_limit_state (id) VALUES ('tracksolid');