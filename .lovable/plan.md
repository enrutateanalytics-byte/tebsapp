# Agregar filtros por turno y cliente en Asignaciones

## Objetivo
En `/assignments` permitir filtrar la lista de asignaciones por **turno** y por **cliente**, además del buscador de texto existente.

## Cambios

### 1. Enriquecer la consulta de asignaciones

En `src/pages/Assignments.tsx`, modificar el `select` del query `assignments` para traer también `client_id` y el nombre del cliente de la ruta:

```text
.select('*, routes!inner(name, client_id, clients(name)), units(plate_number, driver_name), drivers!assignments_driver_id_fkey(name)')
```

Actualizar el interface `Assignment` para reflejar la nueva estructura:

```text
routes?: {
  name: string;
  client_id: string | null;
  clients?: { name: string } | null;
} | null;
```

### 2. Agregar estados de filtro

Agregar dos estados nuevos junto a `searchQuery`:

```text
const [shiftFilter, setShiftFilter] = useState<ShiftId | '__all__'>('__all__');
const [clientFilter, setClientFilter] = useState<string>('__all__');
```

### 3. Cargar lista de clientes

Agregar un query que traiga `id, name` de `clients` ordenados por nombre, reutilizable para el filtro (similar al query de `routes`).

### 4. Actualizar la lógica de filtrado

Extender `filteredAssignments` para que aplique, además del texto, los nuevos filtros:

- **Turno**: comparar `assignment.start_time` y `assignment.end_time` con el turno seleccionado usando `getShiftFromTimes`. Si el filtro es `"__all__"`, no filtrar por turno.
- **Cliente**: comparar `assignment.routes?.client_id` con el ID seleccionado. Si el filtro es `"__all__"`, no filtrar por cliente.

### 5. Agregar controles de filtro en la interfaz

Sobre la lista, agregar una fila de controles responsive:

- Buscador de texto existente (placeholder actualizado a "Buscar ruta, unidad o conductor...").
- Select de turno con opciones: "Todos los turnos", Mañana, Tarde, Noche, Turno Completo.
- Select/buscar cliente con opciones: "Todos los clientes" + lista de clientes activos.

En pantallas pequeños los controles se apilan verticalmente; en escritorio se muestran en línea.

### 6. Mostrar cliente en los resultados

Agregar una columna "Cliente" en la tabla de escritorio y mostrar el nombre del cliente en la tarjeta móvil, debajo de la ruta, para que el filtro tenga sentido visual.

## Detalles técnicos
- No se requieren cambios en base de datos.
- El filtrado es cliente-side, usando los datos ya cargados por `useQuery`.
- Se usa el componente `Select` existente de shadcn/ui para turno y `SearchableSelect` para cliente (más útil si hay muchos clientes).
- Se mantiene la búsqueda de texto insensible a mayúsculas/minúsculas.
