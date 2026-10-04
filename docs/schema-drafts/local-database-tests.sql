-- LOCAL SYNTHETIC SQL TESTS ONLY. Run after local-baseline.sql and tags-lists.sql.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO profiles(id,email) VALUES ('00000000-0000-4000-8000-000000000001','synthetic-owner@example.invalid'),('00000000-0000-4000-8000-000000000002','synthetic-other@example.invalid');
INSERT INTO leads(id,business_name,setter_id,notes) VALUES ('synthetic-lead','Synthetic Company — DO NOT CALL','00000000-0000-4000-8000-000000000001','Local fixture only');
INSERT INTO calls(id,lead_id,user_id) VALUES ('synthetic-call','synthetic-lead','00000000-0000-4000-8000-000000000001');
INSERT INTO tasks(id,lead_id,user_id,note,due_at) VALUES ('synthetic-task','synthetic-lead','00000000-0000-4000-8000-000000000001','Synthetic follow-up',now());
INSERT INTO smart_views(id,user_id,name) VALUES ('synthetic-view','00000000-0000-4000-8000-000000000001','Synthetic view');
INSERT INTO org_settings(id) VALUES ('default');
INSERT INTO tags(id,name,name_key) VALUES ('synthetic-tag','Synthetic Tag','synthetic tag');
INSERT INTO lead_tags(lead_id,tag_id) VALUES ('synthetic-lead','synthetic-tag');
INSERT INTO lead_lists(id,owner_id,name,name_key) VALUES
 ('synthetic-list-a','00000000-0000-4000-8000-000000000001','List A','list a'),
 ('synthetic-list-b','00000000-0000-4000-8000-000000000001','List B','list b'),
 ('synthetic-list-other','00000000-0000-4000-8000-000000000002','List A','list a');
INSERT INTO lead_list_memberships(lead_id,list_id) VALUES ('synthetic-lead','synthetic-list-a'),('synthetic-lead','synthetic-list-b');
COMMIT;
DO $$
DECLARE stmt text; affected integer;
BEGIN
 -- Every new FK is independently violated and must return SQLSTATE 23503.
 FOREACH stmt IN ARRAY ARRAY[
  $q$INSERT INTO lead_tags VALUES ('missing-lead','synthetic-tag',now())$q$,
  $q$INSERT INTO lead_tags VALUES ('synthetic-lead','missing-tag',now())$q$,
  $q$INSERT INTO lead_lists VALUES ('bad-owner','00000000-0000-4000-8000-000000000099','Bad','bad',now())$q$,
  $q$INSERT INTO lead_list_memberships VALUES ('missing-lead','synthetic-list-a',now())$q$,
  $q$INSERT INTO lead_list_memberships VALUES ('synthetic-lead','missing-list',now())$q$
 ] LOOP
  BEGIN EXECUTE stmt; RAISE EXCEPTION 'FK accepted invalid row';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 END LOOP;
 -- Both organizer uniqueness rules plus both membership composite PKs.
 FOREACH stmt IN ARRAY ARRAY[
  $q$INSERT INTO tags(id,name,name_key) VALUES ('duplicate-tag','Duplicate','synthetic tag')$q$,
  $q$INSERT INTO lead_lists(id,owner_id,name,name_key) VALUES ('duplicate-list','00000000-0000-4000-8000-000000000001','Duplicate','list a')$q$,
  $q$INSERT INTO lead_tags(lead_id,tag_id) VALUES ('synthetic-lead','synthetic-tag')$q$,
  $q$INSERT INTO lead_list_memberships(lead_id,list_id) VALUES ('synthetic-lead','synthetic-list-a')$q$
 ] LOOP
  BEGIN EXECUTE stmt; RAISE EXCEPTION 'Unique constraint accepted duplicate';
  EXCEPTION WHEN unique_violation THEN NULL; END;
 END LOOP;
 INSERT INTO lead_list_memberships(lead_id,list_id) VALUES ('synthetic-lead','synthetic-list-a') ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 0 THEN RAISE EXCEPTION 'Membership retry not idempotent'; END IF;
 INSERT INTO lead_tags(lead_id,tag_id) VALUES ('synthetic-lead','synthetic-tag') ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 0 THEN RAISE EXCEPTION 'Tag retry not idempotent'; END IF;
 IF (SELECT count(*) FROM leads) <> 1 OR (SELECT count(*) FROM lead_list_memberships) <> 2 THEN
  RAISE EXCEPTION 'One master lead / two lists invariant failed';
 END IF;
 RAISE NOTICE 'PASS: 5 FKs, 4 uniqueness checks, 2 idempotent retries, 1 lead in 2 lists';
END $$;
-- Mutation/cascade rollback: delete must cascade, ROLLBACK must restore all rows.
BEGIN;
DELETE FROM leads WHERE id='synthetic-lead';
DO $$ BEGIN
 IF EXISTS(SELECT FROM lead_tags) OR EXISTS(SELECT FROM lead_list_memberships) OR EXISTS(SELECT FROM calls) OR EXISTS(SELECT FROM tasks) THEN
  RAISE EXCEPTION 'Lead delete did not cascade'; END IF;
END $$;
ROLLBACK;
DO $$ BEGIN
 IF (SELECT count(*) FROM leads) <> 1 OR (SELECT count(*) FROM lead_list_memberships) <> 2 OR (SELECT count(*) FROM lead_tags) <> 1 OR (SELECT count(*) FROM calls) <> 1 OR (SELECT count(*) FROM tasks) <> 1 THEN
  RAISE EXCEPTION 'Rollback failed'; END IF;
 RAISE NOTICE 'PASS: cascaded data changes rolled back';
END $$;
-- Deliberately grant table privileges so RLS, not missing GRANT, is the denial.
CREATE ROLE crm_local_rls_probe NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO crm_local_rls_probe;
GRANT SELECT,INSERT,UPDATE,DELETE ON tags,lead_tags,lead_lists,lead_list_memberships TO crm_local_rls_probe;
SET ROLE crm_local_rls_probe;
DO $$
DECLARE t text; n bigint; affected integer; stmt text;
BEGIN
 IF current_user <> 'crm_local_rls_probe' OR (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) THEN
  RAISE EXCEPTION 'Not a non-owner, non-bypass probe'; END IF;
 FOREACH t IN ARRAY ARRAY['tags','lead_tags','lead_lists','lead_list_memberships'] LOOP
  IF NOT has_table_privilege(current_user,t,'SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Missing grants'; END IF;
  EXECUTE format('SELECT count(*) FROM %I',t) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'RLS exposed % rows',t; END IF;
  EXECUTE format('UPDATE %I SET created_at=now()',t);
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'RLS allowed UPDATE %',t; END IF;
  EXECUTE format('DELETE FROM %I',t);
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'RLS allowed DELETE %',t; END IF;
 END LOOP;
 FOREACH stmt IN ARRAY ARRAY[
  $q$INSERT INTO tags(id,name,name_key) VALUES ('probe-tag','Probe','probe')$q$,
  $q$INSERT INTO lead_tags(lead_id,tag_id) VALUES ('synthetic-lead','synthetic-tag')$q$,
  $q$INSERT INTO lead_lists(id,owner_id,name,name_key) VALUES ('probe-list','00000000-0000-4000-8000-000000000001','Probe','probe')$q$,
  $q$INSERT INTO lead_list_memberships(lead_id,list_id) VALUES ('synthetic-lead','synthetic-list-other')$q$
 ] LOOP
  BEGIN EXECUTE stmt; RAISE EXCEPTION 'RLS allowed INSERT';
  EXCEPTION WHEN insufficient_privilege THEN
   IF SQLERRM NOT LIKE '%row-level security%' THEN RAISE; END IF;
  END;
 END LOOP;
 RAISE NOTICE 'PASS: RLS on all 4 tables hides SELECT, blocks INSERT, filters UPDATE/DELETE';
END $$;
RESET ROLE;
-- Remove deliberate probe grants after the test, leaving a no-login role for evidence.
REVOKE ALL ON tags,lead_tags,lead_lists,lead_list_memberships FROM crm_local_rls_probe;
REVOKE USAGE ON SCHEMA public FROM crm_local_rls_probe;
