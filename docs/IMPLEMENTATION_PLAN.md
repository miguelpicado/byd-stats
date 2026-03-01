# Plan de Implantacion: BYD Stats Premium
# Documento Autocontenido para Agente IA

**Generado:** 2026-03-01
**Basado en:** Auditoria AUDIT_2026-03-01.md
**Objetivo:** Corregir todos los issues detectados en la auditoria, organizados en fases incrementales
**Nota global actual:** 62/100 → **Objetivo: 85+/100**

---

## CONTEXTO DEL PROYECTO

**Stack:** React 19.2 + TypeScript 5.9 + Vite 7.2 (PWA) + Capacitor 8 (Android) + Firebase Cloud Functions
**Estructura de carpetas:**
```
byd-stats-premium/
├── src/                          # Frontend React/TS
│   ├── components/               # Componentes UI (~69 archivos)
│   │   ├── cards/                # ChargeCard, TripCard, EstimatedChargeCard...
│   │   ├── common/               # ErrorBoundary, ModalContainer, GlobalListeners
│   │   ├── layout/               # BottomNavigation, DesktopSidebar
│   │   ├── lists/                # VirtualizedTripList, VirtualizedChargeList
│   │   ├── maps/                 # LocationCardMap, TripMap
│   │   ├── modals/               # 20+ modales
│   │   └── settings/             # BydSettings, GoogleSyncSettings, VehicleSettings
│   ├── context/                  # AppContext, CarContext, LayoutContext
│   ├── core/                     # Logica pura: batteryCalculations, dataProcessing, dateUtils, formatters, logger, constants
│   │   └── __tests__/            # 5 test files
│   ├── features/                 # Features del dashboard
│   │   ├── dashboard/            # DashboardLayout, Desktop/MobileDashboardView
│   │   │   └── tabs/             # OverviewTab, ChargesTab, EfficiencyTab, TrendsTab, VehicleTab...
│   │   │       └── dashboard/    # DashboardTab, QuickActions, CarVisualization, LocationCard
│   │   └── navigation/           # Header, MainLayout
│   ├── hooks/                    # 29 hooks custom
│   │   ├── __tests__/            # 3 test files (useChargesData, useSettings, useTrips)
│   │   └── sync/                 # useCloudRegistry, useDriveSync, useGoogleAuth
│   ├── providers/                # DataProvider, TripsProvider, ChargesProvider, FilterProvider, ModalProvider, SyncProvider
│   ├── routes/                   # AppRoutes
│   ├── services/                 # bydApi, firebase, googleDrive, AnomalyService, PredictiveService, StorageService
│   │   └── ai/                   # Modelos TensorFlow
│   ├── workers/                  # tensorflowWorker.ts, dataWorker.ts
│   ├── i18n/                     # Internacionalizacion
│   └── utils/                    # Utilidades + __tests__/validation.test.ts
├── android/                      # App Android nativa (Capacitor)
│   └── app/src/main/java/com/bydstats/app/
│       ├── MainActivity.java
│       ├── WearableMessageListenerService.kt
│       └── plugins/
│           ├── FileOpenerPlugin.java
│           └── WearSyncPlugin.java
├── functions/                    # Firebase Cloud Functions
│   └── src/
│       ├── bydFunctions.ts
│       ├── googleMaps.ts
│       └── index.ts
├── .github/workflows/            # CI/CD
│   ├── deploy.yml
│   └── android-build.yml
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
├── eslint.config.js
├── capacitor.config.json
└── package.json
```

**Convenciones del proyecto:**
- Path aliases: `@/*` → `src/*`, `@components/*`, `@hooks/*`, `@core/*`, `@features/*`, `@tabs/*`
- Componentes: PascalCase | Funciones/variables: camelCase | Constantes: UPPER_SNAKE_CASE
- Logger propio: `import { logger } from '@core/logger'` con niveles DEBUG/INFO/WARN/ERROR
- i18n: `useTranslation()` de react-i18next, idiomas: ES, EN, PT, GL, CA, EU
- Tests: Vitest + @testing-library/react + jsdom. Tests en `__tests__/` junto a su modulo
- Mocks existentes: `src/__mocks__/comlink.ts`, `src/__mocks__/react-i18next.ts`
- Setup tests: `src/setupTests.ts` (mocks de Worker, matchMedia, crypto.randomUUID, ResizeObserver)

**REGLAS IMPORTANTES:**
- NO modificar logica de negocio salvo donde se indique explicitamente
- NO cambiar la estructura de carpetas
- NO anadir dependencias nuevas salvo las indicadas en cada fase
- NO eliminar funcionalidades existentes
- Idioma del codigo: Ingles (comentarios pueden ser en espanol)
- Cada fase debe compilar y funcionar de forma independiente tras su implementacion
- Ejecutar `npm run build` al final de cada fase para verificar que no hay errores

---

## FASE 1: SEGURIDAD CRITICA
**Prioridad:** MAXIMA | **Riesgo de no hacer:** Compromiso de datos de usuarios
**Archivos a modificar:** 5 | **Estimacion:** 1-2 horas

### 1.1 Mover clave de cifrado fuera del codigo fuente

**Archivo:** `src/services/firebase.ts`

**Estado actual (linea ~6):**
```typescript
const ENCRYPTION_KEY = 'd0a5edbd5edc9a1bb954e16cdb4c9391673081a5e0e44554018b4fbd08889661';
```

**Cambio requerido:**
```typescript
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('VITE_ENCRYPTION_KEY environment variable is required');
}
```

**Tambien modificar:**
- `.env` → Anadir: `VITE_ENCRYPTION_KEY=d0a5edbd5edc9a1bb954e16cdb4c9391673081a5e0e44554018b4fbd08889661`
- `.env.example` → Anadir: `VITE_ENCRYPTION_KEY=your_encryption_key_here`
- `.github/workflows/deploy.yml` → Anadir secret `VITE_ENCRYPTION_KEY` al paso de build:
  ```yaml
  - name: Build
    env:
      VITE_GOOGLE_AUTH_CLIENT_ID: ${{ secrets.VITE_GOOGLE_AUTH_CLIENT_ID }}
      VITE_ENCRYPTION_KEY: ${{ secrets.VITE_ENCRYPTION_KEY }}
    run: npm run build
  ```

### 1.2 Mover Google Client ID a BuildConfig

**Archivo:** `android/app/src/main/res/values/strings.xml`

**Estado actual (linea 7):**
```xml
<string name="server_client_id">REDACTED_GOOGLE_CLIENT_ID</string>
```

**Cambio requerido:**
Eliminar la linea del Client ID de strings.xml. Moverlo a `android/app/build.gradle`:

```gradle
// Dentro de defaultConfig { ... }
buildConfigField "String", "SERVER_CLIENT_ID", "\"${System.getenv('GOOGLE_CLIENT_ID') ?: localProps.getProperty('GOOGLE_CLIENT_ID') ?: ''}\""
resValue "string", "server_client_id", System.getenv('GOOGLE_CLIENT_ID') ?: localProps.getProperty('GOOGLE_CLIENT_ID') ?: ''
```

Actualizar `local.properties` (gitignored) anadiendo:
```
GOOGLE_CLIENT_ID=REDACTED_GOOGLE_CLIENT_ID
```

### 1.3 Desactivar mixed content en produccion

**Archivo:** `capacitor.config.json`

**Estado actual:**
```json
{
  "appId": "com.bydstats.app",
  "appName": "BYD Stats",
  "webDir": "dist",
  "server": {
    "androidScheme": "https",
    "hostname": "localhost"
  },
  "android": {
    "allowMixedContent": true,
    "backgroundColor": "#0f172a"
  },
  "plugins": {}
}
```

**Cambio requerido:**
```json
{
  "appId": "com.bydstats.app",
  "appName": "BYD Stats",
  "webDir": "dist",
  "server": {
    "androidScheme": "https",
    "hostname": "localhost"
  },
  "android": {
    "allowMixedContent": false,
    "backgroundColor": "#0f172a"
  },
  "plugins": {}
}
```

### 1.4 Redactar datos sensibles en logs Android

**Archivo:** `android/app/src/main/java/com/bydstats/app/WearableMessageListenerService.kt`

Buscar la linea (~104) que contiene:
```kotlin
Log.i("WearableService", "Triggering native $action ($functionName) for VIN: $vin (User: ${user.uid})")
```

**Cambiar a:**
```kotlin
Log.i("WearableService", "Triggering native $action ($functionName) for VIN: ***${vin.takeLast(4)} (User: ${user.uid.take(8)}...)")
```

### 1.5 Verificacion Fase 1

- [ ] `npm run build` compila sin errores
- [ ] La clave de cifrado ya no aparece en ningun archivo .ts/.tsx (buscar: `d0a5edbd`)
- [ ] El Client ID ya no aparece en strings.xml
- [ ] `capacitor.config.json` tiene `allowMixedContent: false`
- [ ] Los logs de WearableMessageListenerService ya no muestran VIN completo

---

## FASE 2: CI/CD Y CONFIGURACION DE BUILD
**Prioridad:** ALTA | **Riesgo de no hacer:** Deploys sin validacion
**Archivos a modificar:** 4 | **Estimacion:** 30 min

### 2.1 Anadir tests al pipeline de deploy

**Archivo:** `.github/workflows/deploy.yml`

Anadir un paso de tests ANTES del paso de Build. El workflow actual tiene estos pasos:
1. Checkout
2. Setup Node
3. Install dependencies
4. Build
5. Upload artifact
6. Deploy

**Insertar entre "Install dependencies" y "Build":**
```yaml
    - name: Run tests
      run: npm run test -- --run

    - name: Check coverage
      run: npm run test:coverage -- --run
```

### 2.2 Eliminar config de test duplicada en vite.config.ts

**Archivo:** `vite.config.ts`

Buscar y ELIMINAR el bloque `test: { ... }` que esta al final del archivo (aprox lineas 127-132). Este bloque duplica la configuracion de `vitest.config.ts` y ademas usa la extension incorrecta (`setupTests.js` en vez de `.ts`):

```typescript
// ELIMINAR ESTE BLOQUE COMPLETO:
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: false,
  },
```

La configuracion correcta ya existe en `vitest.config.ts`.

### 2.3 Anadir TypeScript ESLint

**Archivo:** `eslint.config.js`

**Estado actual:**
```javascript
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    ...js.configs.recommended,
    ...reactHooks.configs.flat.recommended,
    ...reactRefresh.configs.vite,
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['warn', {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_',
      }],
    },
  },
]
```

**Instalar dependencia:** `npm install -D typescript-eslint`

**Nuevo contenido:**
```javascript
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    ...reactHooks.configs.flat.recommended,
    ...reactRefresh.configs.vite,
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
```

**NOTA:** Tras este cambio, ESLint mostrara warnings por los `any` existentes. NO bloquea el build. Los warnings se resolveran en la Fase 5.

### 2.4 Verificacion Fase 2

- [ ] `npm run build` compila sin errores
- [ ] `npm run test -- --run` ejecuta los 9 archivos de test correctamente
- [ ] `npx eslint src/ --max-warnings=999` no muestra errores (solo warnings)
- [ ] En `vite.config.ts` ya no existe un bloque `test: { ... }`

---

## FASE 3: RENDIMIENTO CRITICO
**Prioridad:** ALTA | **Riesgo de no hacer:** UX degradada, 3-5s de bloqueo en smart charging
**Archivos a modificar:** 4 | **Estimacion:** 3-4 horas

### 3.1 Optimizar algoritmo smart charging (O(n^3) → O(n log n))

**Archivo:** `src/workers/dataWorker.ts` lineas ~176-345

El algoritmo actual hace 56 llamadas secuenciales a TensorFlow (`await tf.predictDeparture()`) y luego un bucle de seleccion con verificacion de overlap O(n^2).

**Cambios requeridos:**

**A) Paralelizar predicciones TensorFlow:**

Buscar el bucle de simulacion (aprox linea 196):
```typescript
for (let d = 0; d < 7; d++) {
    // ...
    for (let h = 0; h < 24; h += 3) {
        // ...
        const prediction = await tf.predictDeparture(simDate.getTime());
```

Refactorizar a:
```typescript
// Generar todas las fechas de simulacion primero
const simDates: number[] = [];
for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h += 3) {
        const simDate = new Date(startOfWeek);
        simDate.setDate(simDate.getDate() + d);
        simDate.setHours(h, 0, 0, 0);
        simDates.push(simDate.getTime());
    }
}

// Predecir en paralelo (batch de 56 llamadas)
const predictions = await Promise.all(
    simDates.map(ts => tf.predictDeparture(ts))
);

// Procesar resultados
for (let i = 0; i < simDates.length; i++) {
    const prediction = predictions[i];
    if (!prediction || prediction.duration < 1.5) continue;
    // ... resto de logica de candidatos
}
```

**B) Usar Map para deteccion de overlap:**

Buscar el bucle de seleccion (aprox linea 305-345) donde se hace:
```typescript
const hasOverlap = selected.some(s => ...);
```

Refactorizar usando un Set de intervalos de 30 minutos:
```typescript
// Antes del bucle de seleccion:
const occupiedSlots = new Set<string>();

// Funcion helper:
function getSlotKeys(start: number, end: number): string[] {
    const keys: string[] = [];
    let t = Math.floor(start / 30) * 30;
    while (t < end) {
        keys.push(`${Math.floor(t / (24 * 60))}_${t % (24 * 60)}`);
        t += 30;
    }
    return keys;
}

// En lugar de selected.some():
const candidateSlots = getSlotKeys(cand.startMinute, cand.endMinute);
const hasOverlap = candidateSlots.some(s => occupiedSlots.has(s));

if (!hasOverlap) {
    selected.push(cand);
    candidateSlots.forEach(s => occupiedSlots.add(s));
}
```

### 3.2 Corregir resize listeners duplicados

**Archivo:** `src/context/LayoutContext.tsx` lineas ~78-105

**Estado actual (simplificado):**
```typescript
// Linea 79
if (isCompactSize) {
    document.documentElement.style.fontSize = '13.5px';
} else {
    document.documentElement.style.fontSize = '';
}

// Lineas 94-100
const resizeObserver = new ResizeObserver(() => {
    checkLayout();
});
resizeObserver.observe(document.documentElement);

window.addEventListener('resize', checkLayout);
window.addEventListener('orientationchange', checkLayout);
```

**Cambio requerido:**

A) Reemplazar inline styles con CSS class:
```typescript
if (isCompactSize) {
    document.documentElement.classList.add('compact-mode');
} else {
    document.documentElement.classList.remove('compact-mode');
}
```

Y anadir en `src/index.css` (o el CSS global del proyecto):
```css
.compact-mode {
    font-size: 13.5px;
}
```

B) Eliminar resize listener redundante (ResizeObserver ya cubre resize):
```typescript
const resizeObserver = new ResizeObserver(() => {
    checkLayout();
});
resizeObserver.observe(document.documentElement);

// ELIMINAR: window.addEventListener('resize', checkLayout);
window.addEventListener('orientationchange', checkLayout);

return () => {
    resizeObserver.disconnect();
    // ELIMINAR: window.removeEventListener('resize', checkLayout);
    window.removeEventListener('orientationchange', checkLayout);
};
```

### 3.3 Lazy-load Leaflet

**Archivos:** `src/components/maps/LocationCardMap.tsx` y `src/components/maps/TripMap.tsx`

Crear wrapper lazy para ambos componentes. En el archivo que los importa (tipicamente `LocationCard.tsx` y modales de trips):

Donde se haga:
```typescript
import LocationCardMap from '@components/maps/LocationCardMap';
```

Cambiar a:
```typescript
import { lazy, Suspense } from 'react';
const LocationCardMap = lazy(() => import('@components/maps/LocationCardMap'));

// En el JSX, envolver con Suspense:
<Suspense fallback={<div className="h-full w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />}>
    <LocationCardMap {...props} />
</Suspense>
```

Hacer lo mismo para `TripMap` en los componentes que lo importen.

### 3.4 Verificacion Fase 3

- [ ] `npm run build` compila sin errores
- [ ] Smart charging responde en <1 segundo (probar con dataset de 30+ dias)
- [ ] Redimensionar ventana del navegador no causa jank visible
- [ ] Los mapas cargan correctamente con un breve shimmer antes de aparecer

---

## FASE 4: SEGURIDAD CLOUD FUNCTIONS
**Prioridad:** ALTA | **Riesgo de no hacer:** Abuso de API, DoS
**Archivos a modificar:** 2 | **Estimacion:** 2-3 horas

### 4.1 Implementar rate limiting

**Archivo:** `functions/src/bydFunctions.ts`

Crear un helper de rate limiting al inicio del archivo:

```typescript
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

async function checkRateLimit(uid: string, action: string, maxPerMinute: number = 10): Promise<void> {
    const ref = db.collection('rateLimits').doc(`${uid}_${action}`);
    const now = Date.now();
    const windowMs = 60_000;

    const doc = await ref.get();
    const data = doc.data();

    if (data && data.count >= maxPerMinute && (now - data.windowStart) < windowMs) {
        throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
    }

    if (!data || (now - data.windowStart) >= windowMs) {
        await ref.set({ count: 1, windowStart: now });
    } else {
        await ref.update({ count: data.count + 1 });
    }
}
```

Luego, al inicio de CADA funcion callable (bydConnectV2, bydGetRealtimeV2, bydLockV2, bydUnlockV2, bydStartClimateV2, bydFlashLightsV2, etc.), despues de `requireAuth()`:

```typescript
const uid = requireAuth(request);
await checkRateLimit(uid, 'functionName', 10); // 10 calls/minute
```

**Limites sugeridos por funcion:**
| Funcion | Limite/minuto |
|---------|:------------:|
| bydConnectV2 | 3 |
| bydDisconnectV2 | 3 |
| bydGetRealtimeV2 | 10 |
| bydLockV2 / bydUnlockV2 | 5 |
| bydStartClimateV2 | 5 |
| bydFlashLightsV2 | 5 |
| Otras | 10 |

### 4.2 Mejorar validacion del webhook MQTT

**Archivo:** `functions/src/bydFunctions.ts` (lineas ~1079-1126)

**Estado actual del webhook (simplificado):**
```typescript
const { source, timestamp, event } = req.body;
if (!event) {
    res.status(400).send('Missing event data');
    return;
}
```

**Cambio requerido - Anadir validacion completa:**
```typescript
// Al inicio del handler del webhook, despues de validar el secret:
const { source, timestamp, event } = req.body;

// Validar estructura del body
if (!event || typeof event !== 'object') {
    res.status(400).send('Missing or invalid event data');
    return;
}

// Validar VIN si presente
if (event.vin && (typeof event.vin !== 'string' || event.vin.length !== 17)) {
    res.status(400).send('Invalid VIN format');
    return;
}

// Validar tamano del payload (max 1MB)
const bodySize = JSON.stringify(req.body).length;
if (bodySize > 1_048_576) {
    res.status(413).send('Payload too large');
    return;
}

// Validar timestamp (no mas de 5 minutos de antiguedad para evitar replay)
if (timestamp) {
    const eventTime = new Date(timestamp).getTime();
    const now = Date.now();
    if (isNaN(eventTime) || Math.abs(now - eventTime) > 5 * 60 * 1000) {
        res.status(400).send('Invalid or expired timestamp');
        return;
    }
}
```

### 4.3 Limite de tamano en FileOpenerPlugin

**Archivo:** `android/app/src/main/java/com/bydstats/app/plugins/FileOpenerPlugin.java`

Buscar el bucle de lectura del archivo (lineas ~43-52):
```java
ByteArrayOutputStream buffer = new ByteArrayOutputStream();
int nRead;
byte[] data = new byte[16384];

while ((nRead = inputStream.read(data, 0, data.length)) != -1) {
    buffer.write(data, 0, nRead);
}
```

**Cambiar a:**
```java
final long MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
ByteArrayOutputStream buffer = new ByteArrayOutputStream();
int nRead;
long totalRead = 0;
byte[] data = new byte[16384];

while ((nRead = inputStream.read(data, 0, data.length)) != -1) {
    totalRead += nRead;
    if (totalRead > MAX_FILE_SIZE) {
        inputStream.close();
        call.reject("File too large. Maximum size is 50MB.");
        return;
    }
    buffer.write(data, 0, nRead);
}
```

### 4.4 Verificacion Fase 4

- [ ] Cloud Functions despliegan sin errores: `firebase deploy --only functions`
- [ ] Rate limiting funciona: llamar a una funcion 11 veces en 1 minuto produce error "resource-exhausted"
- [ ] Webhook rechaza payload >1MB
- [ ] Webhook rechaza VIN invalido (!=17 chars)
- [ ] Webhook rechaza timestamp de hace >5 minutos
- [ ] FileOpenerPlugin rechaza archivos >50MB
- [ ] Build Android compila: `cd android && ./gradlew assembleDebug`

---

## FASE 5: CALIDAD DE CODIGO
**Prioridad:** MEDIA | **Riesgo de no hacer:** Deuda tecnica acumulada
**Archivos a modificar:** ~15 | **Estimacion:** 2-3 horas

### 5.1 Eliminar `as any` casts mas criticos (16 → ~5 aceptables)

**Cambios por archivo:**

**A) `src/components/cards/LiveVehicleStatus.tsx:79`**
```typescript
// Antes:
const isCharging = vehicleData?.chargingActive === true || (vehicleData as any)?.isCharging === true;
// Despues: Anadir isCharging a la interfaz VehicleData o crear type guard
const isCharging = vehicleData?.chargingActive === true || ('isCharging' in (vehicleData ?? {}) && (vehicleData as { isCharging?: boolean })?.isCharging === true);
```

**B) `src/components/modals/CloudBackupsModal.tsx:44`**
Tipar correctamente el array de backups. Buscar el useState y tipar:
```typescript
// Antes:
setBackups(sorted as any);
// Despues: Definir interface Backup y tipar el state correctamente
```

**C) `src/context/LayoutContext.tsx:115`**
```typescript
// Antes:
const isNativeDetected = isModeApk || (window as any).Capacitor?.isNativePlatform();
// Despues:
declare global {
    interface Window {
        Capacitor?: { isNativePlatform: () => boolean };
    }
}
const isNativeDetected = isModeApk || window.Capacitor?.isNativePlatform() === true;
```
**NOTA:** Esta declaracion puede ir en un archivo `src/types/global.d.ts` si no existe uno ya.

**D) `src/components/maps/LocationCardMap.tsx:7` y `src/components/maps/TripMap.tsx:8`**
```typescript
// Antes:
delete (L.Icon.Default.prototype as any)._getIconUrl;
// Despues (workaround conocido de Leaflet, aceptable dejarlo con comentario):
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet icon fix workaround
delete (L.Icon.Default.prototype as any)._getIconUrl;
```

**E) `src/hooks/useDatabase.ts:316`**
```typescript
// Antes:
const blob = new Blob([data as any], { type: 'application/x-sqlite3' });
// Despues:
const blob = new Blob([data as BlobPart], { type: 'application/x-sqlite3' });
```

**F) Catch blocks con `: any` → `: unknown`**
En todos los archivos que tengan `catch (err: any)` o `catch (error: any)`, cambiar a:
```typescript
catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // usar message en lugar de err.message
}
```

Archivos afectados: `BydSettings.tsx` (4 instancias), `VehicleTab.tsx`, `QuickActions.tsx`, `useWearSync.ts`, `ClimateControlModal.tsx`

### 5.2 Corregir catch vacio en HelpModal

**Archivo:** `src/components/modals/HelpModal.tsx` (linea ~31-33)

```typescript
// Antes:
} catch (error) {
    // empty
}
// Despues:
} catch (error) {
    logger.warn('Failed to fetch app version:', error);
}
```

Asegurarse de importar logger si no esta importado:
```typescript
import { logger } from '@core/logger';
```

### 5.3 Eliminar console.log residual

**Archivo:** `src/features/dashboard/tabs/dashboard/QuickActions.tsx` (linea ~281)

Eliminar:
```typescript
console.log('[QuickActions] PIN test result:', result);
```

Reemplazar con:
```typescript
logger.debug('[QuickActions] PIN test result:', result);
```

### 5.4 Corregir dependencias de useEffect

**A) `src/components/modals/TripDetailModal.tsx` (linea ~205)**
Verificar el useEffect y anadir las dependencias que faltan al array:
```typescript
// Si el efecto usa trip.source y trip.vehicleId, anadirlos:
}, [trip?.id, trip?.source, trip?.vehicleId]);
```

**B) `src/features/dashboard/tabs/VehicleTab.tsx` (linea ~140)**
Anadir `deleteAnomalies` al array de dependencias o envolverlo en useCallback.

### 5.5 Extraer numeros magicos en tensorflowWorker

**Archivo:** `src/workers/tensorflowWorker.ts` (lineas ~74-86)

Crear constantes al inicio del archivo:
```typescript
// Efficiency model training constants
const SPEED_MIN = 15;
const SPEED_MAX = 160;
const EFFICIENCY_MIN = 5;
const EFFICIENCY_MAX = 40;

const SYNTHETIC_ANCHORS = [
    { speed: 30, distance: 15, eff: 14.5, count: 500 },
    { speed: 80, distance: 35, eff: 17.5, count: 500 },
    { speed: 100, distance: 100, eff: 23.5, count: 500 },
] as const;
```

Y usarlas en lugar de los valores hardcodeados:
```typescript
if (isNaN(speed) || speed > SPEED_MAX || speed < SPEED_MIN) return;
if (isNaN(efficiency) || efficiency > EFFICIENCY_MAX || efficiency < EFFICIENCY_MIN) return;
```

### 5.6 Verificacion Fase 5

- [ ] `npm run build` compila sin errores
- [ ] `npx eslint src/` no muestra errores (warnings por `any` reducidos significativamente)
- [ ] `npm run test -- --run` todos los tests pasan
- [ ] Buscar `as any` en el codigo: debe haber ~5 o menos (los justificados con eslint-disable)

---

## FASE 6: TESTS CRITICOS
**Prioridad:** MEDIA-ALTA | **Riesgo de no hacer:** Regresiones en produccion
**Archivos a crear:** ~8 | **Estimacion:** 4-6 horas

### 6.1 Tests de providers (los mas criticos)

**Crear:** `src/providers/__tests__/ChargesProvider.test.tsx`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
// Testear: inicializacion, add/update/delete charges, summary calculations
// Seguir el patron de src/hooks/__tests__/useChargesData.test.ts
```

**Crear:** `src/providers/__tests__/FilterProvider.test.tsx`
```typescript
// Testear: filter state initialization, filter changes, reset
```

**Crear:** `src/providers/__tests__/ModalProvider.test.tsx`
```typescript
// Testear: openModal, closeModal, isAnyModalOpen, nested modals
```

### 6.2 Tests de servicios

**Crear:** `src/services/__tests__/AnomalyService.test.ts`
```typescript
// Testear: deteccion de anomalias con datos mock
// Edge cases: array vacio, un solo trip, trips sin anomalias
```

### 6.3 Tests de componentes criticos

**Crear:** `src/components/cards/__tests__/TripCard.test.tsx`
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
// Testear: render con trip data, onClick handler, formato de datos
```

**Crear:** `src/components/cards/__tests__/ChargeCard.test.tsx`
```typescript
// Testear: render con charge data, onClick handler, formato de datos
```

### 6.4 Tests de workers (minimos)

**Crear:** `src/workers/__tests__/dataWorker.test.ts`
```typescript
// Testear: funciones puras exportadas (si las hay)
// Testear: logica de scoring de smart charging con datos mock
```

### 6.5 Patterns a seguir en tests

Todos los tests deben seguir los patrones existentes en `src/hooks/__tests__/useChargesData.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Para componentes con providers, crear wrapper:
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <CarProvider>
        <AppProvider>
            {children}
        </AppProvider>
    </CarProvider>
);

describe('ComponentName', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('should render correctly with default props', () => {
        // ...
    });

    it('should handle edge case: empty data', () => {
        // ...
    });
});
```

### 6.6 Verificacion Fase 6

- [ ] `npm run test -- --run` ejecuta todos los tests (antiguos + nuevos)
- [ ] `npm run test:coverage -- --run` muestra cobertura de los archivos nuevos
- [ ] Ningun test nuevo tiene `skip` o `todo`
- [ ] Cada test cubre al menos: caso normal, caso vacio, caso de error

---

## FASE 7: RENDIMIENTO SECUNDARIO
**Prioridad:** MEDIA | **Riesgo de no hacer:** Startup lento, memoria alta
**Archivos a modificar:** 4 | **Estimacion:** 2-3 horas

### 7.1 Persistir modelo de eficiencia en IndexedDB

**Archivo:** `src/workers/tensorflowWorker.ts`

Despues de entrenar el modelo (linea ~143, tras `model.fit()`), guardarlo:

```typescript
// Despues de entrenar exitosamente:
async function saveModelToIDB(model: tf.LayersModel, key: string): Promise<void> {
    await model.save(`indexeddb://${key}`);
}

async function loadModelFromIDB(key: string): Promise<tf.LayersModel | null> {
    try {
        return await tf.loadLayersModel(`indexeddb://${key}`);
    } catch {
        return null;
    }
}
```

En `trainEfficiency()`:
```typescript
async function trainEfficiency(trips: Trip[]): Promise<{ loss: number; samples: number }> {
    // Intentar cargar modelo cacheado
    const cached = await loadModelFromIDB('efficiency-model');
    if (cached && trips.length === lastTrainingSize) {
        efficiencyModel = cached;
        efficiencyTrained = true;
        return { loss: 0, samples: trips.length };
    }

    // ... entrenar como antes ...

    // Guardar tras entrenar
    await saveModelToIDB(efficiencyModel, 'efficiency-model');
    lastTrainingSize = trips.length;
}
```

Anadir variable de control:
```typescript
let lastTrainingSize = 0;
```

### 7.2 Pre-ordenar trips en AnomalyService

**Archivo:** `src/services/AnomalyService.ts`

Cambiar el metodo que recibe los trips para que exija trips ya ordenados, o ordenar una sola vez al inicio:

```typescript
// Al inicio del metodo principal, ordenar UNA vez:
const sortedTrips = [...trips].sort((a, b) => a.start_timestamp - b.start_timestamp);
const sortedCharges = [...charges].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

// Luego pasar sortedTrips/sortedCharges a todos los sub-metodos
// ELIMINAR los .sort() duplicados de lineas 45, 73, 143
```

### 7.3 React.memo para cards en listas virtualizadas

**Archivo:** `src/components/cards/TripCard.tsx`
```typescript
// Al final del archivo, cambiar:
export default TripCard;
// A:
export default React.memo(TripCard);
```

**Archivo:** `src/components/cards/ChargeCard.tsx`
```typescript
export default React.memo(ChargeCard);
```

### 7.4 Verificacion Fase 7

- [ ] `npm run build` compila sin errores
- [ ] El modelo de eficiencia se carga de IndexedDB en la segunda sesion (verificar en DevTools > Application > IndexedDB)
- [ ] AnomalyService no ordena trips multiples veces (buscar `.sort(` en el archivo, debe aparecer maximo 2 veces al inicio)
- [ ] Las listas de trips/charges no causan re-renders innecesarios al hacer scroll

---

## FASE 8: MEJORAS DE ARQUITECTURA (OPCIONAL)
**Prioridad:** BAJA | **Riesgo de no hacer:** Deuda tecnica a largo plazo
**Archivos a modificar:** ~6 | **Estimacion:** 4-6 horas

### 8.1 Exponer contextos individuales desde DataProvider

Actualmente todos los consumidores usan `useData()` que devuelve 96 propiedades. Sin cambiar la estructura interna, se pueden crear hooks de acceso granular:

**Crear:** `src/hooks/useTripsData.ts`
```typescript
import { useData } from '@/providers/DataProvider';

export function useTripsData() {
    const { trips, filteredTrips, filtered, stats, tripHistory } = useData();
    return { trips, filteredTrips, filtered, stats, tripHistory };
}
```

**Crear:** `src/hooks/useChargesContext.ts` (si no existe)
```typescript
import { useData } from '@/providers/DataProvider';

export function useChargesContextData() {
    const { charges } = useData();
    return { charges };
}
```

**Crear:** `src/hooks/useModals.ts` (si no existe)
```typescript
import { useData } from '@/providers/DataProvider';

export function useModals() {
    const { modals, openModal, closeModal, isAnyModalOpen } = useData();
    return { modals, openModal, closeModal, isAnyModalOpen };
}
```

Luego migrar componentes gradualmente para usar estos hooks especificos en vez de `useData()` directamente. **NO es necesario migrar todo de una vez.** Empezar por los componentes mas simples.

### 8.2 Extraer configuracion de charts

**Crear:** `src/core/chartDefaults.ts`
```typescript
import type { ChartOptions } from 'chart.js';

export const defaultGridConfig = {
    color: 'rgba(148, 163, 184, 0.1)',
    borderDash: [3, 3],
    drawBorder: false,
};

export const defaultTooltipConfig = {
    // ... config comun extraida de los tabs
};

export function createLineChartOptions(overrides?: Partial<ChartOptions<'line'>>): ChartOptions<'line'> {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { tooltip: defaultTooltipConfig },
        scales: { y: { grid: defaultGridConfig } },
        ...overrides,
    };
}
```

Luego reemplazar la configuracion duplicada en `TrendsTab.tsx`, `EfficiencyTab.tsx`, `OverviewTab.tsx` por llamadas a estas funciones.

### 8.3 Verificacion Fase 8

- [ ] `npm run build` compila sin errores
- [ ] `npm run test -- --run` todos los tests pasan
- [ ] Los componentes migrados a hooks granulares siguen funcionando correctamente
- [ ] La configuracion de charts es consistente entre todos los tabs

---

## RESUMEN DE FASES

| Fase | Tema | Archivos | Prioridad | Dependencias |
|:----:|-------|:--------:|:---------:|:------------:|
| 1 | Seguridad critica | 5 | MAXIMA | Ninguna |
| 2 | CI/CD + Build config | 4 | ALTA | Ninguna |
| 3 | Rendimiento critico | 4 | ALTA | Ninguna |
| 4 | Seguridad Cloud Functions | 2 | ALTA | Ninguna |
| 5 | Calidad de codigo | ~15 | MEDIA | Fase 2 (ESLint) |
| 6 | Tests criticos | ~8 nuevos | MEDIA-ALTA | Ninguna |
| 7 | Rendimiento secundario | 4 | MEDIA | Ninguna |
| 8 | Arquitectura (opcional) | ~6 | BAJA | Ninguna |

**Fases paralelas posibles:** 1+2, 3+4, 5+6, 7+8
**Fases secuenciales obligatorias:** Fase 5 depende de Fase 2 (ESLint config)

---

## CHECKLIST FINAL POST-IMPLEMENTACION

Tras completar TODAS las fases, verificar:

```bash
# 1. Build sin errores
npm run build

# 2. Tests pasan
npm run test -- --run

# 3. Cobertura minima
npm run test:coverage -- --run

# 4. Lint sin errores
npx eslint src/

# 5. No hay secrets en el codigo
grep -r "d0a5edbd" src/         # No debe encontrar nada
grep -r "REDACTED_FIREBASE_MESSAGING_SENDER_ID" android/ # No debe encontrar nada en strings.xml

# 6. Build Android
cd android && ./gradlew assembleDebug

# 7. Cloud Functions
cd functions && npm run build
```

**Puntuacion objetivo tras todas las fases:**
```
SEGURIDAD      [##############----] 75%    BUENO
TESTING        [###########-------] 55%    MEJORABLE (con tests nuevos)
RENDIMIENTO    [#############-----] 72%    BUENO
CALIDAD CODIGO [###############---] 80%    BUENO
MANTENIBILIDAD [###############---] 80%    BUENO
ARQUITECTURA   [###############---] 78%    BUENO
BUILD/CONFIG   [################--] 85%    MUY BUENO
---------------------------------------------------
GLOBAL         [###############---] 75%    BUENO
```
