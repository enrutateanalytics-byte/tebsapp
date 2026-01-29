-- Tabla de supervisores
CREATE TABLE public.supervisors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabla de relación supervisor-clientes
CREATE TABLE public.supervisor_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id uuid NOT NULL REFERENCES public.supervisors(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supervisor_id, client_id)
);

-- Habilitar RLS
ALTER TABLE public.supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisor_clients ENABLE ROW LEVEL SECURITY;

-- Función: verificar si es supervisor
CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.supervisors
    WHERE user_id = auth.uid() AND is_active = true
  );
END;
$$;

-- Función: obtener client_ids del supervisor
CREATE OR REPLACE FUNCTION public.get_supervisor_client_ids()
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(array_agg(sc.client_id), ARRAY[]::uuid[])
    FROM public.supervisors s
    JOIN public.supervisor_clients sc ON sc.supervisor_id = s.id
    WHERE s.user_id = auth.uid() AND s.is_active = true
  );
END;
$$;

-- Función combinada: es supervisor o administrador
CREATE OR REPLACE FUNCTION public.is_supervisor_or_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN is_administrator() OR is_supervisor();
END;
$$;

-- ============================================
-- POLÍTICAS RLS PARA supervisors
-- ============================================

-- Administradores pueden ver todos los supervisores
CREATE POLICY "Administrators can view all supervisors"
ON public.supervisors FOR SELECT
USING (is_administrator());

-- Administradores pueden crear supervisores
CREATE POLICY "Administrators can create supervisors"
ON public.supervisors FOR INSERT
WITH CHECK (is_administrator());

-- Administradores pueden actualizar supervisores
CREATE POLICY "Administrators can update supervisors"
ON public.supervisors FOR UPDATE
USING (is_administrator());

-- Administradores pueden eliminar supervisores
CREATE POLICY "Administrators can delete supervisors"
ON public.supervisors FOR DELETE
USING (is_administrator());

-- Supervisores pueden ver su propio registro
CREATE POLICY "Supervisors can view own record"
ON public.supervisors FOR SELECT
USING (user_id = auth.uid());

-- ============================================
-- POLÍTICAS RLS PARA supervisor_clients
-- ============================================

-- Administradores pueden ver todas las asignaciones
CREATE POLICY "Administrators can view all supervisor_clients"
ON public.supervisor_clients FOR SELECT
USING (is_administrator());

-- Administradores pueden crear asignaciones
CREATE POLICY "Administrators can create supervisor_clients"
ON public.supervisor_clients FOR INSERT
WITH CHECK (is_administrator());

-- Administradores pueden eliminar asignaciones
CREATE POLICY "Administrators can delete supervisor_clients"
ON public.supervisor_clients FOR DELETE
USING (is_administrator());

-- Supervisores pueden ver sus propias asignaciones
CREATE POLICY "Supervisors can view own client assignments"
ON public.supervisor_clients FOR SELECT
USING (
  supervisor_id IN (
    SELECT id FROM public.supervisors WHERE user_id = auth.uid()
  )
);

-- ============================================
-- POLÍTICAS RLS ADICIONALES PARA SUPERVISORES EN TABLAS EXISTENTES
-- ============================================

-- clients: supervisores ven solo clientes asignados
CREATE POLICY "Supervisors can view assigned clients"
ON public.clients FOR SELECT
USING (is_supervisor() AND id = ANY(get_supervisor_client_ids()));

-- clients: supervisores pueden actualizar clientes asignados
CREATE POLICY "Supervisors can update assigned clients"
ON public.clients FOR UPDATE
USING (is_supervisor() AND id = ANY(get_supervisor_client_ids()));

-- routes: supervisores ven rutas de sus clientes
CREATE POLICY "Supervisors can view routes of assigned clients"
ON public.routes FOR SELECT
USING (is_supervisor() AND client_id = ANY(get_supervisor_client_ids()));

-- routes: supervisores pueden crear rutas para sus clientes
CREATE POLICY "Supervisors can create routes for assigned clients"
ON public.routes FOR INSERT
WITH CHECK (is_supervisor() AND client_id = ANY(get_supervisor_client_ids()));

-- routes: supervisores pueden actualizar rutas de sus clientes
CREATE POLICY "Supervisors can update routes of assigned clients"
ON public.routes FOR UPDATE
USING (is_supervisor() AND client_id = ANY(get_supervisor_client_ids()));

-- routes: supervisores pueden eliminar rutas de sus clientes
CREATE POLICY "Supervisors can delete routes of assigned clients"
ON public.routes FOR DELETE
USING (is_supervisor() AND client_id = ANY(get_supervisor_client_ids()));

-- assignments: supervisores ven asignaciones de rutas de sus clientes
CREATE POLICY "Supervisors can view assignments of assigned clients"
ON public.assignments FOR SELECT
USING (
  is_supervisor() AND 
  route_id IN (
    SELECT id FROM public.routes 
    WHERE client_id = ANY(get_supervisor_client_ids())
  )
);

-- assignments: supervisores pueden crear asignaciones para rutas de sus clientes
CREATE POLICY "Supervisors can create assignments for assigned clients"
ON public.assignments FOR INSERT
WITH CHECK (
  is_supervisor() AND 
  route_id IN (
    SELECT id FROM public.routes 
    WHERE client_id = ANY(get_supervisor_client_ids())
  )
);

-- assignments: supervisores pueden actualizar asignaciones de sus clientes
CREATE POLICY "Supervisors can update assignments of assigned clients"
ON public.assignments FOR UPDATE
USING (
  is_supervisor() AND 
  route_id IN (
    SELECT id FROM public.routes 
    WHERE client_id = ANY(get_supervisor_client_ids())
  )
);

-- assignments: supervisores pueden eliminar asignaciones de sus clientes
CREATE POLICY "Supervisors can delete assignments of assigned clients"
ON public.assignments FOR DELETE
USING (
  is_supervisor() AND 
  route_id IN (
    SELECT id FROM public.routes 
    WHERE client_id = ANY(get_supervisor_client_ids())
  )
);

-- units: supervisores ven unidades asignadas a rutas de sus clientes
CREATE POLICY "Supervisors can view units of assigned clients"
ON public.units FOR SELECT
USING (
  is_supervisor() AND 
  id IN (
    SELECT a.unit_id FROM assignments a
    JOIN routes r ON a.route_id = r.id
    WHERE r.client_id = ANY(get_supervisor_client_ids())
  )
);

-- gps_positions: supervisores ven posiciones de unidades de sus clientes
CREATE POLICY "Supervisors can view gps_positions of assigned clients"
ON public.gps_positions FOR SELECT
USING (
  is_supervisor() AND 
  unit_id IN (
    SELECT a.unit_id FROM assignments a
    JOIN routes r ON a.route_id = r.id
    WHERE r.client_id = ANY(get_supervisor_client_ids())
  )
);

-- client_users: supervisores ven usuarios de sus clientes
CREATE POLICY "Supervisors can view client_users of assigned clients"
ON public.client_users FOR SELECT
USING (is_supervisor() AND client_id = ANY(get_supervisor_client_ids()));

-- client_users: supervisores pueden crear usuarios para sus clientes
CREATE POLICY "Supervisors can create client_users for assigned clients"
ON public.client_users FOR INSERT
WITH CHECK (is_supervisor() AND client_id = ANY(get_supervisor_client_ids()));

-- client_users: supervisores pueden actualizar usuarios de sus clientes
CREATE POLICY "Supervisors can update client_users of assigned clients"
ON public.client_users FOR UPDATE
USING (is_supervisor() AND client_id = ANY(get_supervisor_client_ids()));

-- client_users: supervisores pueden eliminar usuarios de sus clientes
CREATE POLICY "Supervisors can delete client_users of assigned clients"
ON public.client_users FOR DELETE
USING (is_supervisor() AND client_id = ANY(get_supervisor_client_ids()));