
# Pantalla de Bienvenida en grupotebsa.com

## Objetivo
Crear una pantalla de inicio (landing page) en la ruta raiz `/` que muestre el logo de TEBSA y dos opciones claras para ingresar:
1. **App de Seguimiento** -- redirige a `/public-login`
2. **Panel de Administracion** -- redirige a `/login`

## Cambios

### 1. Actualizar `src/pages/Index.tsx`
Reemplazar el contenido generico por una pantalla de bienvenida con:
- Logo de TEBSA centrado
- Titulo "Sistema de Transporte de Personal"
- Dos tarjetas/botones grandes:
  - **Seguimiento de Rutas** (icono de mapa) -- navega a `/public-login`
  - **Administracion** (icono de candado/settings) -- navega a `/login`
- Enlace a politica de privacidad `/privacidad`
- Diseno responsive y consistente con el estilo actual (Tailwind + shadcn)

### 2. Actualizar `src/App.tsx`
Cambiar la ruta raiz de:
```
<Route path="/" element={<Navigate to="/dashboard" replace />} />
```
a:
```
<Route path="/" element={<Index />} />
```
Esto hara que al visitar grupotebsa.com se muestre la pantalla de seleccion en lugar de redirigir automaticamente al dashboard.

## Detalles tecnicos
- Se reutiliza el logo existente en `src/assets/tebsa-logo.png`
- Se usan componentes `Card` y `Button` de shadcn ya disponibles
- Se usa `useNavigate` de react-router-dom para la navegacion
- Los usuarios ya autenticados como admin/supervisor seguiran accediendo al dashboard desde `/login` (la redireccion automatica ya existe ahi)
