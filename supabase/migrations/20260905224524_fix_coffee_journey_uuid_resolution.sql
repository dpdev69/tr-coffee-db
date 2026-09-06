-- Supabase installs uuid-ossp in extensions. The journey trigger fixed its
-- search_path to public, so every scraper INSERT/UPDATE failed when resolving
-- uuid_ns_url() and uuid_generate_v5(). Keep the path explicit, including the
-- extension schema, without changing the function's invoker permissions.
ALTER FUNCTION public.sync_coffee_journey()
  SET search_path = public, extensions, pg_temp;
