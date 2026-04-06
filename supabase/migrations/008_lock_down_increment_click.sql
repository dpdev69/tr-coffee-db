-- Restrict increment_click to server-side callers.
-- The public API route now uses the service role key instead of exposing RPC execute to anon.

REVOKE EXECUTE ON FUNCTION increment_click(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION increment_click(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION increment_click(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION increment_click(UUID) TO service_role;
