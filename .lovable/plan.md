
# Plan: Configurar App Nativa con Capacitor

## Resumen

Vamos a configurar tu proyecto existente para que pueda compilarse como una app nativa para Android e iOS usando Capacitor. Tu app actual ya tiene una vista publica optimizada para moviles (`/app`) que sera perfecta como punto de entrada de la app movil.

---

## Que es Capacitor?

Capacitor es una herramienta que permite empaquetar tu aplicacion web como una app nativa. Tu codigo React seguira siendo el mismo, pero podra ejecutarse dentro de una app real que se puede publicar en App Store y Google Play.

---

## Pasos que Lovable realizara

### 1. Instalar dependencias de Capacitor

Se agregaran los siguientes paquetes:
- `@capacitor/core` - Nucleo de Capacitor
- `@capacitor/cli` - Herramienta de linea de comandos
- `@capacitor/ios` - Soporte para iOS
- `@capacitor/android` - Soporte para Android

### 2. Crear archivo de configuracion

Se creara `capacitor.config.ts` con:
- **appId**: `app.lovable.9a6495a750ba4666955c20882df3fa9a`
- **appName**: `tebsapp`
- **URL del servidor**: Apuntando al preview de Lovable para desarrollo con hot-reload

### 3. Optimizar index.html para moviles

Se agregaran meta tags necesarios para apps nativas:
- Viewport optimizado para iOS
- Configuracion de safe areas para notch y barras
- Prevencion de zoom en inputs
- Status bar configuration

### 4. Agregar estilos para safe areas

Se actualizara `index.css` con clases CSS para manejar las areas seguras del dispositivo (notch, barra de navegacion, etc.)

---

## Pasos que TU deberas realizar (en tu computadora)

Una vez que Lovable complete los cambios, deberas:

### Requisitos previos
- **Para iOS**: Mac con Xcode instalado
- **Para Android**: Android Studio instalado

### Comandos a ejecutar

```bash
# 1. Exportar el proyecto a GitHub (boton "Export to GitHub" en Lovable)

# 2. Clonar el repositorio
git clone [tu-repositorio]
cd [nombre-del-proyecto]

# 3. Instalar dependencias
npm install

# 4. Agregar plataformas nativas
npx cap add ios      # Para iOS
npx cap add android  # Para Android

# 5. Actualizar dependencias nativas
npx cap update ios
npx cap update android

# 6. Compilar el proyecto
npm run build

# 7. Sincronizar con las plataformas nativas
npx cap sync

# 8. Ejecutar en emulador o dispositivo
npx cap run ios      # Abre en Xcode/Simulador
npx cap run android  # Abre en Android Studio/Emulador
```

---

## Flujo de desarrollo con Hot-Reload

Durante el desarrollo, la app movil cargara directamente desde el servidor de Lovable:

```text
+-------------------+          +-------------------+
|   App en celular  |  <--->   |  Lovable Preview  |
|  (iOS/Android)    |          |  (tu codigo web)  |
+-------------------+          +-------------------+
```

Esto significa que cualquier cambio que hagas en Lovable se reflejara automaticamente en la app de tu celular (mientras esten en la misma red).

---

## Para publicar en las tiendas

Cuando estes listo para publicar, deberas:

1. Cambiar la configuracion de `capacitor.config.ts` para que use archivos locales en lugar del servidor
2. Ejecutar `npm run build` y `npx cap sync`
3. Seguir los procesos de publicacion de Apple (App Store Connect) y Google (Play Console)

---

## Notas importantes

- Tu vista publica `/app` ya esta optimizada para moviles, asi que sera la experiencia principal en la app
- La base de datos (Lovable Cloud) seguira siendo la misma, sin cambios
- Puedes agregar funcionalidades nativas despues (camara, notificaciones push, GPS nativo, etc.)

---

## Seccion Tecnica

### Archivos a crear/modificar

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `capacitor.config.ts` | Crear | Configuracion principal de Capacitor |
| `package.json` | Modificar | Agregar dependencias de Capacitor |
| `index.html` | Modificar | Meta tags para app nativa |
| `src/index.css` | Modificar | Estilos para safe areas |

### Configuracion de Capacitor

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.9a6495a750ba4666955c20882df3fa9a',
  appName: 'tebsapp',
  webDir: 'dist',
  server: {
    url: 'https://9a6495a7-50ba-4666-955c-20882df3fa9a.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
```

### Recurso adicional

Para mas informacion sobre el proceso completo, te recomiendo leer la guia oficial de Lovable sobre desarrollo movil con Capacitor.

