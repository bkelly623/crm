-- LOCAL ONLY additive extension, NOT a production migration; never db push.
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'crm_local_staging' THEN RAISE EXCEPTION 'Wrong local database'; END IF;
END $$;
ALTER TABLE call_intents
 ADD COLUMN child_call_sid TEXT UNIQUE CHECK (child_call_sid ~ '^CA[0-9a-fA-F]{32}$'),
 ADD COLUMN parent_status TEXT CHECK (parent_status IN ('queued','initiated','ringing','in-progress','completed','busy','no-answer','failed','canceled')),
 ADD COLUMN child_status TEXT CHECK (child_status IN ('queued','initiated','ringing','in-progress','completed','busy','no-answer','failed','canceled')),
 ADD COLUMN finished_at TIMESTAMPTZ(6),
 ADD CONSTRAINT call_intents_child_binding CHECK (child_call_sid IS NULL OR (state = 'bound' AND child_call_sid <> parent_call_sid)),
 ADD CONSTRAINT call_intents_terminal_proof CHECK (finished_at IS NULL OR (child_call_sid IS NOT NULL AND parent_status IS NOT NULL AND child_status IS NOT NULL AND parent_status IN ('completed','busy','no-answer','failed','canceled') AND child_status IN ('completed','busy','no-answer','failed','canceled')));
COMMIT;
