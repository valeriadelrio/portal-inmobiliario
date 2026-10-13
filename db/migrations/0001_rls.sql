-- Row Level Security: segunda barrera de aislamiento entre agencias.
-- Modelo: la app corre cada consulta de datos dentro de una transacción con
--   SET LOCAL ROLE app_user  +  set_config('app.user_id', <uuid>, true)
-- y las políticas derivan rol/agencia DESDE LA BASE (nunca de un valor que diga el cliente).
-- El rol dueño (postgres/portal) salta RLS: solo lo usan migraciones y getActor().

-- 1. Rol sin privilegios para correr las consultas de datos --------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN NOINHERIT;
  END IF;
END $$;
--> statement-breakpoint
GRANT app_user TO CURRENT_USER;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_user;
--> statement-breakpoint

-- 2. Funciones auxiliares (SECURITY DEFINER: leen sin quedar sujetas a RLS) ----------
CREATE OR REPLACE FUNCTION app_uid() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_platform_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profile
    WHERE id = app_uid() AND platform_role = 'platform_admin' AND disabled_at IS NULL
  ) $$;
--> statement-breakpoint
-- Membresía vigente: miembro activo, usuario habilitado y agencia aprobada.
CREATE OR REPLACE FUNCTION app_member_agency() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.agency_id FROM agency_member m
  JOIN agency a ON a.id = m.agency_id AND a.status = 'approved'
  JOIN user_profile u ON u.id = m.user_id AND u.disabled_at IS NULL
  WHERE m.user_id = app_uid() AND m.status = 'active' $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_member_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id FROM agency_member m
  JOIN agency a ON a.id = m.agency_id AND a.status = 'approved'
  JOIN user_profile u ON u.id = m.user_id AND u.disabled_at IS NULL
  WHERE m.user_id = app_uid() AND m.status = 'active' $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_member_role() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role FROM agency_member m
  JOIN agency a ON a.id = m.agency_id AND a.status = 'approved'
  JOIN user_profile u ON u.id = m.user_id AND u.disabled_at IS NULL
  WHERE m.user_id = app_uid() AND m.status = 'active' $$;
--> statement-breakpoint
-- ¿Puede el usuario actual administrar esta fila de una agencia, asignada a este agente?
CREATE OR REPLACE FUNCTION app_can_manage(p_agency uuid, p_agent uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_is_platform_admin() OR (
    p_agency IS NOT NULL AND p_agency = app_member_agency()
    AND (app_member_role() = 'agency_admin' OR p_agent = app_member_id())
  ) $$;
--> statement-breakpoint
-- El agente asignado debe pertenecer a la misma agencia (evita asignar a ajenos).
CREATE OR REPLACE FUNCTION app_agent_in_agency(p_agent uuid, p_agency uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM agency_member WHERE id = p_agent AND agency_id = p_agency AND status = 'active') $$;
--> statement-breakpoint
-- ¿Puede escribir sobre la propiedad (y la agencia declarada coincide con la real)?
CREATE OR REPLACE FUNCTION app_can_write_property(p_property uuid, p_agency uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM property p
    WHERE p.id = p_property AND p.agency_id = p_agency AND app_can_manage(p.agency_id, p.agent_id)
  ) $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_agency_is_approved(p_agency uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM agency WHERE id = p_agency AND status = 'approved') $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_uid(), app_is_platform_admin(), app_member_agency(), app_member_id(),
  app_member_role(), app_can_manage(uuid, uuid), app_agent_in_agency(uuid, uuid),
  app_can_write_property(uuid, uuid), app_agency_is_approved(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_uid(), app_is_platform_admin(), app_member_agency(), app_member_id(),
  app_member_role(), app_can_manage(uuid, uuid), app_agent_in_agency(uuid, uuid),
  app_can_write_property(uuid, uuid), app_agency_is_approved(uuid) TO app_user;
--> statement-breakpoint

-- 3. RLS ACTIVADA EN TODAS LAS TABLAS ----------------------------------------------------
-- Importante en Supabase: sin RLS, las tablas del esquema public quedan expuestas por la
-- API REST a quien tenga la clave publishable. Con RLS y sin políticas para anon/authenticated
-- no pueden leer ni escribir nada.
ALTER TABLE agency            ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE user_profile      ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE agency_member     ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE zone              ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE property          ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE property_building ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE property_lot      ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE property_photo    ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE inquiry           ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE favorite          ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_log         ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- 4. Privilegios mínimos (defensa en profundidad, además de RLS) --------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
  END IF;
END $$;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_user;
--> statement-breakpoint
GRANT SELECT ON agency, agency_member, zone, property, property_building, property_lot,
  property_photo, inquiry, favorite, user_profile TO app_user;
--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON property, property_building, property_lot, property_photo,
  agency_member, favorite TO app_user;
--> statement-breakpoint
GRANT INSERT, UPDATE ON inquiry TO app_user;
--> statement-breakpoint
-- Columnas sensibles (estado de aprobación, rol de plataforma) NO se pueden actualizar con app_user.
GRANT UPDATE (name, logo_url, description, phone, email, website, address, updated_at) ON agency TO app_user;
--> statement-breakpoint
GRANT UPDATE (full_name, phone, locale, updated_at) ON user_profile TO app_user;
--> statement-breakpoint
-- audit_log: sin acceso para app_user.

-- 5. Políticas -----------------------------------------------------------------------------
-- zone: lectura pública
CREATE POLICY zone_read ON zone FOR SELECT TO app_user USING (true);
--> statement-breakpoint

-- agency: públicas las aprobadas; los miembros ven la suya; platform admin ve todas
CREATE POLICY agency_read ON agency FOR SELECT TO app_user USING (
  status = 'approved' OR id = app_member_agency() OR app_is_platform_admin()
);
--> statement-breakpoint
CREATE POLICY agency_update ON agency FOR UPDATE TO app_user
  USING (id = app_member_agency() AND app_member_role() = 'agency_admin')
  WITH CHECK (id = app_member_agency() AND app_member_role() = 'agency_admin');
--> statement-breakpoint

-- user_profile: solo el propio (o platform admin). Los emails NO son públicos.
CREATE POLICY user_profile_read ON user_profile FOR SELECT TO app_user USING (
  id = app_uid() OR app_is_platform_admin()
);
--> statement-breakpoint
CREATE POLICY user_profile_update ON user_profile FOR UPDATE TO app_user
  USING (id = app_uid()) WITH CHECK (id = app_uid());
--> statement-breakpoint

-- agency_member: públicos los activos de agencias aprobadas (ficha del agente);
-- el admin de agencia ve todos los de su agencia; cada uno ve el propio.
CREATE POLICY member_read ON agency_member FOR SELECT TO app_user USING (
  user_id = app_uid()
  OR (status = 'active' AND app_agency_is_approved(agency_id))
  OR (agency_id = app_member_agency() AND app_member_role() = 'agency_admin')
  OR app_is_platform_admin()
);
--> statement-breakpoint
CREATE POLICY member_write ON agency_member FOR ALL TO app_user
  USING (app_is_platform_admin() OR (agency_id = app_member_agency() AND app_member_role() = 'agency_admin'))
  WITH CHECK (app_is_platform_admin() OR (agency_id = app_member_agency() AND app_member_role() = 'agency_admin'));
--> statement-breakpoint

-- property
CREATE POLICY property_read ON property FOR SELECT TO app_user USING (
  (status IN ('active', 'reserved', 'sold_rented') AND app_agency_is_approved(agency_id))
  OR app_can_manage(agency_id, agent_id)
);
--> statement-breakpoint
CREATE POLICY property_insert ON property FOR INSERT TO app_user WITH CHECK (
  app_can_manage(agency_id, agent_id) AND app_agent_in_agency(agent_id, agency_id)
);
--> statement-breakpoint
CREATE POLICY property_update ON property FOR UPDATE TO app_user
  USING (app_can_manage(agency_id, agent_id))
  WITH CHECK (app_can_manage(agency_id, agent_id) AND app_agent_in_agency(agent_id, agency_id));
--> statement-breakpoint
CREATE POLICY property_delete ON property FOR DELETE TO app_user USING (app_can_manage(agency_id, agent_id));
--> statement-breakpoint

-- property_building / property_lot: leer lo que se ve de la propiedad; escribir si se puede escribir
CREATE POLICY building_read ON property_building FOR SELECT TO app_user
  USING (EXISTS (SELECT 1 FROM property p WHERE p.id = property_id));
--> statement-breakpoint
CREATE POLICY building_write ON property_building FOR ALL TO app_user
  USING (EXISTS (SELECT 1 FROM property p WHERE p.id = property_id AND app_can_manage(p.agency_id, p.agent_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM property p WHERE p.id = property_id AND app_can_manage(p.agency_id, p.agent_id)));
--> statement-breakpoint
CREATE POLICY lot_read ON property_lot FOR SELECT TO app_user
  USING (EXISTS (SELECT 1 FROM property p WHERE p.id = property_id));
--> statement-breakpoint
CREATE POLICY lot_write ON property_lot FOR ALL TO app_user
  USING (EXISTS (SELECT 1 FROM property p WHERE p.id = property_id AND app_can_manage(p.agency_id, p.agent_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM property p WHERE p.id = property_id AND app_can_manage(p.agency_id, p.agent_id)));
--> statement-breakpoint

-- property_photo: agency_id declarado debe coincidir con el de la propiedad
CREATE POLICY photo_read ON property_photo FOR SELECT TO app_user
  USING (EXISTS (SELECT 1 FROM property p WHERE p.id = property_id));
--> statement-breakpoint
CREATE POLICY photo_write ON property_photo FOR ALL TO app_user
  USING (app_can_write_property(property_id, agency_id))
  WITH CHECK (app_can_write_property(property_id, agency_id));
--> statement-breakpoint

-- inquiry: cualquiera puede consultar una ficha pública (sin RETURNING); solo el destinatario / admin de agencia la lee
CREATE POLICY inquiry_read ON inquiry FOR SELECT TO app_user USING (app_can_manage(agency_id, agent_id));
--> statement-breakpoint
CREATE POLICY inquiry_insert ON inquiry FOR INSERT TO app_user WITH CHECK (
  (user_id IS NULL OR user_id = app_uid())
  AND EXISTS (
    SELECT 1 FROM property p
    WHERE p.id = property_id AND p.agency_id = inquiry.agency_id AND p.agent_id = inquiry.agent_id
      AND p.status IN ('active', 'reserved')
  )
);
--> statement-breakpoint
CREATE POLICY inquiry_update ON inquiry FOR UPDATE TO app_user
  USING (app_can_manage(agency_id, agent_id)) WITH CHECK (app_can_manage(agency_id, agent_id));
--> statement-breakpoint

-- favorite: solo los propios
CREATE POLICY favorite_own ON favorite FOR ALL TO app_user
  USING (user_id = app_uid()) WITH CHECK (user_id = app_uid());
