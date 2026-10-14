-- H2.0a: funciones SECURITY DEFINER, políticas y triggers para agencias, invitaciones,
-- zonas, propiedades y fotos. Los errores de negocio se señalan con
--   RAISE EXCEPTION '<codigo>' USING ERRCODE = 'P0001'
-- y los servicios mapean el código (el mensaje ES el código).
-- Los triggers de reglas de negocio solo actúan cuando se corre como app_user
-- (current_setting('role') = 'app_user'); el dueño (migraciones, scripts, seeds) no queda afectado.

-- 0. Utilidades ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER agency_updated_at BEFORE UPDATE ON agency FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER property_updated_at BEFORE UPDATE ON property FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER agency_member_updated_at BEFORE UPDATE ON agency_member FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER user_profile_updated_at BEFORE UPDATE ON user_profile FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_app_user() RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT current_setting('role', true) = 'app_user' $$;
--> statement-breakpoint

-- 1. Alta y aprobación de agencias ------------------------------------------------------
CREATE OR REPLACE FUNCTION app_register_agency(
  p_name text, p_slug text, p_phone text, p_email text, p_display_name text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := app_uid(); v_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM user_profile WHERE id = v_uid AND disabled_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;
  IF length(trim(coalesce(p_name, ''))) < 2 OR length(p_name) > 120
     OR length(trim(coalesce(p_display_name, ''))) < 2 THEN
    RAISE EXCEPTION 'validation' USING ERRCODE = 'P0001';
  END IF;
  IF p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(p_slug) > 60
     OR p_slug IN ('admin','panel','login','api','es','en','registro','registro-agencia','invitacion',
                   'inmobiliarias','propiedades','cuenta','buscar','static','_next') THEN
    RAISE EXCEPTION 'invalid_slug' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM agency_member WHERE user_id = v_uid AND status = 'active') THEN
    RAISE EXCEPTION 'already_member' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM audit_log WHERE actor_id = v_uid AND action = 'agency.register'
      AND at > now() - interval '24 hours') >= 3 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM agency WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'slug_taken' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO agency (name, slug, phone, email, status)
    VALUES (trim(p_name), p_slug, p_phone, p_email, 'pending') RETURNING id INTO v_id;
  INSERT INTO agency_member (agency_id, user_id, role, status, display_name)
    VALUES (v_id, v_uid, 'agency_admin', 'active', trim(p_display_name));
  INSERT INTO audit_log (actor_id, agency_id, action, entity, entity_id)
    VALUES (v_uid, v_id, 'agency.register', 'agency', v_id);
  RETURN v_id;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_set_agency_status(p_agency uuid, p_status text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old text;
BEGIN
  IF NOT app_is_platform_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001'; END IF;
  SELECT status INTO v_old FROM agency WHERE id = p_agency FOR UPDATE;
  IF v_old IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
  IF NOT ((v_old = 'pending'   AND p_status IN ('approved', 'rejected'))
       OR (v_old = 'approved'  AND p_status = 'suspended')
       OR (v_old = 'suspended' AND p_status = 'approved')) THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001';
  END IF;

  UPDATE agency SET status = p_status, status_reason = p_reason,
    approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
    approved_by = CASE WHEN p_status = 'approved' THEN app_uid() ELSE approved_by END
  WHERE id = p_agency;
  -- Una agencia rechazada libera a sus miembros (índice de "una sola agencia activa").
  IF p_status = 'rejected' THEN
    UPDATE agency_member SET status = 'removed' WHERE agency_id = p_agency;
  END IF;
  INSERT INTO audit_log (actor_id, agency_id, action, entity, entity_id)
    VALUES (app_uid(), p_agency, 'agency.' || p_status, 'agency', p_agency);
END $$;
--> statement-breakpoint
-- La agencia del usuario actual SIN exigir que esté aprobada (para ver "pendiente"/"rechazada").
CREATE OR REPLACE FUNCTION app_my_agency() RETURNS TABLE (
  agency_id uuid, name text, slug text, agency_status text, status_reason text, role text, member_id uuid
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.name, a.slug, a.status, a.status_reason, m.role, m.id
  FROM agency_member m JOIN agency a ON a.id = m.agency_id
  WHERE m.user_id = app_uid() AND m.status = 'active' $$;
--> statement-breakpoint

-- 2. Invitaciones ---------------------------------------------------------------------------
ALTER TABLE agency_invitation ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT ON agency_invitation TO app_user;
--> statement-breakpoint
GRANT UPDATE (status) ON agency_invitation TO app_user;
--> statement-breakpoint
CREATE POLICY invitation_read ON agency_invitation FOR SELECT TO app_user USING (
  app_is_platform_admin() OR (agency_id = app_member_agency() AND app_member_role() = 'agency_admin')
);
--> statement-breakpoint
CREATE POLICY invitation_insert ON agency_invitation FOR INSERT TO app_user WITH CHECK (
  agency_id = app_member_agency() AND app_member_role() = 'agency_admin'
  AND status = 'pending' AND invited_by = app_uid() AND accepted_by IS NULL AND accepted_at IS NULL
  AND expires_at > now() AND expires_at <= now() + interval '30 days'
);
--> statement-breakpoint
-- El admin solo puede REVOCAR (aceptar se hace únicamente con app_accept_invitation).
CREATE POLICY invitation_revoke ON agency_invitation FOR UPDATE TO app_user
  USING (agency_id = app_member_agency() AND app_member_role() = 'agency_admin' AND status = 'pending')
  WITH CHECK (status = 'revoked');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_preview_invitation(p_token_hash text)
RETURNS TABLE (agency_name text, email text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.name, i.email, i.role FROM agency_invitation i JOIN agency a ON a.id = i.agency_id
  WHERE i.token_hash = p_token_hash AND i.status = 'pending' AND i.expires_at > now() AND a.status = 'approved' $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_accept_invitation(p_token_hash text, p_display_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := app_uid(); v_inv agency_invitation%ROWTYPE; v_email text; v_member uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001'; END IF;
  IF length(trim(coalesce(p_display_name, ''))) < 2 THEN RAISE EXCEPTION 'validation' USING ERRCODE = 'P0001'; END IF;
  SELECT lower(email) INTO v_email FROM user_profile WHERE id = v_uid AND disabled_at IS NULL;
  IF v_email IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001'; END IF;

  SELECT * INTO v_inv FROM agency_invitation WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR v_inv.status <> 'pending' OR v_inv.expires_at <= now() OR v_inv.email <> v_email
     OR NOT EXISTS (SELECT 1 FROM agency WHERE id = v_inv.agency_id AND status = 'approved') THEN
    RAISE EXCEPTION 'invitation_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM agency_member WHERE user_id = v_uid AND status = 'active') THEN
    RAISE EXCEPTION 'already_member' USING ERRCODE = 'P0001';
  END IF;

  -- Si ya hubo una membresía (p. ej. removida) de esta agencia, se reactiva.
  INSERT INTO agency_member (agency_id, user_id, role, status, display_name)
    VALUES (v_inv.agency_id, v_uid, v_inv.role, 'active', trim(p_display_name))
  ON CONFLICT (agency_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, status = 'active', display_name = EXCLUDED.display_name
  RETURNING id INTO v_member;
  UPDATE agency_invitation SET status = 'accepted', accepted_by = v_uid, accepted_at = now() WHERE id = v_inv.id;
  RETURN v_member;
END $$;
--> statement-breakpoint

-- 3. Miembros: sin INSERT/DELETE directos; rol/estado solo por funciones ------------------
DROP POLICY member_write ON agency_member;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON agency_member FROM app_user;
--> statement-breakpoint
GRANT UPDATE (display_name, bio, photo_url, public_phone, public_whatsapp, public_email, updated_at)
  ON agency_member TO app_user;
--> statement-breakpoint
CREATE POLICY member_update ON agency_member FOR UPDATE TO app_user
  USING (
    (user_id = app_uid() AND status = 'active')
    OR (agency_id = app_member_agency() AND app_member_role() = 'agency_admin')
    OR app_is_platform_admin()
  )
  WITH CHECK (
    (user_id = app_uid() AND status = 'active')
    OR (agency_id = app_member_agency() AND app_member_role() = 'agency_admin')
    OR app_is_platform_admin()
  );
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_set_member_role(p_member uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m agency_member%ROWTYPE;
BEGIN
  IF p_role NOT IN ('agent', 'agency_admin') THEN RAISE EXCEPTION 'validation' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO v_m FROM agency_member WHERE id = p_member FOR UPDATE;
  IF NOT FOUND OR v_m.status <> 'active' THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
  -- coalesce: un no-miembro da NULL en la comparación y NOT NULL no dispararía el IF.
  IF NOT coalesce(app_is_platform_admin() OR (v_m.agency_id = app_member_agency() AND app_member_role() = 'agency_admin'), false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;
  IF v_m.role = 'agency_admin' AND p_role <> 'agency_admin'
     AND NOT EXISTS (SELECT 1 FROM agency_member WHERE agency_id = v_m.agency_id AND role = 'agency_admin'
                     AND status = 'active' AND id <> v_m.id) THEN
    RAISE EXCEPTION 'last_admin' USING ERRCODE = 'P0001';
  END IF;
  UPDATE agency_member SET role = p_role WHERE id = p_member;
  INSERT INTO audit_log (actor_id, agency_id, action, entity, entity_id)
    VALUES (app_uid(), v_m.agency_id, 'member.role.' || p_role, 'agency_member', p_member);
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_remove_member(p_member uuid, p_reassign_to uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m agency_member%ROWTYPE; v_has_work boolean;
BEGIN
  SELECT * INTO v_m FROM agency_member WHERE id = p_member FOR UPDATE;
  IF NOT FOUND OR v_m.status <> 'active' THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
  -- coalesce: un no-miembro da NULL en la comparación y NOT NULL no dispararía el IF.
  IF NOT coalesce(app_is_platform_admin() OR (v_m.agency_id = app_member_agency() AND app_member_role() = 'agency_admin'), false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;
  IF v_m.role = 'agency_admin'
     AND NOT EXISTS (SELECT 1 FROM agency_member WHERE agency_id = v_m.agency_id AND role = 'agency_admin'
                     AND status = 'active' AND id <> v_m.id) THEN
    RAISE EXCEPTION 'last_admin' USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (SELECT 1 FROM property WHERE agent_id = p_member)
      OR EXISTS (SELECT 1 FROM inquiry WHERE agent_id = p_member) INTO v_has_work;
  IF v_has_work THEN
    IF p_reassign_to IS NULL OR p_reassign_to = p_member
       OR NOT EXISTS (SELECT 1 FROM agency_member WHERE id = p_reassign_to AND agency_id = v_m.agency_id AND status = 'active') THEN
      RAISE EXCEPTION 'reassign_required' USING ERRCODE = 'P0001';
    END IF;
    UPDATE property SET agent_id = p_reassign_to WHERE agent_id = p_member;
    UPDATE inquiry  SET agent_id = p_reassign_to WHERE agent_id = p_member;
  END IF;
  UPDATE agency_member SET status = 'removed' WHERE id = p_member;
  INSERT INTO audit_log (actor_id, agency_id, action, entity, entity_id)
    VALUES (app_uid(), v_m.agency_id, 'member.removed', 'agency_member', p_member);
END $$;
--> statement-breakpoint

-- 4. Zonas: escritura solo para platform admin --------------------------------------------
GRANT INSERT, UPDATE, DELETE ON zone TO app_user;
--> statement-breakpoint
CREATE POLICY zone_write ON zone FOR ALL TO app_user
  USING (app_is_platform_admin()) WITH CHECK (app_is_platform_admin());
--> statement-breakpoint
CREATE OR REPLACE FUNCTION zone_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Máximo 2 niveles: el padre no puede tener padre, y una zona con hijas no puede tener padre.
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM zone WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'zone_depth' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM zone WHERE parent_id = NEW.id) THEN
      RAISE EXCEPTION 'zone_depth' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER zone_guard_trg BEFORE INSERT OR UPDATE ON zone FOR EACH ROW EXECUTE FUNCTION zone_guard();
--> statement-breakpoint

-- 5. Propiedades: ciclo de vida, inmutables y reglas de publicación -----------------------
CREATE OR REPLACE FUNCTION property_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok boolean; v_ready int;
BEGIN
  IF NOT app_is_app_user() THEN RETURN NEW; END IF; -- dueño/scripts: sin restricciones de negocio

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001'; END IF;
    NEW.published_at := NULL;
  ELSE
    IF NEW.type <> OLD.type OR NEW.slug <> OLD.slug OR NEW.agency_id <> OLD.agency_id THEN
      RAISE EXCEPTION 'immutable_field' USING ERRCODE = 'P0001';
    END IF;
    NEW.published_at := OLD.published_at;
    IF NEW.status <> OLD.status THEN
      v_ok := (OLD.status = 'draft'       AND NEW.status = 'active')
           OR (OLD.status = 'active'      AND NEW.status IN ('reserved', 'sold_rented', 'paused'))
           OR (OLD.status = 'reserved'    AND NEW.status IN ('active', 'sold_rented', 'paused'))
           OR (OLD.status = 'sold_rented' AND NEW.status IN ('active', 'paused'))
           OR (OLD.status = 'paused'      AND NEW.status = 'active');
      IF NOT v_ok AND NOT app_is_platform_admin() THEN
        RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001';
      END IF;
      NEW.status_changed_at := now();
    END IF;
  END IF;

  IF NEW.zone_id IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.zone_id END)
     AND NOT EXISTS (SELECT 1 FROM zone WHERE id = NEW.zone_id AND is_active) THEN
    RAISE EXCEPTION 'zone_inactive' USING ERRCODE = 'P0001';
  END IF;

  -- Publicar (cualquier cambio hacia 'active'): >= 3 fotos listas, con portada, zona activa, agencia aprobada.
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status <> 'active') THEN
    SELECT count(*) INTO v_ready FROM property_photo WHERE property_id = NEW.id AND status = 'ready';
    IF v_ready < 3
       OR NOT EXISTS (SELECT 1 FROM property_photo WHERE property_id = NEW.id AND status = 'ready' AND is_cover)
       OR NOT EXISTS (SELECT 1 FROM zone WHERE id = NEW.zone_id AND is_active)
       OR NOT EXISTS (SELECT 1 FROM agency WHERE id = NEW.agency_id AND status = 'approved') THEN
      RAISE EXCEPTION 'publish_blocked' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.published_at IS NULL THEN NEW.published_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER property_guard_trg BEFORE INSERT OR UPDATE ON property FOR EACH ROW EXECUTE FUNCTION property_guard();
--> statement-breakpoint
-- Solo se borran borradores o pausadas (las demás se pausan). Con consultas, la FK lo impide.
DROP POLICY property_delete ON property;
--> statement-breakpoint
CREATE POLICY property_delete ON property FOR DELETE TO app_user
  USING (app_can_manage(agency_id, agent_id) AND status IN ('draft', 'paused'));
--> statement-breakpoint

-- Coherencia de tablas hijas (siempre, también para el dueño)
CREATE OR REPLACE FUNCTION property_child_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type text;
BEGIN
  SELECT type INTO v_type FROM property WHERE id = NEW.property_id;
  IF TG_TABLE_NAME = 'property_lot' AND v_type <> 'lot' THEN RAISE EXCEPTION 'wrong_type' USING ERRCODE = 'P0001'; END IF;
  IF TG_TABLE_NAME = 'property_building' AND v_type = 'lot' THEN RAISE EXCEPTION 'wrong_type' USING ERRCODE = 'P0001'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER property_lot_guard BEFORE INSERT OR UPDATE ON property_lot FOR EACH ROW EXECUTE FUNCTION property_child_guard();
--> statement-breakpoint
CREATE TRIGGER property_building_guard BEFORE INSERT OR UPDATE ON property_building FOR EACH ROW EXECUTE FUNCTION property_child_guard();
--> statement-breakpoint

-- 6. Fotos ------------------------------------------------------------------------------------
DROP POLICY photo_read ON property_photo;
--> statement-breakpoint
-- Público: solo fotos listas de fichas visibles. Quien gestiona la propiedad ve también las pendientes.
CREATE POLICY photo_read ON property_photo FOR SELECT TO app_user USING (
  EXISTS (SELECT 1 FROM property p WHERE p.id = property_id)
  AND (status = 'ready' OR app_can_write_property(property_id, agency_id))
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION photo_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM property_photo WHERE property_id = NEW.property_id) >= 30 THEN
      RAISE EXCEPTION 'max_photos' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  -- DELETE: una ficha publicada no puede quedar con < 3 fotos listas ni sin portada.
  IF app_is_app_user() THEN
    SELECT status INTO v_status FROM property WHERE id = OLD.property_id;
    IF v_status IN ('active', 'reserved', 'sold_rented') AND OLD.status = 'ready' THEN
      IF (SELECT count(*) FROM property_photo WHERE property_id = OLD.property_id AND status = 'ready' AND id <> OLD.id) < 3
         OR OLD.is_cover THEN
        RAISE EXCEPTION 'publish_blocked' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;
  RETURN OLD;
END $$;
--> statement-breakpoint
CREATE TRIGGER photo_insert_guard BEFORE INSERT ON property_photo FOR EACH ROW EXECUTE FUNCTION photo_guard();
--> statement-breakpoint
CREATE TRIGGER photo_delete_guard BEFORE DELETE ON property_photo FOR EACH ROW EXECUTE FUNCTION photo_guard();
--> statement-breakpoint

-- 7. Permisos de ejecución --------------------------------------------------------------------
-- En Supabase, las funciones nuevas en public son ejecutables por anon/authenticated (API REST) salvo que se revoque.
DO $$ BEGIN
  REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
  END IF;
END $$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION
  app_uid(), app_is_platform_admin(), app_member_agency(), app_member_id(), app_member_role(),
  app_can_manage(uuid, uuid), app_agent_in_agency(uuid, uuid), app_can_write_property(uuid, uuid),
  app_agency_is_approved(uuid), app_is_app_user(),
  app_register_agency(text, text, text, text, text), app_set_agency_status(uuid, text, text), app_my_agency(),
  app_preview_invitation(text), app_accept_invitation(text, text),
  app_set_member_role(uuid, text), app_remove_member(uuid, uuid)
TO app_user;
