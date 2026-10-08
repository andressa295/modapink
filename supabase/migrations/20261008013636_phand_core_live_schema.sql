-- Phand Core: estrutura consultada na Moda Pink em 2026-10-08T01:27:53.360891+00:00

-- Somente estrutura; nenhuma linha de clientes, contas, pedidos ou mensagens.

-- Aplicar TODAS as migrations deste diretorio somente em Supabase NOVO E VAZIO.

-- As permissoes capturadas abaixo sao ajustadas pela migration runtime_and_access.

SET search_path = public, extensions, pg_catalog;

DO $guard$ BEGIN

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace

    WHERE n.nspname='public' AND c.relkind IN ('r','p','m','f')) THEN

    RAISE EXCEPTION 'Baseline exclusiva para projeto novo e vazio; nao aplicar na Moda Pink ou em banco com tabelas.';

  END IF;

END $guard$;

CREATE SCHEMA IF NOT EXISTS public;

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- pg_graphql, pg_stat_statements, plpgsql e vault sao gerenciados pelo Supabase.

CREATE TABLE public."abandoned_cart_messages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "store_id" text,
  "checkout_id" text NOT NULL,
  "phone" text NOT NULL,
  "customer_name" text,
  "checkout_url" text,
  "total" numeric,
  "session_key" text DEFAULT 'principal'::text,
  "message_sent_at" timestamp with time zone,
  "status" text DEFAULT 'sent'::text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."abandoned_carts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid,
  "order_id" text,
  "order_number" text,
  "customer_name" text,
  "customer_phone" text,
  "total" numeric,
  "recovered" boolean DEFAULT false,
  "whatsapp_sent" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "checkout_url" text,
  "whatsapp_sent_at" timestamp with time zone,
  "recovered_at" timestamp with time zone
);

CREATE TABLE public."abandoned_carts_demo_backup" (
  "id" uuid,
  "store_id" uuid,
  "order_id" text,
  "order_number" text,
  "customer_name" text,
  "customer_phone" text,
  "total" numeric,
  "recovered" boolean,
  "whatsapp_sent" boolean,
  "created_at" timestamp with time zone,
  "checkout_url" text,
  "whatsapp_sent_at" timestamp with time zone,
  "recovered_at" timestamp with time zone
);

CREATE TABLE public."agents" (
  "id" uuid NOT NULL,
  "name" text,
  "active" boolean DEFAULT true,
  "created_at" timestamp without time zone DEFAULT now(),
  "email" text,
  "phone" text,
  "avatar_url" text,
  "sector" text,
  "is_online" boolean DEFAULT false,
  "current_chats" integer DEFAULT 0,
  "max_chats" integer DEFAULT 5
);

CREATE TABLE public."automation_logs" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "automation_id" uuid,
  "conversation_id" uuid,
  "executed_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."automations" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "name" text,
  "trigger" text,
  "response" text,
  "created_at" timestamp without time zone DEFAULT now(),
  "flow" jsonb,
  "uses" integer DEFAULT 0
);

CREATE TABLE public."broadcast_campaigns" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "message" text NOT NULL,
  "session_key" text DEFAULT 'principal'::text NOT NULL,
  "audience" text DEFAULT 'previous_contacts'::text NOT NULL,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "total_count" integer DEFAULT 0 NOT NULL,
  "sent_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "skipped_count" integer DEFAULT 0 NOT NULL,
  "scheduled_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "paused_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "last_error" text,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "media_url" text,
  "media_type" text,
  "media_filename" text
);

CREATE TABLE public."broadcast_recipients" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL,
  "phone" text NOT NULL,
  "phone_key" text NOT NULL,
  "conversation_id" uuid,
  "customer_name" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."broadcast_suppressions" (
  "phone_key" text NOT NULL,
  "phone" text,
  "reason" text DEFAULT 'customer_opt_out'::text NOT NULL,
  "source" text DEFAULT 'whatsapp'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."conversation_assignments" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "conversation_id" uuid,
  "agent_id" uuid,
  "assigned_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."conversation_learning_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid,
  "message_id" uuid,
  "customer_id" uuid,
  "phone" text NOT NULL,
  "session_key" text DEFAULT 'principal'::text NOT NULL,
  "event_type" text NOT NULL,
  "severity" text DEFAULT 'medium'::text NOT NULL,
  "user_text" text,
  "previous_bot_text" text,
  "context" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'open'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone
);

CREATE TABLE public."conversation_reviews" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid,
  "phone" text,
  "rating" integer,
  "comment" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."conversation_topics" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "customer_memory_id" uuid,
  "customer_id" uuid,
  "conversation_id" uuid,
  "last_message_id" uuid,
  "phone" text NOT NULL,
  "session_key" text DEFAULT 'principal'::text NOT NULL,
  "topic_key" text NOT NULL,
  "topic_type" text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "entities" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "pending_question" text,
  "resume_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "summary" text,
  "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  "pending_answer_type" text,
  "pending_answer_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "parent_topic_key" text,
  "last_customer_message_at" timestamp with time zone,
  "last_bot_question_at" timestamp with time zone
);

CREATE TABLE public."conversations" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "customer_id" uuid,
  "channel" text DEFAULT 'whatsapp'::text,
  "status" text DEFAULT 'open'::text,
  "created_at" timestamp without time zone DEFAULT now(),
  "first_response_at" timestamp without time zone,
  "last_agent_message_at" timestamp without time zone,
  "closed_at" timestamp without time zone,
  "assigned_agent_id" uuid,
  "state" text DEFAULT 'idle'::text,
  "store_id" uuid,
  "phone" text,
  "last_message" text,
  "updated_at" timestamp without time zone DEFAULT now(),
  "customer_name" text,
  "avatar_url" text,
  "customer_phone" text,
  "last_message_at" timestamp with time zone,
  "session_key" text DEFAULT 'principal'::text NOT NULL,
  "assigned_to" uuid,
  "context" jsonb,
  "cart" jsonb DEFAULT '{"items": []}'::jsonb,
  "memory" jsonb DEFAULT '{}'::jsonb,
  "onboarding_sent" boolean DEFAULT false,
  "mode" text DEFAULT 'DEFAULT'::text,
  "checkout" jsonb DEFAULT '{}'::jsonb,
  "review_sent_at" timestamp with time zone,
  "review_status" text DEFAULT 'pending'::text,
  "session_id" text,
  "review_rating" integer,
  "review_comment" text,
  "review_answered_at" timestamp with time zone,
  "review_requested_at" timestamp with time zone
);

CREATE TABLE public."customer_memories" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid,
  "store_id" uuid,
  "phone" text NOT NULL,
  "preferred_name" text,
  "facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "summary" text,
  "active_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "recent_product_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source_sessions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "turn_count" integer DEFAULT 0 NOT NULL,
  "summary_version" integer DEFAULT 1 NOT NULL,
  "last_message_at" timestamp with time zone,
  "last_summarized_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."customers" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "name" text,
  "phone" text,
  "created_at" timestamp without time zone DEFAULT now(),
  "email" text,
  "tags" text[],
  "metadata" jsonb,
  "store_id" uuid
);

CREATE TABLE public."events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "type" text,
  "conversation_id" uuid,
  "payload" jsonb,
  "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."messages" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "conversation_id" uuid,
  "sender" text,
  "content" text,
  "created_at" timestamp without time zone DEFAULT now(),
  "type" text DEFAULT 'text'::text,
  "external_id" text,
  "status" text DEFAULT 'sent'::text,
  "metadata" jsonb,
  "store_id" uuid,
  "phone" text,
  "message_id" text,
  "session_key" text NOT NULL,
  "media_url" text,
  "mime_type" text,
  "state" text,
  "flow" text,
  "step" text,
  "intent" text,
  "ai_used" boolean DEFAULT false,
  "input_tokens" integer DEFAULT 0,
  "output_tokens" integer DEFAULT 0,
  "media_type" text,
  "transcription" text,
  "mode" text,
  "mimetype" text,
  "filename" text,
  "caption" text,
  "media_size" integer,
  "is_media" boolean DEFAULT false,
  "session_id" text,
  "has_media" boolean DEFAULT false,
  "media_mime_type" text,
  "media_filename" text
);

CREATE TABLE public."order_status_messages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "store_id" text,
  "order_id" text NOT NULL,
  "order_number" text,
  "phone" text NOT NULL,
  "event" text NOT NULL,
  "status" text,
  "tracking_code" text,
  "tracking_url" text,
  "session_key" text DEFAULT 'principal'::text,
  "message_sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."orders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "customer_id" uuid,
  "nuvemshop_order_id" text,
  "customer_name" text,
  "customer_email" text,
  "customer_phone" text,
  "total" numeric(10,2),
  "subtotal" numeric(10,2),
  "discount" numeric(10,2),
  "shipping_cost" numeric(10,2),
  "payment_status" text,
  "fulfillment_status" text,
  "status" text,
  "products" jsonb DEFAULT '[]'::jsonb,
  "shipping_address" jsonb,
  "raw_payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "external_id" text,
  "order_number" bigint,
  "conversation_id" uuid,
  "payment_method" text,
  "shipping_status" text,
  "shipping_method" text,
  "tracking_number" text,
  "tracking_url" text,
  "currency" text,
  "address" text,
  "items" jsonb DEFAULT '[]'::jsonb,
  "raw" jsonb,
  "raw_products" jsonb DEFAULT '[]'::jsonb,
  "whatsapp_number" text
);

CREATE TABLE public."products" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "nuvemshop_product_id" text NOT NULL,
  "name" text NOT NULL,
  "slug" text,
  "description" text,
  "price" numeric(10,2),
  "promotional_price" numeric(10,2),
  "stock" integer DEFAULT 0,
  "category" text,
  "active" boolean DEFAULT true,
  "images" jsonb DEFAULT '[]'::jsonb,
  "variants" jsonb DEFAULT '[]'::jsonb,
  "raw_payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."profiles" (
  "id" uuid NOT NULL,
  "name" text,
  "email" text,
  "role" text DEFAULT 'admin'::text,
  "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."ratings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid,
  "score" integer,
  "feedback" text,
  "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."settings" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "key" text,
  "value" jsonb,
  "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."store_settings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "store_key" text DEFAULT 'default'::text NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."stores" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "store_id" bigint,
  "created_at" timestamp without time zone DEFAULT now(),
  "shop" text,
  "user_id" bigint,
  "updated_at" timestamp without time zone,
  "name" text,
  "status" text DEFAULT 'online'::text,
  "phone" text,
  "access_token" text,
  "refresh_token" text
);

CREATE TABLE public."whatsapp_sessions" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "phone" text,
  "status" text,
  "last_seen" timestamp without time zone,
  "created_at" timestamp without time zone DEFAULT now(),
  "is_default" boolean DEFAULT false,
  "name" text,
  "user_id" uuid,
  "store_id" bigint,
  "is_connected" boolean DEFAULT false,
  "deleted_at" timestamp without time zone,
  "session_key" text,
  "setor" text,
  "label" text,
  "bot_enabled" boolean DEFAULT true,
  "type" text DEFAULT 'sales'::text,
  "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE public."abandoned_cart_messages" ADD CONSTRAINT "abandoned_cart_messages_checkout_id_phone_key" UNIQUE (checkout_id, phone);

ALTER TABLE public."abandoned_cart_messages" ADD CONSTRAINT "abandoned_cart_messages_pkey" PRIMARY KEY (id);

ALTER TABLE public."abandoned_carts" ADD CONSTRAINT "abandoned_carts_pkey" PRIMARY KEY (id);

ALTER TABLE public."agents" ADD CONSTRAINT "agents_pkey" PRIMARY KEY (id);

ALTER TABLE public."automation_logs" ADD CONSTRAINT "automation_logs_pkey" PRIMARY KEY (id);

ALTER TABLE public."automations" ADD CONSTRAINT "automations_pkey" PRIMARY KEY (id);

ALTER TABLE public."broadcast_campaigns" ADD CONSTRAINT "broadcast_campaigns_pkey" PRIMARY KEY (id);

ALTER TABLE public."broadcast_campaigns" ADD CONSTRAINT "broadcast_campaigns_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'running'::text, 'paused'::text, 'completed'::text, 'cancelled'::text])));

ALTER TABLE public."broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_campaign_id_phone_key_key" UNIQUE (campaign_id, phone_key);

ALTER TABLE public."broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY (id);

ALTER TABLE public."broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])));

ALTER TABLE public."broadcast_suppressions" ADD CONSTRAINT "broadcast_suppressions_pkey" PRIMARY KEY (phone_key);

ALTER TABLE public."conversation_assignments" ADD CONSTRAINT "conversation_assignments_pkey" PRIMARY KEY (id);

ALTER TABLE public."conversation_learning_events" ADD CONSTRAINT "conversation_learning_events_pkey" PRIMARY KEY (id);

ALTER TABLE public."conversation_learning_events" ADD CONSTRAINT "conversation_learning_events_severity_check" CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])));

ALTER TABLE public."conversation_learning_events" ADD CONSTRAINT "conversation_learning_events_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'reviewed'::text, 'resolved'::text, 'ignored'::text])));

ALTER TABLE public."conversation_reviews" ADD CONSTRAINT "conversation_reviews_pkey" PRIMARY KEY (id);

ALTER TABLE public."conversation_topics" ADD CONSTRAINT "conversation_topics_pkey" PRIMARY KEY (id);

ALTER TABLE public."conversation_topics" ADD CONSTRAINT "conversation_topics_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'awaiting_answer'::text, 'answered_side_question'::text, 'resolved'::text, 'superseded'::text])));

ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_pkey" PRIMARY KEY (id);

ALTER TABLE public."customer_memories" ADD CONSTRAINT "customer_memories_customer_key" UNIQUE (customer_id);

ALTER TABLE public."customer_memories" ADD CONSTRAINT "customer_memories_phone_key" UNIQUE (phone);

ALTER TABLE public."customer_memories" ADD CONSTRAINT "customer_memories_pkey" PRIMARY KEY (id);

ALTER TABLE public."customers" ADD CONSTRAINT "customers_phone_key" UNIQUE (phone);

ALTER TABLE public."customers" ADD CONSTRAINT "customers_pkey" PRIMARY KEY (id);

ALTER TABLE public."events" ADD CONSTRAINT "events_pkey" PRIMARY KEY (id);

ALTER TABLE public."messages" ADD CONSTRAINT "messages_pkey" PRIMARY KEY (id);

ALTER TABLE public."messages" ADD CONSTRAINT "messages_sender_check" CHECK ((sender = ANY (ARRAY['user'::text, 'bot'::text, 'agent'::text])));

ALTER TABLE public."order_status_messages" ADD CONSTRAINT "order_status_messages_order_id_event_status_key" UNIQUE (order_id, event, status);

ALTER TABLE public."order_status_messages" ADD CONSTRAINT "order_status_messages_pkey" PRIMARY KEY (id);

ALTER TABLE public."orders" ADD CONSTRAINT "orders_pkey" PRIMARY KEY (id);

ALTER TABLE public."products" ADD CONSTRAINT "products_pkey" PRIMARY KEY (id);

ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);

ALTER TABLE public."ratings" ADD CONSTRAINT "ratings_pkey" PRIMARY KEY (id);

ALTER TABLE public."ratings" ADD CONSTRAINT "ratings_score_check" CHECK (((score >= 1) AND (score <= 5)));

ALTER TABLE public."settings" ADD CONSTRAINT "settings_key_key" UNIQUE (key);

ALTER TABLE public."settings" ADD CONSTRAINT "settings_pkey" PRIMARY KEY (id);

ALTER TABLE public."store_settings" ADD CONSTRAINT "store_settings_pkey" PRIMARY KEY (id);

ALTER TABLE public."stores" ADD CONSTRAINT "stores_pkey" PRIMARY KEY (id);

ALTER TABLE public."stores" ADD CONSTRAINT "stores_store_id_unique" UNIQUE (store_id);

ALTER TABLE public."whatsapp_sessions" ADD CONSTRAINT "unique_session_key" UNIQUE (session_key);

ALTER TABLE public."whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY (id);

ALTER TABLE public."agents" ADD CONSTRAINT "agents_id_fkey" FOREIGN KEY (id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."automation_logs" ADD CONSTRAINT "automation_logs_automation_id_fkey" FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE;

ALTER TABLE public."automation_logs" ADD CONSTRAINT "automation_logs_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

ALTER TABLE public."broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES broadcast_campaigns(id) ON DELETE CASCADE;

ALTER TABLE public."broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;

ALTER TABLE public."conversation_assignments" ADD CONSTRAINT "conversation_assignments_agent_id_fkey" FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL;

ALTER TABLE public."conversation_assignments" ADD CONSTRAINT "conversation_assignments_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

ALTER TABLE public."conversation_learning_events" ADD CONSTRAINT "conversation_learning_events_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;

ALTER TABLE public."conversation_learning_events" ADD CONSTRAINT "conversation_learning_events_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public."conversation_learning_events" ADD CONSTRAINT "conversation_learning_events_message_id_fkey" FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL;

ALTER TABLE public."conversation_reviews" ADD CONSTRAINT "conversation_reviews_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id);

ALTER TABLE public."conversation_topics" ADD CONSTRAINT "conversation_topics_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;

ALTER TABLE public."conversation_topics" ADD CONSTRAINT "conversation_topics_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE public."conversation_topics" ADD CONSTRAINT "conversation_topics_customer_memory_id_fkey" FOREIGN KEY (customer_memory_id) REFERENCES customer_memories(id) ON DELETE CASCADE;

ALTER TABLE public."conversation_topics" ADD CONSTRAINT "conversation_topics_last_message_id_fkey" FOREIGN KEY (last_message_id) REFERENCES messages(id) ON DELETE SET NULL;

ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_assigned_agent_id_fkey" FOREIGN KEY (assigned_agent_id) REFERENCES agents(id) ON DELETE SET NULL;

ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES agents(id);

ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_store_fk" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."customer_memories" ADD CONSTRAINT "customer_memories_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE public."customers" ADD CONSTRAINT "customers_store_fk" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."messages" ADD CONSTRAINT "messages_conversation_fk" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

ALTER TABLE public."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

ALTER TABLE public."messages" ADD CONSTRAINT "messages_store_fk" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."orders" ADD CONSTRAINT "orders_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;

ALTER TABLE public."orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public."ratings" ADD CONSTRAINT "ratings_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX abandoned_carts_unique ON public.abandoned_carts USING btree (store_id, order_id);

CREATE INDEX broadcast_campaigns_status_schedule_idx ON public.broadcast_campaigns USING btree (status, scheduled_at, created_at);

CREATE INDEX broadcast_recipients_queue_idx ON public.broadcast_recipients USING btree (campaign_id, status, next_attempt_at, created_at);

CREATE INDEX broadcast_recipients_sent_idx ON public.broadcast_recipients USING btree (status, sent_at);

CREATE UNIQUE INDEX conversation_learning_events_message_type_unique ON public.conversation_learning_events USING btree (message_id, event_type) WHERE (message_id IS NOT NULL);

CREATE INDEX conversation_learning_events_open_idx ON public.conversation_learning_events USING btree (status, severity, created_at DESC);

CREATE INDEX conversation_learning_events_phone_idx ON public.conversation_learning_events USING btree (phone, created_at DESC);

CREATE INDEX conversation_topics_conversation_idx ON public.conversation_topics USING btree (conversation_id, updated_at DESC);

CREATE INDEX conversation_topics_customer_idx ON public.conversation_topics USING btree (customer_id, updated_at DESC);

CREATE UNIQUE INDEX conversation_topics_open_unique ON public.conversation_topics USING btree (phone, topic_key) WHERE (status = ANY (ARRAY['active'::text, 'paused'::text]));

CREATE INDEX conversation_topics_phone_status_idx ON public.conversation_topics USING btree (phone, status, updated_at DESC);

CREATE INDEX conversation_topics_resume_idx ON public.conversation_topics USING btree (phone, topic_key, updated_at DESC);

CREATE INDEX conversations_phone_idx ON public.conversations USING btree (phone);

CREATE UNIQUE INDEX conversations_phone_session_key_unique ON public.conversations USING btree (phone, session_key);

CREATE INDEX conversations_session_key_idx ON public.conversations USING btree (session_key);

CREATE INDEX conversations_updated_at_idx ON public.conversations USING btree (updated_at DESC);

CREATE INDEX customer_memories_last_message_idx ON public.customer_memories USING btree (last_message_at DESC NULLS LAST);

CREATE INDEX customer_memories_phone_idx ON public.customer_memories USING btree (phone);

CREATE INDEX idx_conversations_customer ON public.conversations USING btree (customer_id);

CREATE INDEX idx_conversations_last_message_at ON public.conversations USING btree (last_message_at DESC);

CREATE INDEX idx_conversations_phone ON public.conversations USING btree (phone);

CREATE INDEX idx_conversations_phone_session ON public.conversations USING btree (phone, session_key);

CREATE INDEX idx_conversations_session_key ON public.conversations USING btree (session_key);

CREATE INDEX idx_conversations_store ON public.conversations USING btree (store_id);

CREATE INDEX idx_conversations_store_customer_session ON public.conversations USING btree (store_id, customer_phone, session_key);

CREATE INDEX idx_customers_phone ON public.customers USING btree (phone);

CREATE INDEX idx_customers_store ON public.customers USING btree (store_id);

CREATE UNIQUE INDEX idx_customers_unique_phone ON public.customers USING btree (store_id, phone);

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id);

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id);

CREATE INDEX idx_messages_session_key ON public.messages USING btree (session_key);

CREATE INDEX idx_messages_store ON public.messages USING btree (store_id);

CREATE UNIQUE INDEX idx_messages_unique ON public.messages USING btree (message_id);

CREATE INDEX idx_orders_customer ON public.orders USING btree (customer_id);

CREATE INDEX idx_orders_store ON public.orders USING btree (store_id);

CREATE UNIQUE INDEX idx_orders_unique ON public.orders USING btree (store_id, nuvemshop_order_id);

CREATE INDEX idx_products_store ON public.products USING btree (store_id);

CREATE UNIQUE INDEX idx_products_unique ON public.products USING btree (store_id, nuvemshop_product_id);

CREATE INDEX messages_conversation_id_created_at_idx ON public.messages USING btree (conversation_id, created_at DESC);

CREATE INDEX messages_conversation_id_idx ON public.messages USING btree (conversation_id);

CREATE UNIQUE INDEX messages_external_id_unique ON public.messages USING btree (external_id) WHERE (external_id IS NOT NULL);

CREATE INDEX messages_phone_idx ON public.messages USING btree (phone);

CREATE INDEX messages_phone_session_key_created_at_idx ON public.messages USING btree (phone, session_key, created_at DESC);

CREATE INDEX messages_session_key_idx ON public.messages USING btree (session_key);

CREATE UNIQUE INDEX orders_external_id_idx ON public.orders USING btree (external_id);

CREATE UNIQUE INDEX store_settings_store_key_unique ON public.store_settings USING btree (store_key);

CREATE UNIQUE INDEX unique_active_phone ON public.whatsapp_sessions USING btree (phone) WHERE (deleted_at IS NULL);

CREATE UNIQUE INDEX whatsapp_sessions_session_key_unique ON public.whatsapp_sessions USING btree (session_key);

CREATE OR REPLACE FUNCTION public.get_sales_funnel_total()
 RETURNS TABLE(carts_sent bigint, carts_recovered bigint, confirmed_sales bigint, recovered_value numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    count(*) filter (
      where
        whatsapp_sent = true
        or whatsapp_sent_at is not null
    ) as carts_sent,

    count(*) filter (
      where
        recovered = true
        and (
          whatsapp_sent = true
          or whatsapp_sent_at is not null
        )
    ) as carts_recovered,

    count(*) filter (
      where
        recovered = true
        and (
          whatsapp_sent = true
          or whatsapp_sent_at is not null
        )
    ) as confirmed_sales,

    coalesce(
      sum(total) filter (
        where
          recovered = true
          and (
            whatsapp_sent = true
            or whatsapp_sent_at is not null
          )
      ),
      0
    ) as recovered_value
  from public.abandoned_carts;
$function$;

CREATE OR REPLACE FUNCTION public.increment_automation_usage(automation_id uuid)
 RETURNS void
 LANGUAGE sql
AS $function$
  update automations
  set uses = coalesce(uses, 0) + 1
  where id = automation_id;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

ALTER TABLE public."abandoned_cart_messages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."abandoned_carts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."abandoned_carts_demo_backup" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."agents" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."automation_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."automations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."broadcast_campaigns" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."broadcast_recipients" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."broadcast_suppressions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."conversation_assignments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."conversation_learning_events" ENABLE ROW LEVEL SECURITY;

CREATE VIEW public."conversation_review_stats" AS
SELECT count(*) FILTER (WHERE review_status = 'sent'::text) AS pending_reviews,
    count(*) FILTER (WHERE review_status = 'answered'::text) AS answered_reviews,
    round(avg(review_rating), 2) AS average_rating
   FROM conversations
  WHERE review_rating IS NOT NULL;

ALTER TABLE public."conversation_reviews" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."conversation_topics" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."conversations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."customer_memories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."customers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."messages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."order_status_messages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."orders" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."products" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."ratings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."store_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."stores" DISABLE ROW LEVEL SECURITY;

ALTER TABLE public."whatsapp_sessions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard read conversation learning events" ON public."conversation_learning_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "dashboard read conversation topics" ON public."conversation_topics" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "dashboard read conversations" ON public."conversations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "dashboard read customer memories" ON public."customer_memories" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "dashboard read customers" ON public."customers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "dashboard read messages" ON public."messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "admin delete" ON public."profiles" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((auth.uid() = id) OR (EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = 'admin'::text))))));

CREATE POLICY "liberar leitura" ON public."profiles" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "profiles delete" ON public."profiles" AS PERMISSIVE FOR DELETE TO PUBLIC USING (true);

CREATE POLICY "profiles insert" ON public."profiles" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);

CREATE POLICY "profiles read own" ON public."profiles" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = id));

CREATE POLICY "store_settings_insert_authenticated" ON public."store_settings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "store_settings_select_authenticated" ON public."store_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "store_settings_update_authenticated" ON public."store_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Allow all" ON public."whatsapp_sessions" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);

CREATE POLICY "allow all" ON public."whatsapp_sessions" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);

CREATE POLICY "dashboard read whatsapp sessions" ON public."whatsapp_sessions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

REVOKE ALL ON TABLE public."abandoned_cart_messages" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."abandoned_carts" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."abandoned_carts_demo_backup" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."agents" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."automation_logs" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."automations" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."broadcast_campaigns" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."broadcast_recipients" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."broadcast_suppressions" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."conversation_assignments" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."conversation_learning_events" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."conversation_review_stats" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."conversation_reviews" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."conversation_topics" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."conversations" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."customer_memories" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."customers" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."events" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."messages" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."order_status_messages" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."orders" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."products" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."profiles" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."ratings" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."settings" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."store_settings" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."stores" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public."whatsapp_sessions" FROM PUBLIC, anon, authenticated, service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."abandoned_cart_messages" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."abandoned_cart_messages" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."abandoned_cart_messages" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."abandoned_cart_messages" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."abandoned_carts" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."abandoned_carts" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."abandoned_carts" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."abandoned_carts" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."abandoned_carts_demo_backup" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."abandoned_carts_demo_backup" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."abandoned_carts_demo_backup" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."abandoned_carts_demo_backup" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."agents" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."agents" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."agents" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."agents" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automation_logs" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automation_logs" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automation_logs" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automation_logs" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automations" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automations" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automations" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automations" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."broadcast_campaigns" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."broadcast_campaigns" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."broadcast_campaigns" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."broadcast_campaigns" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."broadcast_recipients" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."broadcast_recipients" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."broadcast_recipients" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."broadcast_recipients" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."broadcast_suppressions" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."broadcast_suppressions" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."broadcast_suppressions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."broadcast_suppressions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_assignments" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_assignments" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_assignments" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_assignments" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_learning_events" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_learning_events" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_learning_events" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_learning_events" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_review_stats" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_review_stats" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_review_stats" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_review_stats" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_reviews" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_reviews" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_reviews" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_reviews" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_topics" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_topics" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_topics" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversation_topics" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversations" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversations" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversations" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversations" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."customer_memories" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."customer_memories" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."customer_memories" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."customer_memories" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."customers" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."customers" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."customers" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."customers" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messages" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messages" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messages" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messages" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."order_status_messages" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."order_status_messages" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."order_status_messages" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."order_status_messages" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."orders" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."orders" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."orders" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."orders" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."products" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."products" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."products" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."products" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ratings" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ratings" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ratings" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ratings" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."settings" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."settings" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."settings" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."settings" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."store_settings" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."store_settings" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."store_settings" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."store_settings" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stores" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stores" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stores" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stores" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."whatsapp_sessions" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."whatsapp_sessions" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."whatsapp_sessions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."whatsapp_sessions" TO "service_role";

GRANT USAGE ON SCHEMA "public" TO PUBLIC;

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT CREATE, USAGE ON SCHEMA "public" TO "pg_database_owner";

GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "service_role";

REVOKE ALL ON FUNCTION public."increment_automation_usage"(automation_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public."rls_auto_enable"() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public."get_sales_funnel_total"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public."get_sales_funnel_total"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."get_sales_funnel_total"() TO "anon";

GRANT EXECUTE ON FUNCTION public."get_sales_funnel_total"() TO "authenticated";

GRANT EXECUTE ON FUNCTION public."get_sales_funnel_total"() TO "postgres";

GRANT EXECUTE ON FUNCTION public."get_sales_funnel_total"() TO "service_role";

GRANT EXECUTE ON FUNCTION public."increment_automation_usage"(automation_id uuid) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."increment_automation_usage"(automation_id uuid) TO "anon";

GRANT EXECUTE ON FUNCTION public."increment_automation_usage"(automation_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."increment_automation_usage"(automation_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION public."increment_automation_usage"(automation_id uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION public."rls_auto_enable"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."rls_auto_enable"() TO "anon";

GRANT EXECUTE ON FUNCTION public."rls_auto_enable"() TO "authenticated";

GRANT EXECUTE ON FUNCTION public."rls_auto_enable"() TO "postgres";

GRANT EXECUTE ON FUNCTION public."rls_auto_enable"() TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "service_role";

-- Default privileges de supabase_admin sao da plataforma e nao sao substituidos.

DO $event$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname='ensure_rls') THEN
    CREATE EVENT TRIGGER "ensure_rls" ON ddl_command_end WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') EXECUTE FUNCTION "public"."rls_auto_enable"();
  END IF;
END $event$;

COMMENT ON TABLE public."conversation_topics" IS 'Pilha de assuntos da cliente com pausa, retomada, entidades e estado operacional.';

COMMENT ON TABLE public."customer_memories" IS 'Memória global da cliente, compartilhada entre todos os números e sessões da Moda Pink.';

COMMENT ON TABLE public."conversation_learning_events" IS 'Falhas, reparos e bloqueios de contexto usados para melhorar continuamente o atendimento.';

COMMENT ON COLUMN public."customers"."metadata" IS 'Dados extensíveis da cliente. customer_memory mantém preferências, fatos e continuidade entre sessões do WhatsApp.';
