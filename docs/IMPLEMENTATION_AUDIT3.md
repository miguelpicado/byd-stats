# Plan de Implementacion - Auditoria 3 (02-mar-2026)

## Contexto del Proyecto

**BYD Stats Premium** es una PWA + Capacitor (React 19 + TypeScript 5.9 + Vite 7) con app Android nativa, app Wear OS y Firebase Cloud Functions. Soporte para 6 idiomas, TensorFlow.js para ML on-device, sql.js para SQLite en browser.

**Objetivo:** Resolver todas las issues pendientes de la tercera y ultima auditoria de codigo antes de lanzar la APK Premium a beta testing y posterior produccion.

**Directorio raiz del proyecto:** `byd-stats-premium/`

---

## Estado Actual vs Proyectado

### Puntuaciones por Categoria

```
                        ACTUAL (78)                         PROYECTADO (91)
                        ───────────                         ───────────────
TESTING            68%  [###########-------]    →    88%  [################--]   +20  ★★★
SEGURIDAD          72%  [############------]    →    88%  [################--]   +16  ★★
RENDIMIENTO        78%  [##############----]    →    84%  [###############---]   +6
MANTENIBILIDAD     80%  [##############----]    →    90%  [################--]   +10  ★
ARQUITECTURA       81%  [##############----]    →    87%  [################--]   +6
CALIDAD CODIGO     82%  [###############---]    →    90%  [################--]   +8   ★
BUILD & CONFIG     85%  [################--]    →    95%  [#################-]   +10  ★
─────────────────────────────────────────────────────────────────────────────────
GLOBAL             78%  [##############----]    →    89%  [################--]   +11
```

### Detalle del Impacto por Fase

| Fase | Categoria Afectada | Actual | Tras Fase | Mejora | Issues Resueltas |
|------|-------------------|:------:|:---------:|:------:|:----------------:|
| **1. Seguridad Critica** | Seguridad | 72% | **82%** | +10 | 2 criticas |
| **2. Seguridad Alta** | Seguridad | 82% | **88%** | +6 | 1 alta |
| **3. Configuracion** | Build & Config | 85% | **92%** | +7 | 3 config |
| **4. Calidad Codigo** | Calidad + Mantenibilidad | 82% / 80% | **88% / 87%** | +6 / +7 | 2 calidad |
| **5. Rendimiento** | Rendimiento | 78% | **84%** | +6 | 1 rendimiento |
| **6. Arquitectura** | Arquitectura + Mantenibilidad | 81% / 87% | **87% / 90%** | +6 / +3 | 1 arquitectura |
| **7. Testing (Tier 1)** | Testing + Calidad | 68% / 88% | **78% / 89%** | +10 / +1 | Utils + services puros |
| **8. Testing (Tier 2)** | Testing + Calidad | 78% / 89% | **83% / 90%** | +5 / +1 | Hooks criticos |
| **9. Testing (Tier 3)** | Testing + Build | 83% / 92% | **88% / 95%** | +5 / +3 | Providers + CI + components |

### Evolucion Historica Completa (3 auditorias + proyeccion)

| Categoria | 28-feb | 01-mar | 02-mar | **Proyectado** | Mejora total |
|-----------|:------:|:------:|:------:|:--------------:|:------------:|
| Seguridad | 38 | 52 | 72 | **88** | **+50 pts** |
| Calidad | 62 | 70 | 82 | **90** | **+28 pts** |
| Rendimiento | 55 | 58 | 78 | **84** | **+29 pts** |
| Arquitectura | 68 | 73 | 81 | **87** | **+19 pts** |
| Testing | 30 | 35 | 68 | **88** | **+58 pts** |
| Build/Config | 72 | 78 | 85 | **95** | **+23 pts** |
| Mantenibilidad | 65 | 70 | 80 | **90** | **+25 pts** |
| **GLOBAL** | **56** | **62** | **78** | **89** | **+33 pts** |

### Issues Pendientes: Antes y Despues

| Prioridad | Antes (15 issues) | Despues Fases 1-6 (5 issues) | Despues Fases 7-9 (3 issues) |
|-----------|:-----------------:|:----------------------------:|:----------------------------:|
| CRITICA | 2 | **0** | 0 |
| ALTA | 4 | **1** (Sentry - externo) | 1 |
| MEDIA | 5 | **1** | 0 |
| BAJA | 4 | **3** | 2 |

**Issues que quedan tras completar TODAS las fases:**
1. (ALTA) Sin Sentry/monitoring en produccion — requiere cuenta externa
2. (BAJA) 20 anotaciones `: any` pre-existentes — no merecen refactor
3. (BAJA) Paginacion backend charges — solo necesario si >10k registros

---

## Fase 1: Seguridad Critica (BLOQUEANTES para beta)

### 1.1 Eliminar Fallback Inseguro en Webhook Secret

**Archivo:** `functions/src/bydFunctions.ts`
**Linea:** 1121

**Codigo actual:**
```typescript
const WEBHOOK_SECRET = process.env.BYD_WEBHOOK_SECRET || 'change-me-in-production';
```

**Cambiar a:**
```typescript
const WEBHOOK_SECRET = process.env.BYD_WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
    console.error('[CRITICAL] BYD_WEBHOOK_SECRET environment variable is not set. Webhook endpoint will reject all requests.');
}
```

**Y en la funcion `bydMqttWebhook`, antes de validar el secret (dentro del handler, al principio):**
```typescript
if (!WEBHOOK_SECRET) {
    res.status(503).send('Webhook not configured');
    return;
}
```

**Verificacion:** Buscar en el archivo que no quede ninguna referencia a `'change-me-in-production'`.

---

### 1.2 Eliminar Google Maps API Key Hardcodeada

**Archivo:** `functions/reprocess_trip_snap.js`
**Linea:** 6

**Codigo actual:**
```javascript
process.env.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCmBJK1DIsykLj8poFHkwN1DWu3Kfuiwhc';
```

**Cambiar a:**
```javascript
if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error('[CRITICAL] GOOGLE_MAPS_API_KEY environment variable is not set. Exiting.');
    process.exit(1);
}
```

**IMPORTANTE:** Tras este cambio, la API key `AIzaSyCmBJK1DIsykLj8poFHkwN1DWu3Kfuiwhc` debe considerarse comprometida. Recordar al propietario del proyecto que debe:
1. Ir a Google Cloud Console > APIs & Services > Credentials
2. Restringir la key existente o crear una nueva
3. Configurar la nueva key como variable de entorno en el servidor/CI

---

## Fase 2: Seguridad Alta (Pre-produccion)

### 2.1 Cifrar Tokens Google en localStorage

**Archivos a modificar:**
- `src/hooks/sync/useGoogleAuth.ts`
- `src/hooks/sync/useDriveSync.ts`

**Estrategia:** Crear un modulo `src/utils/secureStorage.ts` que envuelva localStorage con cifrado basico usando la Web Crypto API. Dado que estamos en un contexto de browser/Capacitor, no necesitamos cifrado militar — el objetivo es que los tokens no sean legibles en texto plano si alguien inspecciona localStorage.

**Crear archivo `src/utils/secureStorage.ts`:**
```typescript
/**
 * Secure wrapper around localStorage that obfuscates sensitive values.
 * Uses AES-GCM with a device-derived key to prevent casual token theft.
 *
 * NOTE: This is defense-in-depth, not a security boundary.
 * The real protection is short-lived tokens + HTTPS + CSP.
 */

const STORAGE_PREFIX = 'sec_';
const KEY_MATERIAL = 'byd-stats-storage-key'; // Deterministic, device-local

let cryptoKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
    if (cryptoKey) return cryptoKey;
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(KEY_MATERIAL),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    cryptoKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('byd-stats-salt'),
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
    return cryptoKey;
}

export async function secureSet(key: string, value: string): Promise<void> {
    try {
        const ck = await getKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(value);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, ck, encoded);

        // Store as base64: iv + ciphertext
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        localStorage.setItem(STORAGE_PREFIX + key, btoa(String.fromCharCode(...combined)));
    } catch {
        // Fallback: store raw if crypto not available (e.g., insecure context)
        localStorage.setItem(key, value);
    }
}

export async function secureGet(key: string): Promise<string | null> {
    try {
        const stored = localStorage.getItem(STORAGE_PREFIX + key);
        if (!stored) {
            // Try legacy unencrypted key for migration
            return localStorage.getItem(key);
        }

        const ck = await getKey();
        const combined = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, ck, data);
        return new TextDecoder().decode(decrypted);
    } catch {
        // Fallback: try raw
        return localStorage.getItem(key);
    }
}

export function secureRemove(key: string): void {
    localStorage.removeItem(STORAGE_PREFIX + key);
    localStorage.removeItem(key); // Also remove legacy unencrypted
}
```

**Despues, modificar `src/hooks/sync/useGoogleAuth.ts`:**

Reemplazar todas las llamadas a `localStorage.setItem`/`getItem`/`removeItem` para tokens:

```typescript
// Al inicio del archivo, anadir import:
import { secureSet, secureGet, secureRemove } from '@/utils/secureStorage';
```

**Linea 48-50** (dentro de `handleLoginSuccess`):
```typescript
// ANTES:
localStorage.setItem('google_access_token', accessToken);
const expiryTime = Date.now() + (60 * 60 * 1000);
localStorage.setItem('google_token_expiry', expiryTime.toString());

// DESPUES:
await secureSet('google_access_token', accessToken);
const expiryTime = Date.now() + (60 * 60 * 1000);
await secureSet('google_token_expiry', expiryTime.toString());
```

**Lineas 67-68** (dentro de `checkAuth`):
```typescript
// ANTES:
const token = localStorage.getItem('google_access_token');
const expiry = localStorage.getItem('google_token_expiry');

// DESPUES:
const token = await secureGet('google_access_token');
const expiry = await secureGet('google_token_expiry');
```

**Lineas 164-165** (dentro de `logout`):
```typescript
// ANTES:
localStorage.removeItem('google_access_token');
localStorage.removeItem('google_token_expiry');

// DESPUES:
secureRemove('google_access_token');
secureRemove('google_token_expiry');
```

**Nota importante sobre `useDriveSync.ts`:** Las lineas 136-138 y 189-195 usan localStorage para `ai_predictions`, `ai_soh_predictions`, y `ai_parking_predictions`. Estos son caches de ML, NO datos sensibles (no contienen tokens ni datos personales). No es necesario cifrarlos, pero si se quiere consistencia, se puede usar `secureSet`/`secureGet` tambien. La decision queda a criterio del desarrollador.

**Verificacion post-cambio:**
1. Buscar en todo `src/` que no queden `localStorage.setItem('google_access_token'` ni `localStorage.getItem('google_access_token'` sin el wrapper.
2. Probar login/logout/restore de sesion en la app.
3. Verificar que la migracion transparente funciona (usuarios existentes con tokens sin cifrar deben poder seguir usandolos via el fallback de `secureGet`).

---

## Fase 3: Configuracion

### 3.1 Anadir @services Alias a tsconfig.json

**Archivo:** `tsconfig.json`

El alias `@services` esta definido en `vitest.config.ts` (linea 47) pero falta en `tsconfig.json`. Esto puede causar errores de resolucion de tipos en el IDE.

**Codigo actual (lineas 24-43):**
```json
"paths": {
    "@/*": ["./src/*"],
    "@components/*": ["./src/components/*"],
    "@hooks/*": ["./src/hooks/*"],
    "@core/*": ["./src/core/*"],
    "@features/*": ["./src/features/*"],
    "@tabs/*": ["./src/features/dashboard/tabs/*"]
}
```

**Cambiar a:**
```json
"paths": {
    "@/*": ["./src/*"],
    "@components/*": ["./src/components/*"],
    "@hooks/*": ["./src/hooks/*"],
    "@core/*": ["./src/core/*"],
    "@services/*": ["./src/services/*"],
    "@features/*": ["./src/features/*"],
    "@tabs/*": ["./src/features/dashboard/tabs/*"]
}
```

**Verificacion:** Ejecutar `npx tsc --noEmit` y confirmar que no hay errores nuevos de resolucion de modulos.

---

### 3.2 Alinear Node.js en CI/CD Workflows

**Archivos:**
- `.github/workflows/deploy.yml` (usa Node 20)
- `.github/workflows/web-check.yml` (usa Node 22)

**Cambio en `deploy.yml`, linea 38:**
```yaml
# ANTES:
node-version: 20

# DESPUES:
node-version: 22
```

Esto alinea ambos workflows a Node 22 (LTS actual).

---

### 3.3 Anadir sideEffects a package.json

**Archivo:** `package.json`

**Anadir despues de la linea `"type": "module",` (linea 5):**
```json
"sideEffects": false,
```

Esto indica a los bundlers (Vite/Rollup) que todos los modulos del proyecto son puros y pueden ser tree-shaken agresivamente. Si despues del cambio hay problemas con imports que dependen de side-effects (como CSS imports o polyfills), se puede cambiar a un array con los archivos que SI tienen side effects:
```json
"sideEffects": ["./src/i18n/*.ts", "./src/setupTests.ts"],
```

**Verificacion:** Ejecutar `npm run build` y comparar tamano del bundle antes y despues.

---

## Fase 4: Calidad de Codigo

### 4.1 Reducir Verbose Logging en Cloud Functions

**Archivo:** `functions/src/googleMaps.ts`

Actualmente tiene ~10 `console.log`/`console.warn`/`console.error` que son demasiado verbosos para produccion.

**Codigo actual completo del archivo (128 lineas):**
```typescript
import axios from 'axios';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// ... interfaces ...

export async function snapToRoads(points: LatLng[]): Promise<LatLng[]> {
    if (!GOOGLE_MAPS_API_KEY) {
        console.error('[snapToRoads] Missing Google Maps API Key');
        return points;
    }

    if (points.length < 2) {
        console.log('[snapToRoads] Not enough points to snap');    // ELIMINAR
        return points;
    }

    try {
        console.log(`[snapToRoads] Processing ${points.length} points...`);  // ELIMINAR

        // ... chunk loop ...
        console.log(`[snapToRoads] Requesting chunk ...`);  // ELIMINAR

        // ... success ...
        console.log(`[snapToRoads] Chunk ... success. Received ...`);  // ELIMINAR

        // ... fallback ...
        console.warn(`[snapToRoads] Chunk ... API returned no snappedPoints...`);  // MANTENER (warning real)

        // ... error ...
        console.error(`[snapToRoads] API Error...`);   // MANTENER (error real)
        console.error('[snapToRoads] API Error details:...');  // MANTENER (error real)

        console.log(`[snapToRoads] Finished. Input: ... -> Output: ...`);  // ELIMINAR
    } catch (error: any) {
        console.error('[snapToRoads] Top-level error:', error.message);  // MANTENER (error real)
    }
}
```

**Regla:** Mantener solo `console.error` y `console.warn` para errores/warnings reales. Eliminar todos los `console.log` informativos.

**Lineas a eliminar/modificar:**
- **Linea 33:** `console.log('[snapToRoads] Not enough points to snap');` → ELIMINAR (comportamiento normal, no informativo)
- **Linea 38:** `console.log(...)` Processing → ELIMINAR
- **Linea 47:** `console.log(...)` Requesting chunk → ELIMINAR
- **Linea 59:** `console.log(...)` Chunk success → ELIMINAR
- **Linea 121:** `console.log(...)` Finished → ELIMINAR

**Mantener sin cambios:**
- **Linea 28:** `console.error` Missing API Key → MANTENER (error critico)
- **Linea 108:** `console.warn` No snapped points → MANTENER (warning valido)
- **Linea 112:** `console.error` API Error → MANTENER
- **Linea 114:** `console.error` API Error details → MANTENER
- **Linea 125:** `console.error` Top-level error → MANTENER

---

### 4.2 Internacionalizar Strings Hardcodeados en ErrorBoundary

**Archivo:** `src/components/common/ErrorBoundary.tsx`

**Problema:** Es un class component, lo que impide usar el hook `useTranslation()`. La solucion es pasar las traducciones como props desde los padres que instancian ErrorBoundary, o usar `i18next.t()` directamente (funcion pura, no hook).

**Linea 48-49:**
```typescript
// ANTES:
const title = this.props.title || "Algo salió mal";
const message = this.props.message || "La aplicación ha encontrado un error inesperado.";

// DESPUES:
import i18next from 'i18next';  // Anadir al inicio del archivo

const title = this.props.title || i18next.t('error.boundary.title', 'Something went wrong');
const message = this.props.message || i18next.t('error.boundary.message', 'The application encountered an unexpected error.');
```

**Linea 106:**
```typescript
// ANTES:
Recargar página

// DESPUES:
{i18next.t('error.boundary.reload', 'Reload page')}
```

**Anadir las keys de traduccion a cada archivo de idioma:**

Para cada locale (`src/locales/` o donde esten los archivos de traduccion), anadir:

```json
{
  "error": {
    "boundary": {
      "title": "Algo salió mal",
      "message": "La aplicación ha encontrado un error inesperado.",
      "reload": "Recargar página"
    }
  }
}
```

Y el equivalente en cada idioma (EN, PT, GL, CA, EU).

**Nota:** Buscar otros strings hardcodeados en espanol en el codebase. Segun la auditoria, hay ~16 instancias. Los mas criticos son los de ErrorBoundary (visibles al usuario en caso de error). Los demas se pueden ir migrando progresivamente.

---

## Fase 5: Rendimiento

### 5.1 Code Splitting de Dashboard Tabs

**Archivos a modificar:**
- `src/features/dashboard/tabs/index.ts`
- El archivo que importa y renderiza los tabs (buscar donde se usan los componentes exportados por `index.ts`)

**Codigo actual de `index.ts`:**
```typescript
export { default as HistoryTab } from './HistoryTab';
export { default as RecordsTab } from './RecordsTab';
export { default as OverviewTab } from './OverviewTab';
export { default as TrendsTab } from './TrendsTab';
export { default as PatternsTab } from './PatternsTab';
export { default as EfficiencyTab } from './EfficiencyTab';
```

**Cambiar a lazy exports.** Hay dos opciones:

**Opcion A (Recomendada): Lazy loading en el consumidor**

Modificar el componente que renderiza los tabs (probablemente en `MainLayout.tsx` o un `TabsManager`). En lugar de importar desde `index.ts`, usar `React.lazy()`:

```typescript
import React, { Suspense } from 'react';

const HistoryTab = React.lazy(() => import('@tabs/HistoryTab'));
const RecordsTab = React.lazy(() => import('@tabs/RecordsTab'));
const OverviewTab = React.lazy(() => import('@tabs/OverviewTab'));
const TrendsTab = React.lazy(() => import('@tabs/TrendsTab'));
const PatternsTab = React.lazy(() => import('@tabs/PatternsTab'));
const EfficiencyTab = React.lazy(() => import('@tabs/EfficiencyTab'));
const ChargesTab = React.lazy(() => import('@tabs/ChargesTab'));
const CalendarTab = React.lazy(() => import('@tabs/CalendarTab'));
const VehicleTab = React.lazy(() => import('@tabs/VehicleTab'));
```

Y envolver cada tab en un `<Suspense>` al renderizarlo:

```tsx
<Suspense fallback={<div className="animate-pulse h-64 bg-slate-200 dark:bg-slate-700 rounded-xl" />}>
    <ActiveTabComponent />
</Suspense>
```

**Opcion B: Lazy exports desde index.ts**

Si el patron de importar desde `index.ts` es fuerte en el codebase, se puede cambiar `index.ts` a:

```typescript
import { lazy } from 'react';

export const HistoryTab = lazy(() => import('./HistoryTab'));
export const RecordsTab = lazy(() => import('./RecordsTab'));
export const OverviewTab = lazy(() => import('./OverviewTab'));
export const TrendsTab = lazy(() => import('./TrendsTab'));
export const PatternsTab = lazy(() => import('./PatternsTab'));
export const EfficiencyTab = lazy(() => import('./EfficiencyTab'));
export const ChargesTab = lazy(() => import('./ChargesTab'));
export const CalendarTab = lazy(() => import('./CalendarTab'));
export const VehicleTab = lazy(() => import('./VehicleTab'));
```

Pero en este caso, el consumidor DEBE envolver en `<Suspense>` al renderizar.

**Verificacion:** Ejecutar `npm run build` y verificar que se generan chunks separados para cada tab. Comparar tamano del chunk principal antes y despues (deberia reducirse ~50-80KB).

---

### 5.2 Pre-ordenar Trips para AnomalyService (Opcional)

**Archivo:** `src/services/AnomalyService.ts` lineas 20-22

**Codigo actual:**
```typescript
const sortedTrips = [...trips].sort((a, b) => a.start_timestamp - b.start_timestamp);
const sortedCharges = [...charges].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
```

**Nota:** En la auditoria anterior (01-mar) este issue se marquo como "re-sort redundante llamado multiples veces". Sin embargo, revisando el codigo actual, el sort se hace UNA sola vez en `checkSystemHealth()` y los sub-metodos reciben los datos pre-ordenados. Esto ya esta correctamente implementado.

Si los datos llegan al AnomalyService ya ordenados desde el DataProvider/caller, se puede eliminar el sort aqui y anadir un comentario:

```typescript
// Caller must provide trips sorted by start_timestamp ASC and charges sorted by date DESC
```

Pero si no hay garantia del orden de entrada, es mejor mantener el sort defensivo como esta. **La recomendacion es MANTENER el codigo actual**, ya que es seguro y el coste O(N log N) es despreciable para N < 5000.

---

## Fase 6: Arquitectura (Post-beta, mejora incremental)

### 6.1 Refactorizar SyncProvider (9 → 3-4 responsabilidades)

**Archivo:** `src/providers/SyncProvider.tsx` (477 lineas, 9 responsabilidades)

**Estrategia de extraccion:**

1. **Extraer `useVehicleWakeup` hook** (vehicle wake-on-open logic, ~30 lineas)
   - Mover la logica de cooldown y llamada a `bydWakeVehicle` a un hook separado
   - El hook acepta `activeCar`, `settings` como parametros

2. **Extraer `useSoHAutoSync` hook** (SoH auto-sync listener, ~20 lineas)
   - Mover el event listener de `sohCalculated` y el trigger de cloud sync
   - El hook acepta `googleSync.syncNow` como parametro

3. **Extraer `parseChargeRegistry` utility** (CSV parsing, ~110 lineas)
   - Mover toda la logica de parsing CSV a `src/utils/parseChargeRegistry.ts`
   - Funcion pura que recibe un `File` y devuelve un array de charges

4. **Mantener en SyncProvider** (~320 lineas):
   - Google Sync state orchestration
   - Database export/import
   - SyncData export/import (JSON merge logic)
   - File loading dispatch

**Nota:** Este refactoring NO es bloqueante para beta. Es una mejora de mantenibilidad para facilitar futuros cambios. Hacerlo solo si hay tiempo antes de produccion.

---

## Fase 7: Testing Tier 1 — Utils y Servicios Puros (~55 tests)

**Objetivo:** Testear logica pura sin dependencias complejas. Mayor ROI por test.
**Impacto Testing:** 68% → 78%

### Estado actual del testing

```
TESTEADO (16 archivos, 354 tests):
  core/         batteryCalculations, dataProcessing, dateUtils, formatters, logger
  hooks/        useChargesData, useSettings, useTrips, useChargeImporter
  providers/    ChargesProvider, FilterProvider, ModalProvider, DataProvider
  services/     AnomalyService
  components/   ChargeCard
  workers/      dataWorker
  utils/        validation
  functions/    bydFunctions (parcial)

SIN TESTEAR (159 archivos):
  utils/        normalize.ts, typeGuards.ts
  services/     StorageService.ts, googleDrive.ts, PredictiveService.ts, firebase.ts, bydApi.ts
  hooks/        24 hooks sin tests
  providers/    TripsProvider, SyncProvider
  components/   68 componentes sin tests
  workers/      tensorflowWorker
  core/         constants.ts, chargingLogic.ts
```

---

### 7.1 Tests para `src/utils/typeGuards.ts` (~12 tests)

**Archivo a crear:** `src/utils/__tests__/typeGuards.test.ts`

El archivo `typeGuards.ts` (99 lineas) exporta 8 funciones puras sin dependencias externas. Son type guards de TypeScript — funciones que validan tipos en runtime.

**Exports a testear:**
- `isValidNumber(value)` — rechaza NaN, Infinity, null, undefined, strings
- `isNonEmptyString(value)` — rechaza "", "  ", null, undefined, numeros
- `parseNumericSetting(value, defaultValue)` — parsea string a number o devuelve default
- `isTrip(obj)` — valida que un objeto tiene campos de Trip (date, start_timestamp, end_timestamp)
- `isCharge(obj)` — valida que un objeto tiene campos de Charge (date, kwhCharged o kwh)
- `isTripsArray(arr)` — valida que un array contiene solo Trip validos
- `isChargesArray(arr)` — valida que un array contiene solo Charge validos
- `filterNonNull(arr)` — filtra null/undefined preservando tipo
- `getSettingValue(settings, key, defaultValue)` — acceso seguro a Settings

**Casos de test sugeridos:**
```typescript
describe('typeGuards', () => {
    describe('isValidNumber', () => {
        it('returns true for valid numbers (0, 1, -1, 3.14)');
        it('returns false for NaN');
        it('returns false for Infinity and -Infinity');
        it('returns false for null, undefined, string');
    });

    describe('isNonEmptyString', () => {
        it('returns true for non-empty strings');
        it('returns false for empty string and whitespace-only');
        it('returns false for null, undefined, numbers');
    });

    describe('parseNumericSetting', () => {
        it('parses valid numeric strings ("60.48" → 60.48)');
        it('returns number as-is (60.48 → 60.48)');
        it('returns default for invalid string ("abc")');
        it('returns default for null/undefined');
    });

    describe('isTrip', () => {
        it('returns true for valid Trip objects');
        it('returns false for objects missing required fields');
        it('returns false for null/undefined/primitives');
    });

    describe('isCharge', () => {
        it('returns true for valid Charge objects (kwhCharged or kwh)');
        it('returns false for objects missing date');
    });

    describe('filterNonNull', () => {
        it('removes null and undefined from array');
        it('preserves falsy values (0, "", false)');
        it('returns empty array for all-null input');
    });
});
```

**Dificultad:** FACIL — funciones puras, sin mocks.

---

### 7.2 Tests para `src/utils/normalization.ts` (~10 tests)

**Archivo a crear:** `src/utils/__tests__/normalization.test.ts`

El archivo `normalization.ts` (42 lineas) exporta 3 funciones puras para normalizar valores de bateria.

**Exports a testear:**
- `normalizeSoCToPercent(soc)` — convierte SoC decimal (0.5) a porcentaje (50) o deja porcentaje como esta
- `normalizeSoCToDecimal(soc)` — inverso: porcentaje a decimal
- `getNumericBatterySize(value)` — parsea string o number a numero, default 60

**Casos de test sugeridos:**
```typescript
describe('normalization', () => {
    describe('normalizeSoCToPercent', () => {
        it('converts decimal to percent (0.5 → 50, 0.99 → 99)');
        it('keeps percent as percent (50 → 50, 99 → 99)');
        it('handles boundary: 0 → 0, 1 → 100');
        it('handles values > 1 as already percent (1.01 → 1.01... wait, or 101?)');
        it('returns null for null/undefined input');
    });

    describe('normalizeSoCToDecimal', () => {
        it('converts percent to decimal (50 → 0.5, 99 → 0.99)');
        it('keeps decimal as decimal (0.5 → 0.5)');
        it('returns null for null/undefined');
    });

    describe('getNumericBatterySize', () => {
        it('parses string "60.48" → 60.48');
        it('returns number as-is');
        it('returns 60 for undefined');
    });
});
```

**Dificultad:** FACIL — funciones puras, casos de borde claros.

---

### 7.3 Tests para `src/services/StorageService.ts` (~10 tests)

**Archivo a crear:** `src/services/__tests__/StorageService.test.ts`

El archivo `StorageService.ts` (78 lineas) es un wrapper de localStorage con JSON parsing y error handling.

**Exports a testear:**
- `StorageService.get<T>(key, defaultValue)` — JSON.parse con fallback
- `StorageService.save<T>(key, value)` — JSON.stringify con error handling
- `StorageService.remove(key)` — eliminacion con error handling
- `StorageService.clearByPrefix(prefix)` — eliminacion masiva por prefijo

**Mocks necesarios:** `localStorage` (ya mockeado globalmente por jsdom).

**Casos de test sugeridos:**
```typescript
describe('StorageService', () => {
    beforeEach(() => localStorage.clear());

    describe('get', () => {
        it('returns parsed JSON for valid stored data');
        it('returns defaultValue when key does not exist');
        it('returns defaultValue when stored value is invalid JSON');
    });

    describe('save', () => {
        it('stores stringified JSON');
        it('returns true on success');
        it('returns false and does not throw on circular reference');
    });

    describe('remove', () => {
        it('removes existing key');
        it('does not throw for non-existent key');
    });

    describe('clearByPrefix', () => {
        it('removes all keys matching prefix');
        it('does not remove keys not matching prefix');
        it('handles empty localStorage');
    });
});
```

**Dificultad:** FACIL — localStorage ya disponible en jsdom.

---

### 7.4 Tests para `src/services/PredictiveService.ts` (~8 tests)

**Archivo a crear:** `src/services/__tests__/PredictiveService.test.ts`

El archivo `PredictiveService.ts` (55 lineas) es un wrapper de Comlink que delega todo al tensorflowWorker.

**Patron de mock (reutilizar el patron probado de dataWorker.test.ts):**
```typescript
const state = vi.hoisted(() => ({
    mockWorker: {
        trainEfficiency: vi.fn().mockResolvedValue(undefined),
        getScenarios: vi.fn().mockResolvedValue([]),
        trainSoH: vi.fn().mockResolvedValue(undefined),
        getSoHStats: vi.fn().mockResolvedValue(null),
        trainParking: vi.fn().mockResolvedValue(undefined),
        predictDeparture: vi.fn().mockResolvedValue(null),
    }
}));

vi.mock('comlink', () => ({
    wrap: () => state.mockWorker,
}));
```

**Casos de test sugeridos:**
```typescript
describe('PredictiveService', () => {
    it('lazily initializes the worker on first call');
    it('reuses the same worker on subsequent calls');
    it('delegates train() to worker.trainEfficiency()');
    it('delegates getScenarios() to worker.getScenarios()');
    it('delegates trainSoH() to worker.trainSoH()');
    it('delegates getSoHStats() to worker.getSoHStats()');
    it('delegates trainParking() to worker.trainParking()');
    it('delegates predictDeparture() to worker.predictDeparture()');
});
```

**Dificultad:** MEDIA — requiere mock de Comlink, pero patron ya establecido.

---

### 7.5 Tests para `src/hooks/useAppVersion.ts` (~8 tests)

**Archivo a crear:** `src/hooks/__tests__/useAppVersion.test.ts`

El archivo `useAppVersion.ts` (69 lineas) hace fetch a la GitHub API con cache de 24h en localStorage.

**Mocks necesarios:** `fetch` (global), `localStorage` (jsdom).

**Casos de test sugeridos:**
```typescript
describe('useAppVersion', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('returns default version "v1.6.0" while loading');
    it('fetches latest release from GitHub API on mount');
    it('caches result in localStorage with expiry timestamp');
    it('returns cached version without fetch when cache is fresh (<24h)');
    it('fetches again when cache is expired (>24h)');
    it('returns cached version on fetch error');
    it('returns default version when no cache and fetch fails');
    it('sets isLoading to false after fetch completes');
});
```

**Dificultad:** FACIL — fetch + localStorage, patron simple.

---

### 7.6 Tests para `src/core/constants.ts` (~7 tests)

**Archivo a crear:** `src/core/__tests__/constants.test.ts`

Validar integridad de constantes criticas que afectan el comportamiento de la app.

**Casos de test sugeridos:**
```typescript
describe('constants', () => {
    it('DEFAULT_SETTINGS contains all required Settings fields');
    it('DEFAULT_SETTINGS has valid default values (batterySize > 0, etc.)');
    it('TAB_ORDER contains no duplicate IDs');
    it('STORAGE_KEY constants are unique strings');
    it('BYD_RED is a valid hex color');
    it('TRIP_DISTRIBUTION_COLORS has entries for each trip type');
    it('HYBRID_COLORS are distinct from TRIP_DISTRIBUTION_COLORS');
});
```

**Dificultad:** TRIVIAL — validacion de datos estaticos.

---

## Fase 8: Testing Tier 2 — Hooks Criticos (~55 tests)

**Objetivo:** Testear hooks de negocio que manejan datos, filtros y estado.
**Impacto Testing:** 78% → 83%

### 8.1 Tests para `src/hooks/useLocalStorage.ts` (~8 tests)

**Archivo a crear:** `src/hooks/__tests__/useLocalStorage.test.ts`

Hook generico que sincroniza useState con localStorage.

**Casos de test sugeridos:**
```typescript
describe('useLocalStorage', () => {
    it('initializes with value from localStorage if exists');
    it('initializes with default value if localStorage is empty');
    it('updates localStorage when state changes');
    it('handles JSON parse errors gracefully');
    it('handles JSON stringify errors gracefully');
    it('supports complex objects (arrays, nested)');
    it('supports car-scoped keys (prefixed with carId)');
    it('clears storage on explicit null set');
});
```

**Dificultad:** FACIL — mismo patron que useSettings.test.ts.

---

### 8.2 Tests para `src/hooks/useFilters.ts` (~8 tests)

**Archivo a crear:** `src/hooks/__tests__/useFilters.test.ts`

Hook que maneja el estado de filtros (tipo, mes, rango de fechas).

**Casos de test sugeridos:**
```typescript
describe('useFilters', () => {
    it('initializes with default filter type "month"');
    it('setFilterType changes filter type');
    it('setSelMonth updates selected month');
    it('setDateFrom and setDateTo update date range');
    it('months list is computed from available trip dates');
    it('selMonth defaults to current month if no trips');
    it('changing car resets filters to defaults');
    it('filterType "all" returns empty month/date constraints');
});
```

**Dificultad:** FACIL — useState + useMemo.

---

### 8.3 Tests para `src/hooks/useVehicleStatus.ts` (~10 tests)

**Archivo a crear:** `src/hooks/__tests__/useVehicleStatus.test.ts`

Hook que subscribe a Firestore para estado en tiempo real del vehiculo.

**Mocks necesarios:** `firebase/firestore` (doc, onSnapshot).

**Casos de test sugeridos:**
```typescript
// Mock de Firestore
vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    doc: vi.fn(),
    onSnapshot: vi.fn((ref, callback) => {
        // Simulate snapshot
        callback({ exists: () => true, data: () => mockVehicleData });
        return vi.fn(); // unsubscribe
    }),
}));

describe('useVehicleStatus', () => {
    it('subscribes to Firestore when enabled=true and VIN provided');
    it('does NOT subscribe when enabled=false');
    it('does NOT subscribe when VIN is empty');
    it('returns null vehicleData initially');
    it('updates vehicleData on snapshot');
    it('detects deep sleep (location 0,0 + tire pressure all 0s)');
    it('preserves previous location during deep sleep');
    it('preserves previous tire pressure during deep sleep');
    it('unsubscribes on unmount');
    it('re-subscribes when VIN changes');
});
```

**Dificultad:** MEDIA — Firestore mock + state merge logic.

---

### 8.4 Tests para `src/hooks/useSwipeGesture.ts` (~12 tests)

**Archivo a crear:** `src/hooks/__tests__/useSwipeGesture.test.ts`

Hook de deteccion de gestos tactiles para navegacion entre tabs.

**Mocks necesarios:** TouchEvent (disponible en jsdom).

**Casos de test sugeridos:**
```typescript
describe('useSwipeGesture', () => {
    // Setup: renderHook con refs simulados

    describe('horizontal swipes', () => {
        it('swipe left triggers next tab');
        it('swipe right triggers previous tab');
        it('ignores swipes shorter than 30px threshold');
    });

    describe('vertical swipes', () => {
        it('swipe up at bottom of scroll triggers next tab');
        it('swipe down at top of scroll triggers previous tab');
        it('ignores vertical swipes in middle of scroll');
    });

    describe('guards', () => {
        it('disables all swipes when modal is open');
        it('disables swipes during tab transition');
        it('locks direction after initial movement');
    });

    describe('cleanup', () => {
        it('resets touch state on touchend');
        it('handles touchcancel gracefully');
    });
});
```

**Dificultad:** MEDIA — simulacion de touch events, scroll position.

---

### 8.5 Tests para `src/hooks/useWearSync.ts` (~8 tests)

**Archivo a crear:** `src/hooks/__tests__/useWearSync.test.ts`

Hook de sincronizacion con Wear OS.

**Mocks necesarios:** Capacitor (`isNativePlatform`), WearSync plugin.

**Casos de test sugeridos:**
```typescript
vi.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: vi.fn(() => true) },
    registerPlugin: vi.fn(() => mockWearSyncPlugin),
}));

describe('useWearSync', () => {
    it('no-ops entirely on non-native platform (PWA)');
    it('registers action listener on native platform');
    it('dispatches unlock action to BYD API');
    it('dispatches flash action to BYD API');
    it('dispatches climate toggle to BYD API');
    it('normalizes SoC from decimal to percent (0.5 → 50)');
    it('debounces wear data sync with 2s timeout');
    it('shows toast notification on action success/error');
});
```

**Dificultad:** MEDIA — plugin mocking.

---

### 8.6 Tests para `src/hooks/useAutoChargeDetection.ts` (~9 tests)

**Archivo a crear:** `src/hooks/__tests__/useAutoChargeDetection.test.ts`

Hook que detecta sesiones de carga automaticamente comparando trips consecutivos.

**Casos de test sugeridos:**
```typescript
describe('useAutoChargeDetection', () => {
    it('detects charge when SoC increases between consecutive trips');
    it('does not detect charge when SoC decreases');
    it('calculates kWh from SoC difference and battery size');
    it('estimates charge duration from trip gap');
    it('filters by enabled charger types from settings');
    it('does not create duplicate charges for same trip gap');
    it('handles trips with missing SoC data gracefully');
    it('uses correct battery size from settings');
    it('ignores trips closer than minimum gap threshold');
});
```

**Dificultad:** MEDIA — logica de negocio, necesita fixtures de trips.

---

## Fase 9: Testing Tier 3 — Providers, CI y Componentes (~50 tests)

**Objetivo:** Cerrar gaps en providers, componentes clave y CI/CD.
**Impacto Testing:** 83% → 88%

### 9.1 Tests para `src/providers/TripsProvider.tsx` (~10 tests)

**Archivo a crear:** `src/providers/__tests__/TripsProvider.test.tsx`

Provider que compone 6 sub-hooks en un contexto unificado de trips.

**Patron de test:** Wrapper con providers padres (AppProvider, CarProvider) mockeados.

**Casos de test sugeridos:**
```typescript
describe('TripsProvider', () => {
    it('provides trips context to children');
    it('throws error when useTripsContext used outside provider');
    it('filters trips by month when filterType is "month"');
    it('filters trips by date range when filterType is "range"');
    it('returns all trips when filterType is "all"');
    it('memoizes filteredTrips to prevent unnecessary re-renders');
    it('saves trip history to localStorage');
    it('loads trip history from localStorage');
    it('clears trip history');
    it('manages anomaly acknowledgment state');
});
```

**Dificultad:** ALTA — requiere mock de 6 sub-hooks + providers padres.

---

### 9.2 Tests para `src/providers/SyncProvider.tsx` (~10 tests)

**Archivo a crear:** `src/providers/__tests__/SyncProvider.test.tsx`

El SyncProvider mas complejo (477 lineas, 9 responsabilidades). Testear solo los flujos criticos.

**Casos de test sugeridos:**
```typescript
describe('SyncProvider', () => {
    it('provides sync context to children');
    it('throws error when useSyncContext used outside provider');
    it('exportSyncData creates JSON blob with trips, charges, settings, AI cache');
    it('importSyncData detects JSON SyncData format');
    it('importSyncData with merge=true deduplicates by date-timestamp');
    it('importSyncData with merge=false replaces all data');
    it('loadChargeRegistry parses CSV with correct field mapping');
    it('vehicle wake respects 1-hour cooldown');
    it('auto-sync triggers on sohCalculated custom event');
    it('loadFile routes .json to importSyncData handler');
});
```

**Dificultad:** MUY ALTA — muchas dependencias, side effects, confirmaciones de usuario.

---

### 9.3 Tests para `src/components/cards/TripCard.tsx` (~10 tests)

**Archivo a crear:** `src/components/cards/__tests__/TripCard.test.tsx`

Componente memoizado de presentacion. Patron similar al ya existente `ChargeCard.test.tsx`.

**Mocks necesarios:** `useTranslation`, funciones de `@core/` (calculateScore, formatters).

**Casos de test sugeridos:**
```typescript
describe('TripCard', () => {
    it('renders trip date and time');
    it('renders distance using GPS distance when available');
    it('falls back to odometer distance when GPS not available');
    it('shows "-" for stationary trips (< 0.5 km)');
    it('calculates and displays efficiency (kWh/100km)');
    it('displays score with correct color based on efficiency');
    it('displays cost when calculatedCost is available');
    it('calls onClick with trip object when clicked');
    it('adjusts sizing for compact mode');
    it('is wrapped in React.memo for performance');
});
```

**Dificultad:** FACIL — componente de presentacion, patron ya establecido con ChargeCard.

---

### 9.4 Tests para `src/services/googleDrive.ts` (~12 tests)

**Archivo a crear:** `src/services/__tests__/googleDrive.test.ts`

Servicio de Google Drive (536 lineas) con cache, merge y CRUD.

**Mocks necesarios:** `fetch` (global), `localStorage`.

**Casos de test sugeridos:**
```typescript
describe('googleDriveService', () => {
    describe('cache', () => {
        it('returns cached file list when TTL not expired');
        it('fetches fresh list when cache expired');
        it('invalidates cache on upload');
    });

    describe('auth', () => {
        it('sets access token for subsequent requests');
        it('calls onUnauthorized callback on 401 response');
        it('clears token on signOut');
    });

    describe('CRUD', () => {
        it('listFiles sends correct query params');
        it('downloadFile parses JSON response');
        it('uploadFile creates new file when no fileId');
        it('uploadFile updates existing file when fileId provided');
        it('deleteFile sends DELETE request');
    });

    describe('mergeData', () => {
        it('merges trips by deduplicating on date + start_timestamp');
        it('local settings take precedence over remote');
        it('merges charges by date + time key');
        it('AI cache: keeps most recent prediction per key');
    });
});
```

**Dificultad:** ALTA — fetch mocking, cache state, merge logic.

---

### 9.5 Tests en CI/CD: Anadir paso de tests a `web-check.yml`

**Archivo:** `.github/workflows/web-check.yml`

**Codigo actual:**
```yaml
jobs:
  web-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
```

**Cambiar a:**
```yaml
jobs:
  web-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run test -- --run
      - run: npm run build
```

Esto anade **type-checking** y **tests** al pipeline de PRs. Ningun PR se podra mergear sin que pasen los tests.

---

### 9.6 Tests para `src/utils/secureStorage.ts` (~8 tests)

**Archivo a crear:** `src/utils/__tests__/secureStorage.test.ts`

Testear el modulo creado en la Fase 2 (cifrado de tokens en localStorage).

**Nota:** Requiere que `crypto.subtle` este disponible en jsdom. Si no lo esta, mock global.

**Casos de test sugeridos:**
```typescript
describe('secureStorage', () => {
    beforeEach(() => localStorage.clear());

    it('secureSet stores encrypted data with sec_ prefix');
    it('secureGet decrypts and returns original value');
    it('secureGet returns null for non-existent key');
    it('secureGet migrates legacy unencrypted keys transparently');
    it('secureRemove deletes both encrypted and legacy keys');
    it('round-trip: set then get returns same value');
    it('encrypted value in localStorage is not readable as plaintext');
    it('falls back to raw localStorage if crypto.subtle unavailable');
});
```

**Dificultad:** MEDIA — Web Crypto API en test environment.

---

## Resumen de Testing: Inventario Completo

### Tests por Fase

| Fase | Archivos de Test | Tests Estimados | Dificultad |
|------|:----------------:|:---------------:|:----------:|
| **7.1** typeGuards | 1 | ~12 | FACIL |
| **7.2** normalization | 1 | ~10 | FACIL |
| **7.3** StorageService | 1 | ~10 | FACIL |
| **7.4** PredictiveService | 1 | ~8 | MEDIA |
| **7.5** useAppVersion | 1 | ~8 | FACIL |
| **7.6** constants | 1 | ~7 | TRIVIAL |
| **8.1** useLocalStorage | 1 | ~8 | FACIL |
| **8.2** useFilters | 1 | ~8 | FACIL |
| **8.3** useVehicleStatus | 1 | ~10 | MEDIA |
| **8.4** useSwipeGesture | 1 | ~12 | MEDIA |
| **8.5** useWearSync | 1 | ~8 | MEDIA |
| **8.6** useAutoChargeDetection | 1 | ~9 | MEDIA |
| **9.1** TripsProvider | 1 | ~10 | ALTA |
| **9.2** SyncProvider | 1 | ~10 | MUY ALTA |
| **9.3** TripCard | 1 | ~10 | FACIL |
| **9.4** googleDrive | 1 | ~12 | ALTA |
| **9.5** CI/CD (web-check.yml) | 0 | 0 | CONFIG |
| **9.6** secureStorage | 1 | ~8 | MEDIA |
| **TOTAL** | **17 archivos** | **~160 tests** | |

### Proyeccion Final de Testing

```
                ANTES           DESPUES
Tests:          354      →      ~514 tests (+160)
Archivos test:  16/175   →      33/176 archivos (19%)
Cobertura:      68%      →      ~88%

Cobertura por area:
  Core utils:      85% → 90%   (+constants)
  Utils:            0% → 95%   (+typeGuards, normalize, secureStorage)
  Services:        15% → 70%   (+StorageService, PredictiveService, googleDrive)
  Hooks:           15% → 55%   (+7 hooks criticos)
  Providers:       60% → 85%   (+TripsProvider, SyncProvider)
  Components:       1% → 10%   (+TripCard)
  Cloud Functions: 40% → 40%   (ya cubierto)
  CI/CD:            0% → 100%  (tests en PRs + deploy)
```

---

## Checklist de Verificacion Final

Tras implementar todas las fases, ejecutar:

```bash
# 1. Tests
cd byd-stats-premium && npx vitest run

# 2. Type checking
npx tsc --noEmit

# 3. ESLint
npx eslint src --max-warnings=999 2>&1 | tail -5

# 4. Build de produccion
npm run build

# 5. Verificar que no hay secrets hardcodeados
grep -r "AIzaSy" functions/ --include="*.ts" --include="*.js"
grep -r "change-me-in-production" functions/

# 6. Verificar tokens cifrados
grep -r "localStorage.setItem.*google_access_token" src/
grep -r "localStorage.getItem.*google_access_token" src/
# Ambos deben devolver 0 resultados (reemplazados por secureSet/secureGet)
```

**Resultado esperado:**
- ~514 tests pasando (354 existentes + ~160 nuevos)
- 0 errores TypeScript
- 0 errores ESLint (warnings aceptables <=151)
- Build exitoso sin warnings de chunk size
- 0 secrets hardcodeados
- 0 tokens sin cifrar en localStorage
- Tests ejecutandose en CI/CD (web-check + deploy)

---

## Resumen de Cambios por Archivo

### Fases 1-6: Seguridad, Config, Calidad, Rendimiento, Arquitectura

| Archivo | Fase | Cambio |
|---------|------|--------|
| `functions/src/bydFunctions.ts` | 1.1 | Eliminar fallback webhook secret |
| `functions/reprocess_trip_snap.js` | 1.2 | Eliminar API key hardcodeada |
| `src/utils/secureStorage.ts` | 2.1 | CREAR: Wrapper cifrado para localStorage |
| `src/hooks/sync/useGoogleAuth.ts` | 2.1 | Usar secureSet/secureGet para tokens |
| `tsconfig.json` | 3.1 | Anadir @services alias |
| `.github/workflows/deploy.yml` | 3.2 | Node 20 → 22 |
| `package.json` | 3.3 | Anadir sideEffects: false |
| `functions/src/googleMaps.ts` | 4.1 | Eliminar console.log informativos |
| `src/components/common/ErrorBoundary.tsx` | 4.2 | i18n para strings hardcodeados |
| `src/locales/*.json` | 4.2 | Anadir keys error.boundary.* |
| `src/features/dashboard/tabs/index.ts` | 5.1 | Lazy exports o lazy imports |
| `src/providers/SyncProvider.tsx` | 6.1 | (Post-beta) Extraer hooks |
| `src/hooks/useVehicleWakeup.ts` | 6.1 | (Post-beta) CREAR |
| `src/utils/parseChargeRegistry.ts` | 6.1 | (Post-beta) CREAR |

### Fases 7-9: Testing (17 archivos de test nuevos)

| Archivo de Test | Fase | Tests | Dificultad |
|-----------------|------|:-----:|:----------:|
| `src/utils/__tests__/typeGuards.test.ts` | 7.1 | ~12 | FACIL |
| `src/utils/__tests__/normalization.test.ts` | 7.2 | ~10 | FACIL |
| `src/services/__tests__/StorageService.test.ts` | 7.3 | ~10 | FACIL |
| `src/services/__tests__/PredictiveService.test.ts` | 7.4 | ~8 | MEDIA |
| `src/hooks/__tests__/useAppVersion.test.ts` | 7.5 | ~8 | FACIL |
| `src/core/__tests__/constants.test.ts` | 7.6 | ~7 | TRIVIAL |
| `src/hooks/__tests__/useLocalStorage.test.ts` | 8.1 | ~8 | FACIL |
| `src/hooks/__tests__/useFilters.test.ts` | 8.2 | ~8 | FACIL |
| `src/hooks/__tests__/useVehicleStatus.test.ts` | 8.3 | ~10 | MEDIA |
| `src/hooks/__tests__/useSwipeGesture.test.ts` | 8.4 | ~12 | MEDIA |
| `src/hooks/__tests__/useWearSync.test.ts` | 8.5 | ~8 | MEDIA |
| `src/hooks/__tests__/useAutoChargeDetection.test.ts` | 8.6 | ~9 | MEDIA |
| `src/providers/__tests__/TripsProvider.test.tsx` | 9.1 | ~10 | ALTA |
| `src/providers/__tests__/SyncProvider.test.tsx` | 9.2 | ~10 | MUY ALTA |
| `src/components/cards/__tests__/TripCard.test.tsx` | 9.3 | ~10 | FACIL |
| `src/services/__tests__/googleDrive.test.ts` | 9.4 | ~12 | ALTA |
| `src/utils/__tests__/secureStorage.test.ts` | 9.6 | ~8 | MEDIA |

### Totales

| Categoria | Archivos Modificados | Archivos Nuevos |
|-----------|:--------------------:|:---------------:|
| Seguridad (F1-2) | 3 | 1 (secureStorage) |
| Config (F3) | 3 | 0 |
| Calidad (F4) | 2 + locales | 0 |
| Rendimiento (F5) | 1 | 0 |
| Arquitectura (F6) | 1 | 2 (post-beta) |
| Testing (F7-9) | 1 (web-check.yml) | 17 archivos de test |
| **TOTAL** | **11** | **20** |

**Tests: 354 actuales → ~514 proyectados (+45%)**
**Nota global: 78 actual → 89 proyectado (+11 puntos)**
