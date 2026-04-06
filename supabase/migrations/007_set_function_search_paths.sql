-- Security Advisor: make function lookup deterministic.
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.increment_click(UUID) SET search_path = public;
ALTER FUNCTION public.get_filter_options() SET search_path = public;
ALTER FUNCTION public.search_coffees(TEXT) SET search_path = public;
