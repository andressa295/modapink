-- Configuracao de buckets conferida no banco real; nao copia arquivos/objetos.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('whatsapp-media', 'whatsapp-media', true, 25000000, NULL),
  ('broadcast-media', 'broadcast-media', true, 20971520,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Buckets publicos mantidos como na origem. Escritas de campanha sao de admins.
DROP POLICY IF EXISTS broadcast_media_authenticated_select ON storage.objects;
DROP POLICY IF EXISTS broadcast_media_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS broadcast_media_authenticated_delete ON storage.objects;
CREATE POLICY broadcast_media_authenticated_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'broadcast-media' AND (SELECT private.dashboard_is_admin()));
CREATE POLICY broadcast_media_authenticated_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'broadcast-media' AND (SELECT private.dashboard_is_admin()));
CREATE POLICY broadcast_media_authenticated_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'broadcast-media' AND (SELECT private.dashboard_is_admin()));

-- Somente vinculo da tabela public.messages; nao modifica o schema interno realtime.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
