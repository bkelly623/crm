-- LOCAL REHEARSAL ONLY. Never apply to production or a shared database.
-- Reconstructed solely from STAGING_READINESS_REPORT.md catalog metadata.
-- No production data, auth schema, grants, triggers, or migration history copied.
-- Core timestamptz(6), NO ACTION update FKs and audited index names preserved.
BEGIN;
DO $$ BEGIN
 IF current_database() NOT IN ('crm_local_staging', 'crm_local_restore') THEN
  RAISE EXCEPTION 'Local rehearsal database name required';
 END IF;
END $$;
CREATE TYPE "UserRole" AS ENUM ('admin','sales_manager','hiring_manager','sales_rep','closer','project_manager','hybrid','client');
CREATE TYPE "LeadSegment" AS ENUM ('active','won','trashed');
CREATE TYPE "LeadSource" AS ENUM ('native','csv','ghl','manual');
CREATE TYPE "CallStatus" AS ENUM ('initiated','ringing','in_progress','completed','no_answer','busy','failed','canceled');
CREATE TYPE "TaskStatus" AS ENUM ('open','completed','canceled');
CREATE TABLE profiles (
 id uuid CONSTRAINT profiles_pkey PRIMARY KEY,
 email text NOT NULL CONSTRAINT profiles_email_key UNIQUE,
 full_name text, role "UserRole" NOT NULL DEFAULT 'sales_rep', phone text,
 timezone text NOT NULL DEFAULT 'America/New_York', google_calendar_id text,
 dialer_hours_extended boolean NOT NULL DEFAULT false,
 twilio_phone_number text, ghl_contact_id text,
 created_at timestamptz(6) NOT NULL DEFAULT now(), updated_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE TABLE leads (
 id text CONSTRAINT leads_pkey PRIMARY KEY,
 business_name text NOT NULL, contact_name text, phone text, email text, website text,
 revenue text, location text, industry text, sic_code text, market text, type text,
 source "LeadSource" NOT NULL DEFAULT 'native', segment "LeadSegment" NOT NULL DEFAULT 'active',
 sdr_status text NOT NULL DEFAULT 'no_contact', external_id text, external_source text, notes text,
 dialed_count integer NOT NULL DEFAULT 0,
 setter_id uuid CONSTRAINT leads_setter_id_fkey REFERENCES profiles(id) ON DELETE SET NULL,
 closer_id uuid CONSTRAINT leads_closer_id_fkey REFERENCES profiles(id) ON DELETE SET NULL,
 created_at timestamptz(6) NOT NULL DEFAULT now(), updated_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE TABLE calls (
 id text CONSTRAINT calls_pkey PRIMARY KEY,
 lead_id text NOT NULL CONSTRAINT calls_lead_id_fkey REFERENCES leads(id) ON DELETE CASCADE,
 user_id uuid NOT NULL CONSTRAINT calls_user_id_fkey REFERENCES profiles(id) ON DELETE CASCADE,
 twilio_call_sid text CONSTRAINT calls_twilio_call_sid_key UNIQUE,
 status "CallStatus" NOT NULL DEFAULT 'initiated', disposition text,
 duration_seconds integer, recording_url text,
 started_at timestamptz(6) NOT NULL DEFAULT now(), ended_at timestamptz(6)
);
CREATE TABLE tasks (
 id text CONSTRAINT tasks_pkey PRIMARY KEY,
 lead_id text NOT NULL CONSTRAINT tasks_lead_id_fkey REFERENCES leads(id) ON DELETE CASCADE,
 user_id uuid NOT NULL CONSTRAINT tasks_user_id_fkey REFERENCES profiles(id) ON DELETE CASCADE,
 note text NOT NULL, due_at timestamptz(6) NOT NULL,
 status "TaskStatus" NOT NULL DEFAULT 'open', created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE TABLE smart_views (
 id text CONSTRAINT smart_views_pkey PRIMARY KEY,
 user_id uuid NOT NULL CONSTRAINT smart_views_user_id_fkey REFERENCES profiles(id) ON DELETE CASCADE,
 name text NOT NULL, filters jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE TABLE org_settings (
 id text CONSTRAINT org_settings_pkey PRIMARY KEY DEFAULT 'default',
 ghl_enabled boolean NOT NULL DEFAULT false, ghl_location_id text, ghl_api_key text,
 use_ghl_calendar boolean NOT NULL DEFAULT false, use_ghl_workflows boolean NOT NULL DEFAULT false
);
CREATE INDEX leads_segment_idx ON leads USING btree(segment);
CREATE INDEX leads_setter_id_idx ON leads USING btree(setter_id);
CREATE INDEX leads_phone_idx ON leads USING btree(phone);
CREATE INDEX leads_external_idx ON leads USING btree(external_id, external_source);
CREATE INDEX calls_lead_id_idx ON calls USING btree(lead_id);
CREATE INDEX calls_user_started_idx ON calls USING btree(user_id, started_at);
CREATE INDEX tasks_user_due_idx ON tasks USING btree(user_id, due_at);
CREATE INDEX tasks_status_idx ON tasks USING btree(status);
CREATE INDEX smart_views_user_id_idx ON smart_views USING btree(user_id);
COMMIT;
