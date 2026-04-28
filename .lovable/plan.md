## Problema

Al intentar eliminar una asignación en `/assignments`, aparece el error:

> Error: canceling statement due to statement timeout

**Causa raíz:** La tabla `gps_positions` contiene **16,838,455 registros** y su columna `assignment_id` **no tiene índice**. Cuando se ejecuta el `DELETE` sobre `assignments`, Postgres realiza operaciones (validaciones / consultas relacionadas) que escanean toda esa tabla, superando el límite de tiempo permitido (~8 segundos en Supabase).

## Solución

### 1. Crear índice en `gps_positions.assignment_id` (migración)

Esto hace que cualquier consulta o validación que involucre `assignment_id` sea casi instantánea, en lugar de escanear millones de filas.

```sql
CREATE INDEX IF NOT EXISTS idx_gps_positions_assignment_id
  ON public.gps_positions (assignment_id);
```

### 2. Crear una función RPC `delete_assignment_safely` (migración)

Una función `SECURITY DEFINER` que:
- Verifica que el usuario sea administrador (o supervisor con permiso sobre el cliente de la ruta).
- Primero hace `UPDATE gps_positions SET assignment_id = NULL WHERE assignment_id = $1` (rápido gracias al nuevo índice). Esto preserva el histórico GPS pero lo desvincula.
- Luego hace `DELETE FROM assignments WHERE id = $1`.
- Devuelve `true` en éxito.

De esta manera el borrado se vuelve atómico, rápido y no se pierden datos GPS históricos (solo dejan de estar asociados a la asignación borrada).

### 3. Actualizar el frontend (`src/pages/Assignments.tsx`)

Cambiar el `deleteMutation` para llamar a la nueva función RPC en lugar de `.delete()` directo:

```ts
const { error } = await supabase.rpc('delete_assignment_safely', { p_id: id });
```

## Resultado esperado

- El botón "Eliminar" en `/assignments` funciona correctamente, tanto en la vista móvil como en la de escritorio.
- Las posiciones GPS históricas se conservan en la base de datos (con `assignment_id = NULL`), de modo que no se pierde información operativa pasada.
- Cualquier consulta futura que filtre `gps_positions` por `assignment_id` también se beneficiará del nuevo índice.

## Notas técnicas

- El índice se crea con `IF NOT EXISTS` para que sea idempotente.
- La función RPC respetará los mismos permisos que las políticas RLS actuales (admin o supervisor del cliente correspondiente).
- No se elimina ni modifica ninguna otra política de seguridad.
