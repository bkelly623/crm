-- LOCAL-ONLY REVIEW DRAFT. Not a production migration. Never db push.
-- Requires exact guarded loopback runner; all existing native types untouched.
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'crm_local_staging' THEN RAISE EXCEPTION 'Wrong local database'; END IF;
END $$;
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
-- No client policies/grants. Local staging need not have Supabase roles.
DO $$ DECLARE role_name TEXT; BEGIN
  FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
    EXECUTE format('REVOKE ALL ON call_intents, call_intent_leases FROM %I', role_name);
  END LOOP;
END $$;
COMMIT;
