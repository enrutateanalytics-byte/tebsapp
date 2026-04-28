-- 1. Índice para acelerar operaciones por assignment_id
CREATE INDEX IF NOT EXISTS idx_gps_positions_assignment_id
  ON public.gps_positions (assignment_id);

-- 2. Función RPC para borrar asignaciones de forma segura
CREATE OR REPLACE FUNCTION public.delete_assignment_safely(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_route_id uuid;
  v_client_id uuid;
BEGIN
  -- Obtener la ruta de la asignación
  SELECT route_id INTO v_route_id
  FROM public.assignments
  WHERE id = p_id;

  IF v_route_id IS NULL THEN
    RAISE EXCEPTION 'Asignación no encontrada';
  END IF;

  -- Verificar permisos: admin o supervisor con cliente asignado
  IF NOT public.is_administrator() THEN
    SELECT client_id INTO v_client_id FROM public.routes WHERE id = v_route_id;

    IF NOT (public.is_supervisor() AND v_client_id = ANY(public.get_supervisor_client_ids())) THEN
      RAISE EXCEPTION 'No tienes permiso para eliminar esta asignación';
    END IF;
  END IF;

  -- Desvincular posiciones GPS (preserva histórico)
  UPDATE public.gps_positions
  SET assignment_id = NULL
  WHERE assignment_id = p_id;

  -- Eliminar la asignación
  DELETE FROM public.assignments WHERE id = p_id;

  RETURN true;
END;
$$;