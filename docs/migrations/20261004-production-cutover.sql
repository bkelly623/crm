-- Authorized Outpost production cutover. Rehearsed against recovered six-table export.
-- Apply ONLY to Supabase fzjsgerhohsfxwsqkjdu after identity and baseline checks.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public;

CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "name_key" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_tags" (
    "lead_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_tags_pkey" PRIMARY KEY ("lead_id","tag_id")
);

CREATE TABLE "lead_lists" (
    "id" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "name_key" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_lists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_list_memberships" (
    "lead_id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_list_memberships_pkey" PRIMARY KEY ("lead_id","list_id")
);

CREATE UNIQUE INDEX "tags_name_key_key" ON "tags"("name_key");

CREATE INDEX "lead_tags_tag_id_idx" ON "lead_tags"("tag_id");

CREATE UNIQUE INDEX "lead_lists_owner_id_name_key_key" ON "lead_lists"("owner_id", "name_key");

CREATE INDEX "lead_list_memberships_list_id_idx" ON "lead_list_memberships"("list_id");

ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_lists" ADD CONSTRAINT "lead_lists_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_list_memberships" ADD CONSTRAINT "lead_list_memberships_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_list_memberships" ADD CONSTRAINT "lead_list_memberships_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lead_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_lists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_list_memberships" ENABLE ROW LEVEL SECURITY;


CREATE TABLE "call_intents" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "lead_id" TEXT NOT NULL REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "account_sid" TEXT NOT NULL CHECK (account_sid ~ '^AC[0-9a-fA-F]{32}$'),
  "caller_id_sid" TEXT NOT NULL CHECK (caller_id_sid ~ '^PN[0-9a-fA-F]{32}$'),
  "caller_number" TEXT NOT NULL CHECK (caller_number ~ '^\+[1-9][0-9]{1,14}$'),
  "destination" TEXT NOT NULL CHECK (destination ~ '^\+[1-9][0-9]{1,14}$'),
  "state" TEXT NOT NULL DEFAULT 'issued' CHECK (state IN ('issued','bound','expired','canceled')),
  "parent_call_sid" TEXT UNIQUE CHECK (parent_call_sid ~ '^CA[0-9a-fA-F]{32}$'),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  UNIQUE (id, user_id, lead_id),
  CHECK (expires_at > created_at),
  CHECK ((state = 'bound') = (parent_call_sid IS NOT NULL))
);
CREATE TABLE "call_intent_leases" (
  "intent_id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL UNIQUE,
  "lead_id" TEXT NOT NULL UNIQUE,
  UNIQUE (intent_id, user_id, lead_id),
  FOREIGN KEY (intent_id, user_id, lead_id) REFERENCES call_intents(id, user_id, lead_id) ON DELETE RESTRICT ON UPDATE CASCADE
);
ALTER TABLE call_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_intent_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON call_intents, call_intent_leases FROM PUBLIC;
DO $$ DECLARE role_name TEXT; BEGIN
  FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
    EXECUTE format('REVOKE ALL ON call_intents, call_intent_leases FROM %I', role_name);
  END LOOP;
END $$;

ALTER TABLE call_intents
 ADD COLUMN child_call_sid TEXT UNIQUE CHECK (child_call_sid ~ '^CA[0-9a-fA-F]{32}$'),
 ADD COLUMN parent_status TEXT CHECK (parent_status IN ('queued','initiated','ringing','in-progress','completed','busy','no-answer','failed','canceled')),
 ADD COLUMN child_status TEXT CHECK (child_status IN ('queued','initiated','ringing','in-progress','completed','busy','no-answer','failed','canceled')),
 ADD COLUMN finished_at TIMESTAMPTZ(6),
 ADD CONSTRAINT call_intents_child_binding CHECK (child_call_sid IS NULL OR (state = 'bound' AND child_call_sid <> parent_call_sid)),
 ADD CONSTRAINT call_intents_terminal_proof CHECK (finished_at IS NULL OR (child_call_sid IS NOT NULL AND parent_status IS NOT NULL AND child_status IS NOT NULL AND parent_status IN ('completed','busy','no-answer','failed','canceled') AND child_status IN ('completed','busy','no-answer','failed','canceled')));
REVOKE ALL ON calls, leads, org_settings, profiles, smart_views, tasks, tags, lead_tags, lead_lists, lead_list_memberships, call_intents, call_intent_leases FROM PUBLIC, anon, authenticated;

COMMIT;
