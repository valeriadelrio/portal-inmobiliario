-- H6a: moderación. Ocultar publicaciones (solo la plataforma, con motivo y auditoría), denuncias de
-- visitantes y lectura del registro de acciones. Los errores de negocio se señalan con
--   RAISE EXCEPTION '<codigo>' USING ERRCODE = 'P0001'

-- 1. Una ficha oculta deja de ser pública (sigue visible para su inmobiliaria y la plataforma) ----
DROP POLICY property_read ON property;
--> statement-breakpoint
CREATE POLICY property_read ON property FOR SELECT TO app_user USING (
  (status IN ('active', 'reserved', 'sold_rented') AND moderation_status = 'ok' AND app_agency_is_approved(agency_id))
  OR app_can_manage(agency_id, agent_id)
);
--> statement-breakpoint
-- Una ficha oculta no se puede borrar para esquivar la moderación (solo la plataforma).
DROP POLICY property_delete ON property;
--> statement-breakpoint
CREATE POLICY property_delete ON property FOR DELETE TO app_user
  USING (app_can_manage(agency_id, agent_id) AND status IN ('draft', 'paused')
         AND (moderation_status = 'ok' OR app_is_platform_admin()));
--> statement-breakpoint

-- 2. Las columnas de moderación solo cambian a través de app_moderate_property ----------------------
CREATE OR REPLACE FUNCTION property_moderation_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_is_app_user() THEN RETURN NEW; END IF; -- dueño/scripts
  IF TG_OP = 'INSERT' THEN
    NEW.moderation_status := 'ok'; NEW.moderation_reason := NULL; NEW.moderated_at := NULL; NEW.moderated_by := NULL;
  ELSIF coalesce(current_setting('app.moderating', true), '') <> '1' THEN
    NEW.moderation_status := OLD.moderation_status; NEW.moderation_reason := OLD.moderation_reason;
    NEW.moderated_at := OLD.moderated_at; NEW.moderated_by := OLD.moderated_by;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER property_moderation_guard_trg BEFORE INSERT OR UPDATE ON property FOR EACH ROW EXECUTE FUNCTION property_moderation_guard();
--> statement-breakpoint

-- 3. Ocultar / restituir una ficha ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION moderation_apply(p_property uuid, p_hide boolean, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old text; v_agency uuid;
BEGIN
  IF NOT app_is_platform_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001'; END IF;
  IF p_hide AND length(trim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'validation' USING ERRCODE = 'P0001'; END IF;
  IF length(coalesce(p_reason, '')) > 500 THEN RAISE EXCEPTION 'validation' USING ERRCODE = 'P0001'; END IF;
  SELECT moderation_status, agency_id INTO v_old, v_agency FROM property WHERE id = p_property FOR UPDATE;
  IF v_old IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
  IF NOT coalesce((p_hide AND v_old = 'ok') OR (NOT p_hide AND v_old = 'hidden'), false) THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('app.moderating', '1', true);
  UPDATE property SET
    moderation_status = CASE WHEN p_hide THEN 'hidden' ELSE 'ok' END,
    moderation_reason = CASE WHEN p_hide THEN trim(p_reason) ELSE NULL END,
    moderated_at = now(), moderated_by = app_uid()
  WHERE id = p_property;
  PERFORM set_config('app.moderating', '', true);
  INSERT INTO audit_log (actor_id, agency_id, action, entity, entity_id, detail)
    VALUES (app_uid(), v_agency, CASE WHEN p_hide THEN 'property.hide' ELSE 'property.unhide' END, 'property', p_property,
            nullif(trim(coalesce(p_reason, '')), ''));
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_moderate_property(p_property uuid, p_hide boolean, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM moderation_apply(p_property, p_hide, p_reason);
  -- ocultar por decisión propia también cierra las denuncias abiertas de esa ficha
  IF p_hide THEN
    UPDATE property_report SET status = 'actioned', resolved_by = app_uid(), resolved_at = now(),
      resolution_note = 'Ficha ocultada'
    WHERE property_id = p_property AND status = 'open';
  END IF;
END $$;
--> statement-breakpoint

-- 4. Denuncias ----------------------------------------------------------------------------------
ALTER TABLE property_report ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT INSERT ON property_report TO app_user;
--> statement-breakpoint
GRANT SELECT ON property_report TO app_user;
--> statement-breakpoint
-- Cualquiera (con o sin cuenta) denuncia una ficha que puede ver; no puede escribir la resolución.
CREATE POLICY report_insert ON property_report FOR INSERT TO app_user WITH CHECK (
  status = 'open' AND resolved_by IS NULL AND resolved_at IS NULL AND resolution_note IS NULL
  AND (user_id IS NULL OR user_id = app_uid())
  AND EXISTS (SELECT 1 FROM property p WHERE p.id = property_id)
);
--> statement-breakpoint
CREATE POLICY report_read ON property_report FOR SELECT TO app_user USING (app_is_platform_admin());
--> statement-breakpoint
-- Tope por huella de IP / usuario (la base lo hace cumplir aunque alguien salte la app).
CREATE OR REPLACE FUNCTION report_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.ip_hash IS NOT NULL AND (SELECT count(*) FROM property_report
        WHERE ip_hash = NEW.ip_hash AND created_at > now() - interval '1 hour') >= 5)
     OR (NEW.user_id IS NOT NULL AND (SELECT count(*) FROM property_report
        WHERE user_id = NEW.user_id AND created_at > now() - interval '1 hour') >= 5) THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER report_guard_trg BEFORE INSERT ON property_report FOR EACH ROW EXECUTE FUNCTION report_guard();
--> statement-breakpoint
-- Resolver: descartar, u ocultar la ficha (cierra todas las denuncias abiertas de esa ficha).
CREATE OR REPLACE FUNCTION app_resolve_report(p_report uuid, p_action text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prop uuid; v_status text; v_agency uuid;
BEGIN
  IF NOT app_is_platform_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001'; END IF;
  IF p_action NOT IN ('dismiss', 'hide') OR length(coalesce(p_note, '')) > 500 THEN RAISE EXCEPTION 'validation' USING ERRCODE = 'P0001'; END IF;
  SELECT property_id, status INTO v_prop, v_status FROM property_report WHERE id = p_report FOR UPDATE;
  IF v_prop IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
  IF v_status <> 'open' THEN RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001'; END IF;
  SELECT agency_id INTO v_agency FROM property WHERE id = v_prop;

  IF p_action = 'hide' THEN
    PERFORM moderation_apply(v_prop, true, coalesce(nullif(trim(p_note), ''), 'Denuncia confirmada'));
    UPDATE property_report SET status = 'actioned', resolved_by = app_uid(), resolved_at = now(), resolution_note = nullif(trim(p_note), '')
      WHERE property_id = v_prop AND status = 'open';
  ELSE
    UPDATE property_report SET status = 'dismissed', resolved_by = app_uid(), resolved_at = now(), resolution_note = nullif(trim(p_note), '')
      WHERE id = p_report;
  END IF;
  INSERT INTO audit_log (actor_id, agency_id, action, entity, entity_id, detail)
    VALUES (app_uid(), v_agency, 'report.' || p_action, 'property_report', p_report, nullif(trim(coalesce(p_note, '')), ''));
END $$;
--> statement-breakpoint

-- 5. Registro de acciones (solo la plataforma lo lee) ----------------------------------------------
CREATE OR REPLACE FUNCTION app_list_audit(p_limit int DEFAULT 50, p_offset int DEFAULT 0, p_prefix text DEFAULT NULL)
RETURNS TABLE (id uuid, at timestamptz, action text, entity text, entity_id uuid, detail text,
               actor_email text, agency_name text, total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_is_platform_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001'; END IF;
  RETURN QUERY
    SELECT l.id, l.at, l.action, l.entity, l.entity_id, l.detail, u.email, a.name,
           count(*) OVER () AS total
    FROM audit_log l
    LEFT JOIN user_profile u ON u.id = l.actor_id
    LEFT JOIN agency a ON a.id = l.agency_id
    WHERE p_prefix IS NULL OR l.action LIKE p_prefix || '%'
    ORDER BY l.at DESC, l.id DESC
    LIMIT least(greatest(p_limit, 1), 200) OFFSET greatest(p_offset, 0);
END $$;
--> statement-breakpoint

-- 6. Permisos de ejecución (nada para PUBLIC/anon/authenticated) -------------------------------------
REVOKE ALL ON FUNCTION property_moderation_guard(), report_guard(), moderation_apply(uuid, boolean, text),
  app_moderate_property(uuid, boolean, text), app_resolve_report(uuid, text, text),
  app_list_audit(int, int, text) FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION property_moderation_guard(), report_guard(), moderation_apply(uuid, boolean, text),
      app_moderate_property(uuid, boolean, text), app_resolve_report(uuid, text, text), app_list_audit(int, int, text) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION property_moderation_guard(), report_guard(), moderation_apply(uuid, boolean, text),
      app_moderate_property(uuid, boolean, text), app_resolve_report(uuid, text, text), app_list_audit(int, int, text) FROM authenticated;
  END IF;
END $$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_moderate_property(uuid, boolean, text), app_resolve_report(uuid, text, text),
  app_list_audit(int, int, text) TO app_user;
