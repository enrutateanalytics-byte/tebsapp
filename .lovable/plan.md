# Agregar búsqueda por IMEI en el menú de Unidades

## Objetivo
Permitir que el campo de búsqueda en `/units` filtre unidades no solo por placa, marca, modelo y conductor, sino también por IMEI.

## Cambios

### 1. Actualizar `src/pages/Units.tsx`

En la función `filteredUnits`, agregar `unit.imei` como campo de búsqueda:

```text
filteredUnits = units.filter(unit =>
  unit.plate_number.toLowerCase().includes(query) ||
  unit.brand?.toLowerCase().includes(query) ||
  unit.model?.toLowerCase().includes(query) ||
  unit.driver_name?.toLowerCase().includes(query) ||
  unit.imei?.toLowerCase().includes(query)
)
```

### 2. Actualizar placeholder del campo de búsqueda

Cambiar el placeholder actual de "Buscar unidades..." a "Buscar por placa, marca, conductor o IMEI..." para que el usuario sepa que puede buscar por IMEI.

## Detalles técnicos
- No se requieren cambios en la base de datos ni en el backend.
- El filtrado es puramente en el cliente, usando los datos ya cargados por `useQuery`.
- Se mantiene el comportamiento existente de búsqueda insensible a mayúsculas/minúsculas.
