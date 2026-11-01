-- Supabase platform helper exists on this hosted project. Preserve event trigger behavior, revoke browser/API execution.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
