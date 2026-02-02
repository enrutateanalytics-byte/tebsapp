
# Plan: App para Conductores

## Resumen

Vamos a crear una app completa para conductores que les permita:
- Iniciar sesion con su propio usuario y contrasena
- Ver las rutas asignadas a su unidad
- Visualizar el recorrido en mapa con GPS en tiempo real
- Controlar inicio y fin de viajes
- Registrar pasajeros mediante escaneo de codigo QR

---

## Arquitectura General

```text
+------------------+     +-------------------+     +------------------+
|   App Conductor  | --> |   Base de Datos   | <-- |  Panel Admin     |
|   /driver-app    |     |   (misma BD)      |     |  (existente)     |
+------------------+     +-------------------+     +------------------+
        |                        |
        v                        v
  [GPS Nativo]           [Datos compartidos]
  [Camara QR]            - Rutas
                         - Unidades
                         - Asignaciones
                         - Pasajeros (nuevo)
```

---

## Nuevos Componentes

### 1. Sistema de Autenticacion para Conductores

Similar al sistema de `client_users`, crearemos:

| Elemento | Descripcion |
|----------|-------------|
| Tabla `drivers` | Almacena datos del conductor vinculado a auth.users |
| Edge Function `create-driver` | Permite a admins crear cuentas de conductores |
| Pagina `/driver-login` | Login exclusivo para conductores |
| Pagina `/driver-app` | Vista principal de la app del conductor |

### 2. Control de Viajes

Modificaciones a la tabla `assignments`:

| Campo nuevo | Tipo | Descripcion |
|-------------|------|-------------|
| `actual_start_time` | timestamp | Hora real de inicio del viaje |
| `actual_end_time` | timestamp | Hora real de fin del viaje |
| `started_by_driver_id` | uuid | Conductor que inicio el viaje |
| `driver_id` | uuid | Conductor asignado (opcional) |

### 3. Registro de Pasajeros

Nueva tabla `passenger_boardings`:

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | uuid | Identificador unico |
| `assignment_id` | uuid | Viaje en el que aborda |
| `passenger_qr_code` | text | Codigo QR escaneado |
| `boarded_at` | timestamp | Fecha y hora de abordaje |
| `driver_id` | uuid | Conductor que registro |
| `route_id` | uuid | Ruta del viaje |
| `client_id` | uuid | Cliente al que pertenece el pasajero |
| `is_valid` | boolean | Si el QR es valido para esta ruta |

### 4. Codigos QR de Pasajeros

Nueva tabla `passenger_qr_codes`:

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | uuid | Identificador unico |
| `client_id` | uuid | Cliente/empresa |
| `employee_name` | text | Nombre del empleado |
| `employee_id` | text | ID del empleado (opcional) |
| `qr_code` | text | Codigo unico del QR |
| `allowed_routes` | uuid[] | Rutas permitidas para este pasajero |
| `is_active` | boolean | Si esta activo |

---

## Flujo de Usuario

### Login del Conductor

1. Conductor abre `/driver-login`
2. Ingresa usuario y contrasena
3. Sistema valida que sea un conductor activo
4. Redirige a `/driver-app`

### Ver Rutas Asignadas

1. La app muestra listado de asignaciones para HOY
2. Cada tarjeta muestra:
   - Nombre de la ruta
   - Cliente
   - Horario del turno
   - Estado: Pendiente / En curso / Finalizado

### Iniciar Viaje

1. Conductor selecciona una ruta pendiente
2. Toca "Iniciar Viaje"
3. Se registra `actual_start_time` en la asignacion
4. Estado cambia a "En curso"
5. Se activa el mapa con GPS

### Registrar Pasajeros

1. Conductor toca "Escanear QR"
2. Se abre la camara del dispositivo
3. Al escanear:
   - Sistema valida el codigo
   - Verifica que corresponda a esa ruta
   - Registra el abordaje
4. Muestra contador de pasajeros abordados

### Finalizar Viaje

1. Conductor toca "Finalizar Viaje"
2. Se registra `actual_end_time`
3. Estado cambia a "Finalizado"
4. Muestra resumen del viaje (pasajeros, duracion)

---

## Paginas a Crear

| Ruta | Descripcion |
|------|-------------|
| `/driver-login` | Pantalla de inicio de sesion |
| `/driver-app` | Vista principal con lista de rutas |
| `/driver-app/trip/:id` | Vista de viaje activo con mapa y escaneo QR |

---

## Componentes React

| Componente | Ubicacion | Funcion |
|------------|-----------|---------|
| `DriverLogin.tsx` | `src/pages/` | Pantalla de login |
| `DriverApp.tsx` | `src/pages/` | App principal |
| `DriverTripView.tsx` | `src/pages/` | Vista de viaje activo |
| `DriverAssignmentCard.tsx` | `src/components/driver/` | Tarjeta de asignacion |
| `DriverRouteMap.tsx` | `src/components/driver/` | Mapa con GPS del conductor |
| `QRScanner.tsx` | `src/components/driver/` | Componente de escaneo QR |
| `PassengerCounter.tsx` | `src/components/driver/` | Contador de pasajeros |

---

## Edge Functions

| Funcion | Accion |
|---------|--------|
| `create-driver` | Crear cuenta de conductor (solo admins) |
| `reset-driver-password` | Restablecer contrasena |

---

## Gestion de Conductores en Admin

Agregaremos una nueva seccion en el panel de administracion:

- Listado de conductores
- Crear/editar/eliminar conductores
- Asignar conductor a unidad (opcional)
- Restablecer contrasenas

---

## Modo Offline (consideracion futura)

Para el modo offline se recomienda:
- Guardar datos en IndexedDB/localStorage
- Cola de sincronizacion cuando hay conexion
- Indicador visual de estado de conexion

**Nota**: Esta funcionalidad se implementara como fase 2 para mantener el alcance inicial manejable.

---

## Seccion Tecnica

### Migraciones SQL

**1. Tabla drivers**
```sql
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text,
  email text NOT NULL,
  unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**2. Modificaciones a assignments**
```sql
ALTER TABLE public.assignments
  ADD COLUMN driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  ADD COLUMN actual_start_time timestamptz,
  ADD COLUMN actual_end_time timestamptz,
  ADD COLUMN started_by_driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL;
```

**3. Tabla passenger_qr_codes**
```sql
CREATE TABLE public.passenger_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  employee_name text NOT NULL,
  employee_id text,
  qr_code text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  allowed_route_ids uuid[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**4. Tabla passenger_boardings**
```sql
CREATE TABLE public.passenger_boardings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES assignments(id) ON DELETE CASCADE NOT NULL,
  passenger_qr_id uuid REFERENCES passenger_qr_codes(id) ON DELETE SET NULL,
  qr_code_scanned text NOT NULL,
  route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  boarded_at timestamptz DEFAULT now() NOT NULL,
  is_valid boolean DEFAULT false,
  validation_message text
);
```

**5. Funcion RPC para verificar rol de conductor**
```sql
CREATE OR REPLACE FUNCTION public.is_driver()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.drivers
    WHERE user_id = auth.uid() AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Politicas RLS

- Conductores solo pueden ver sus propias asignaciones
- Conductores solo pueden registrar abordajes en viajes que ellos iniciaron
- Solo admins pueden gestionar conductores y codigos QR

### Dependencias adicionales

Para el escaner QR se utilizara `html5-qrcode`, una libreria ligera que funciona bien con Capacitor:
```bash
npm install html5-qrcode
```

### Estructura de archivos nuevos

```text
src/
  pages/
    DriverLogin.tsx
    DriverApp.tsx
    DriverTripView.tsx
  components/
    driver/
      DriverAssignmentCard.tsx
      DriverRouteMap.tsx
      QRScanner.tsx
      PassengerCounter.tsx
      TripControls.tsx
  hooks/
    useDriverAuth.tsx
supabase/
  functions/
    create-driver/
      index.ts
    reset-driver-password/
      index.ts
```

---

## Orden de Implementacion

1. Crear migraciones de base de datos
2. Crear Edge Function `create-driver`
3. Implementar pagina de login `/driver-login`
4. Crear pagina principal `/driver-app` con lista de asignaciones
5. Implementar control de inicio/fin de viaje
6. Agregar mapa con GPS del conductor
7. Integrar escaner QR y registro de pasajeros
8. Agregar gestion de conductores en panel admin
9. Agregar gestion de codigos QR de pasajeros en admin
