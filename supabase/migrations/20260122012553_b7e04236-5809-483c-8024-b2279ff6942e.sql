-- Eliminar la política restrictiva actual
DROP POLICY IF EXISTS "Administrators can view all admins" ON public.administrators;

-- Crear política PERMISIVA para que administradores puedan ver la tabla
CREATE POLICY "Administrators can view all admins"
ON public.administrators
FOR SELECT
TO authenticated
USING (is_administrator());