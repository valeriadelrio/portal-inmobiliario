-- H6c: topes de uso por inmobiliaria, aplicados por la base (aunque alguien salte la app).
-- Solo actúan cuando se corre como app_user (los scripts y migraciones del dueño no se ven afectados).

CREATE OR REPLACE FUNCTION rate_limit_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n bigint;
BEGIN
  IF NOT app_is_app_user() THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'agency_invitation' THEN
    SELECT count(*) INTO v_n FROM agency_invitation WHERE agency_id = NEW.agency_id AND created_at > now() - interval '24 hours';
    IF v_n >= 30 THEN RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001'; END IF;
  ELSIF TG_TABLE_NAME = 'property_photo' THEN
    SELECT count(*) INTO v_n FROM property_photo WHERE agency_id = NEW.agency_id AND created_at > now() - interval '1 hour';
    IF v_n >= 200 THEN RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001'; END IF;
  ELSIF TG_TABLE_NAME = 'property' THEN
    SELECT count(*) INTO v_n FROM property WHERE agency_id = NEW.agency_id AND created_at > now() - interval '24 hours';
    IF v_n >= 100 THEN RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001'; END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER invitation_rate_trg BEFORE INSERT ON agency_invitation FOR EACH ROW EXECUTE FUNCTION rate_limit_guard();
--> statement-breakpoint
CREATE TRIGGER photo_rate_trg BEFORE INSERT ON property_photo FOR EACH ROW EXECUTE FUNCTION rate_limit_guard();
--> statement-breakpoint
CREATE TRIGGER property_rate_trg BEFORE INSERT ON property FOR EACH ROW EXECUTE FUNCTION rate_limit_guard();
--> statement-breakpoint
REVOKE ALL ON FUNCTION rate_limit_guard() FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON FUNCTION rate_limit_guard() FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON FUNCTION rate_limit_guard() FROM authenticated; END IF;
END $$;
