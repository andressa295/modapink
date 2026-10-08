-- Complementos ja existentes no codigo da API, ausentes no catalogo de producao.
-- Origem: whatsapp-api cbcc7202b77d8f5825ab610e13a5e222b6aeef2a.
CREATE TABLE public.sac_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol text NOT NULL UNIQUE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  phone text NOT NULL,
  session_key text NOT NULL DEFAULT 'sac',
  category text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  order_number text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX sac_cases_opened_at_idx ON public.sac_cases (opened_at DESC);
CREATE INDEX sac_cases_category_opened_at_idx ON public.sac_cases (category, opened_at DESC);
CREATE INDEX sac_cases_status_opened_at_idx ON public.sac_cases (status, opened_at DESC);
CREATE INDEX sac_cases_order_number_idx ON public.sac_cases (order_number) WHERE order_number IS NOT NULL;

CREATE TABLE public.meta_whatsapp_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'processing',
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX meta_whatsapp_events_created_at_idx ON public.meta_whatsapp_events (created_at DESC);
COMMENT ON TABLE public.meta_whatsapp_events IS
  'Idempotencia e auditoria dos webhooks oficiais da WhatsApp Cloud API.';

-- Helpers de policies fora do schema exposto como RPC; profiles e a fonte de permissoes.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.dashboard_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;
CREATE OR REPLACE FUNCTION private.dashboard_has_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'agent', 'user'));
$$;
REVOKE ALL ON FUNCTION private.dashboard_is_admin(), private.dashboard_has_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.dashboard_is_admin(), private.dashboard_has_access() TO authenticated, service_role;

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'agent';
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'agent', 'user'));

-- Reconstruir o acesso do Core sem herdar policies publicas ou recursivas da origem.
DO $$
DECLARE p record; t record;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

CREATE POLICY core_profiles_read ON public.profiles FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) OR (SELECT private.dashboard_is_admin()));
CREATE POLICY core_profiles_admin ON public.profiles FOR ALL TO authenticated
USING ((SELECT private.dashboard_is_admin())) WITH CHECK ((SELECT private.dashboard_is_admin()));
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

DO $$
DECLARE table_name text;
BEGIN
  -- O chat e compartilhado entre os numeros da mesma loja. Cada loja usa outro projeto.
  FOREACH table_name IN ARRAY ARRAY[
    'conversations', 'messages', 'customers', 'customer_memories',
    'conversation_topics', 'conversation_learning_events', 'whatsapp_sessions'
  ] LOOP
    EXECUTE format('CREATE POLICY core_chat_read ON public.%I FOR SELECT TO authenticated USING ((SELECT private.dashboard_has_access()))', table_name);
  END LOOP;

  -- Configuracoes, integracoes e operacao comercial sao de administradores.
  FOREACH table_name IN ARRAY ARRAY[
    'abandoned_cart_messages', 'abandoned_carts', 'agents', 'automation_logs',
    'automations', 'broadcast_campaigns', 'broadcast_recipients', 'broadcast_suppressions',
    'conversation_assignments', 'conversation_reviews', 'events', 'order_status_messages',
    'orders', 'products', 'ratings', 'settings', 'store_settings', 'stores',
    'whatsapp_sessions', 'sac_cases'
  ] LOOP
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
    EXECUTE format('CREATE POLICY core_admin_access ON public.%I FOR ALL TO authenticated USING ((SELECT private.dashboard_is_admin())) WITH CHECK ((SELECT private.dashboard_is_admin()))', table_name);
  END LOOP;
END $$;

-- Tabela auxiliar e ledger de webhooks ficam exclusivamente no servidor.
REVOKE ALL ON public.abandoned_carts_demo_backup, public.meta_whatsapp_events FROM anon, authenticated;
ALTER VIEW public.conversation_review_stats SET (security_invoker = true);
ALTER FUNCTION public.increment_automation_usage(uuid) SET search_path = public;
ALTER FUNCTION public.get_sales_funnel_total() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.increment_automation_usage(uuid), public.get_sales_funnel_total(), public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_automation_usage(uuid), public.get_sales_funnel_total() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;

-- Novos objetos de aplicacao precisam de grants explicitos. Nao alterar roles da plataforma.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMENT ON TABLE public.customer_memories IS
  'Memoria da cliente compartilhada entre numeros e sessoes da mesma loja.';
