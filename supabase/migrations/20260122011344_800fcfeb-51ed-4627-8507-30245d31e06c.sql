-- Función SECURITY DEFINER para registrar primer admin
CREATE OR REPLACE FUNCTION public.register_first_admin(
  p_user_id UUID,
  p_email TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  -- Contar administradores existentes
  SELECT COUNT(*) INTO admin_count FROM public.administrators;
  
  -- Solo insertar si no hay administradores
  IF admin_count = 0 THEN
    INSERT INTO public.administrators (user_id, email)
    VALUES (p_user_id, p_email);
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Agregar a gina@enrutate.com como administrador
INSERT INTO public.administrators (user_id, email)
VALUES ('486485e4-1938-48fc-a1d0-3d01f4770d2a', 'gina@enrutate.com');