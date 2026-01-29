
# Plan: Sistema de Supervisores con Acceso Restringido a Clientes

## Resumen

Crearemos un nuevo tipo de usuario llamado **"Supervisor"** que tendrá acceso completo a todas las funcionalidades del sistema administrativo (Dashboard, Clientes, Rutas, Unidades, Asignaciones, Rastreo GPS), pero **solo podrá ver y gestionar la información de los clientes que le sean asignados**.

## Estructura de la Solución

```text
+------------------+     +-------------------+     +---------+
|   supervisors    |---->| supervisor_clients|<----|  clients|
+------------------+     +-------------------+     +---------+
| id               |     | supervisor_id     |     | id      |
| user_id          |     | client_id         |     | name    |
| email            |     | created_at        |     | ...     |
| name             |     +-------------------+     +---------+
| is_active        |
| created_at       |
+------------------+
```

## Cambios de Base de Datos

### 1. Nueva tabla: `supervisors`
Almacenará los usuarios supervisores (similar a `administrators`)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | Identificador único |
| user_id | uuid | Referencia al usuario en auth.users |
| email | text | Correo electrónico del supervisor |
| name | text | Nombre del supervisor |
| is_active | boolean | Si está activo |
| created_at | timestamp | Fecha de creación |

### 2. Nueva tabla: `supervisor_clients`
Tabla de relación muchos-a-muchos entre supervisores y clientes

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | Identificador único |
| supervisor_id | uuid | Referencia al supervisor |
| client_id | uuid | Referencia al cliente |
| created_at | timestamp | Fecha de asignación |

### 3. Nuevas funciones de base de datos
- `is_supervisor()`: Verificar si el usuario actual es supervisor
- `get_supervisor_client_ids()`: Obtener lista de client_ids asignados al supervisor
- `is_supervisor_or_admin()`: Verificar si es supervisor o administrador

### 4. Políticas RLS actualizadas
Modificar las políticas existentes en todas las tablas para permitir acceso a supervisores con restricción por cliente:
- **clients**: Supervisores solo ven clientes asignados
- **routes**: Supervisores solo ven rutas de sus clientes
- **assignments**: Supervisores solo ven asignaciones de rutas de sus clientes
- **units**: Supervisores ven unidades asignadas a rutas de sus clientes
- **gps_positions**: Supervisores ven posiciones de unidades de sus clientes

## Cambios en el Frontend

### 1. Hook de autenticación (`useAuth.tsx`)
- Agregar estado `isSupervisor`
- Agregar función `checkSupervisorStatus()`
- Exponer los client_ids asignados al supervisor

### 2. Layout del Dashboard (`DashboardLayout.tsx`)
- Permitir acceso a supervisores además de administradores

### 3. Sidebar (`Sidebar.tsx`)
- Mostrar etiqueta "Supervisor" en lugar de "Administrador" según corresponda

### 4. Login (`Login.tsx`)
- Permitir login de supervisores (misma pantalla de admin)

### 5. Todas las páginas de gestión
Las páginas automáticamente mostrarán solo datos permitidos gracias a las políticas RLS. No requieren cambios de código, ya que las queries ya usan RLS.

## Nueva Edge Function

### `create-supervisor`
Función para crear supervisores, similar a `create-admin-user`:
- Recibe: email, password, name
- Crea usuario en auth.users
- Crea registro en tabla `supervisors`
- Solo administradores pueden ejecutarla

## Gestión de Permisos (UI)

### Nueva sección en panel de administración
Agregar página/sección para:
1. Listar supervisores existentes
2. Crear nuevos supervisores
3. Asignar/quitar clientes a cada supervisor
4. Activar/desactivar supervisores

---

## Sección Técnica

### Migración SQL

```sql
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
```

### Políticas RLS para tablas existentes (ejemplos)

```sql
-- clients: supervisores ven solo clientes asignados
CREATE POLICY "Supervisors can view assigned clients"
ON public.clients FOR SELECT
USING (is_supervisor() AND id = ANY(get_supervisor_client_ids()));

-- routes: supervisores ven rutas de sus clientes
CREATE POLICY "Supervisors can view routes of assigned clients"
ON public.routes FOR SELECT
USING (is_supervisor() AND client_id = ANY(get_supervisor_client_ids()));

-- Similar para INSERT, UPDATE, DELETE en cada tabla
```

### Archivos a crear/modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/hooks/useAuth.tsx` | Modificar | Agregar lógica de supervisor |
| `src/components/layout/DashboardLayout.tsx` | Modificar | Permitir supervisores |
| `src/components/layout/Sidebar.tsx` | Modificar | Mostrar rol correcto |
| `src/pages/Supervisors.tsx` | Crear | Gestión de supervisores |
| `supabase/functions/create-supervisor/index.ts` | Crear | Edge function |
| Migración SQL | Crear | Tablas y funciones |
