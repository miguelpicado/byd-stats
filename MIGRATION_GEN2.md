# Firebase Cloud Functions: Migration Gen 1 -> Gen 2

## Resumen

Migrar las 21 Cloud Functions de Gen 1 (`firebase-functions`) a Gen 2 (`firebase-functions/v2`).
El frontend (bydApi.ts) **NO necesita cambios** ya que Gen 2 `onCall` es compatible con el cliente `httpsCallable`.

**Urgencia**: Gen 1 Cloud Functions con Node.js 20 quedara deprecado el 2026-04-30 y decomisionado el 2026-10-30.

---

## Inventario de Funciones (21 funciones)

### Callable functions (`onCall`) - 19 funciones
| Funcion | Archivo | Linea | Notas |
|---------|---------|-------|-------|
| `ping` | index.ts | 18 | Health check simple |
| `bydConnect` | bydFunctions.ts | 43 | Auth + Firestore write |
| `bydDisconnect` | bydFunctions.ts | 161 | Firestore delete |
| `bydGetRealtime` | bydFunctions.ts | 342 | API call + Firestore |
| `bydGetGps` | bydFunctions.ts | 384 | API call + Firestore |
| `bydGetCharging` | bydFunctions.ts | 541 | API call |
| `bydLock` | bydFunctions.ts | 575 | Remote control via executeControlCommand |
| `bydUnlock` | bydFunctions.ts | 597 | Remote control via executeControlCommand |
| `bydStartClimate` | bydFunctions.ts | 622 | Remote control via executeControlCommand |
| `bydStopClimate` | bydFunctions.ts | 637 | Remote control via executeControlCommand |
| `bydFlashLights` | bydFunctions.ts | 652 | Remote control via executeControlCommand |
| `bydCloseWindows` | bydFunctions.ts | 667 | Remote control via executeControlCommand |
| `bydSeatClimate` | bydFunctions.ts | 684 | Remote control via executeControlCommand |
| `bydBatteryHeat` | bydFunctions.ts | 699 | Remote control via executeControlCommand |
| `bydPollVehicle` | bydFunctions.ts | 719 | Polling manual (NO exportada en index.ts) |
| `bydDiagnostic` | bydFunctions.ts | 974 | Debug API dump |
| `bydGetMqttCredentials` | bydFunctions.ts | 1185 | MQTT credentials |
| `bydWakeVehicle` | bydFunctions.ts | 2007 | Lee datos cache Firestore |
| `bydFixTrip` | bydFunctions.ts | 2052 | Recalcula viaje |
| `bydDebug` | bydFunctions.ts | 2180 | API dump diagnostico |

### HTTP function (`onRequest`) - 1 funcion
| Funcion | Archivo | Linea | Notas |
|---------|---------|-------|-------|
| `bydMqttWebhook` | bydFunctions.ts | 1014 | Webhook MQTT (NO exportada en index.ts) |

### Scheduled functions (PubSub) - 2 funciones
| Funcion | Archivo | Linea | Notas |
|---------|---------|-------|-------|
| `bydActiveTripMonitor` | bydFunctions.ts | 1587 | Cada 1 minuto, runWith timeout 300s |
| `bydIdleHeartbeat` | bydFunctions.ts | 1619 | Cada 3 horas, runWith timeout 300s |

---

## Cambios Necesarios

### 1. package.json - Actualizar firebase-functions

```json
{
  "dependencies": {
    "firebase-functions": "^6.3.0",
    "firebase-admin": "^12.0.0"
  }
}
```

Comando:
```bash
cd functions && npm install firebase-functions@latest
```

### 2. functions/src/index.ts - Migrar imports y ping

**ANTES (Gen 1):**
```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const VERSION = '4.0.0';
const REGION = 'europe-west1';
const regionalFunctions = functions.region(REGION);

export const ping = regionalFunctions.https.onCall(() => {
    return { status: 'PONG', version: VERSION, timestamp: new Date().toISOString(), region: REGION };
});

export {
    bydConnect,
    bydDisconnect,
    // ... rest
} from './bydFunctions';
```

**DESPUES (Gen 2):**
```typescript
import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

admin.initializeApp();

const VERSION = '5.0.0';
const REGION = 'europe-west1';

export const ping = onCall({ region: REGION }, () => {
    return { status: 'PONG', version: VERSION, timestamp: new Date().toISOString(), region: REGION };
});

export {
    bydConnect,
    bydDisconnect,
    bydGetRealtime,
    bydGetGps,
    bydGetCharging,
    bydLock,
    bydUnlock,
    bydStartClimate,
    bydStopClimate,
    bydFlashLights,
    bydCloseWindows,
    bydSeatClimate,
    bydBatteryHeat,
    bydWakeVehicle,
    bydDiagnostic,
    bydGetMqttCredentials,
    bydActiveTripMonitor,
    bydIdleHeartbeat,
    bydFixTrip,
    bydDebug,
} from './bydFunctions';
```

### 3. functions/src/bydFunctions.ts - Migracion principal

Este es el archivo con mas cambios. Hay 4 categorias de cambios:

#### 3a. Imports - Reemplazar imports Gen 1 por Gen 2

**ANTES:**
```typescript
import * as functions from 'firebase-functions';
```

**DESPUES:**
```typescript
import { onCall, onRequest, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
```

#### 3b. Eliminar regionalFunctions y constante REGION

**ANTES:**
```typescript
const REGION = 'europe-west1';
const regionalFunctions = functions.region(REGION);
```

**DESPUES:**
```typescript
const REGION = 'europe-west1';
// Ya no se usa regionalFunctions, cada funcion recibe { region } en su options
```

#### 3c. Migrar TODAS las funciones onCall (19 funciones)

El patron de conversion es IDENTICO para todas:

**ANTES (Gen 1 onCall):**
```typescript
export const bydConnect = regionalFunctions.https.onCall(async (data, context) => {
    const { username, password } = data;
    // ... logica ...
    throw new functions.https.HttpsError('invalid-argument', 'Missing fields');
});
```

**DESPUES (Gen 2 onCall):**
```typescript
export const bydConnect = onCall({ region: REGION }, async (request: CallableRequest) => {
    const { username, password } = request.data;
    //                              ^^^^^^^^^^^^^ CAMBIO: data -> request.data
    // const context = request;  // Si se necesita auth: request.auth
    // ... logica igual ...
    throw new HttpsError('invalid-argument', 'Missing fields');
    //        ^^^^^^^^^ CAMBIO: functions.https.HttpsError -> HttpsError
});
```

**Regla de conversion para onCall:**
1. `regionalFunctions.https.onCall(async (data, context) => {` -> `onCall({ region: REGION }, async (request: CallableRequest) => {`
2. Dentro del body: `data` -> `request.data` (destructuring: `const { vin } = request.data;`)
3. Si se usa `context.auth` -> `request.auth`
4. `functions.https.HttpsError` -> `HttpsError` (importado directamente)
5. Todo lo demas (logica de negocio, Firestore, etc.) queda IGUAL

**Lista de las 19 funciones onCall a migrar (BUSCAR Y REEMPLAZAR):**

```
bydConnect          (linea 43)   - usa data: { username, password, countryCode, controlPin, userId }
bydDisconnect       (linea 161)  - usa data: { vin, userId }
bydGetRealtime      (linea 342)  - usa data: { vin }
bydGetGps           (linea 384)  - usa data: { vin }
bydGetCharging      (linea 541)  - usa data: { vin }
bydLock             (linea 575)  - usa data: { vin, pin }
bydUnlock           (linea 597)  - usa data: { vin, pin }
bydStartClimate     (linea 622)  - usa data: { vin, temperature, pin }
bydStopClimate      (linea 637)  - usa data: { vin, pin }
bydFlashLights      (linea 652)  - usa data: { vin, pin }
bydCloseWindows     (linea 667)  - usa data: { vin, pin }
bydSeatClimate      (linea 684)  - usa data: { vin, seat, mode, pin }
bydBatteryHeat      (linea 699)  - usa data: { vin, pin }
bydPollVehicle      (linea 719)  - usa data: { vin }
bydDiagnostic       (linea 974)  - usa data: { vin }
bydGetMqttCredentials (linea 1185) - usa data: { vin }
bydWakeVehicle      (linea 2007) - usa data: { vin }
bydFixTrip          (linea 2052) - usa data: { vin, tripId, overrideValues }
bydDebug            (linea 2180) - usa data: { vin }
```

#### 3d. Migrar la funcion onRequest (1 funcion)

**ANTES (Gen 1 onRequest):**
```typescript
export const bydMqttWebhook = regionalFunctions.https.onRequest(async (req, res) => {
    // ... logica con req y res ...
});
```

**DESPUES (Gen 2 onRequest):**
```typescript
export const bydMqttWebhook = onRequest({ region: REGION }, async (req, res) => {
    // ... logica IDENTICA, req y res no cambian ...
});
```

#### 3e. Migrar las funciones Scheduled (2 funciones)

**ANTES (Gen 1 PubSub Schedule):**
```typescript
export const bydActiveTripMonitor = regionalFunctions.runWith({ timeoutSeconds: 300 }).pubsub
    .schedule('every 1 minutes')
    .onRun(async (context) => {
        // ... logica ...
        return null;
    });

export const bydIdleHeartbeat = regionalFunctions.runWith({ timeoutSeconds: 300 }).pubsub
    .schedule('every 3 hours')
    .onRun(async (context) => {
        // ... logica ...
        return null;
    });
```

**DESPUES (Gen 2 onSchedule):**
```typescript
export const bydActiveTripMonitor = onSchedule({
    schedule: 'every 1 minutes',
    region: REGION,
    timeoutSeconds: 300,
}, async (event) => {
    // ... logica IDENTICA ...
    // NOTA: No necesita return null, pero no hace dano
});

export const bydIdleHeartbeat = onSchedule({
    schedule: 'every 3 hours',
    region: REGION,
    timeoutSeconds: 300,
}, async (event) => {
    // ... logica IDENTICA ...
});
```

#### 3f. Migrar HttpsError en funciones helper (executeControlCommand, etc.)

La funcion `executeControlCommand` (linea 420) y otras helpers usan `functions.https.HttpsError`.
Reemplazar TODAS las ocurrencias:

**BUSCAR:**
```typescript
functions.https.HttpsError
```

**REEMPLAZAR POR:**
```typescript
HttpsError
```

Hay ~39 ocurrencias en bydFunctions.ts. Usar buscar y reemplazar global.

#### 3g. Migrar functions.config() en googleMaps.ts

**ANTES (linea 5 de googleMaps.ts):**
```typescript
import * as functions from 'firebase-functions';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || functions.config().google?.maps_api_key;
```

**DESPUES:**
```typescript
// Ya no se necesita importar firebase-functions aqui
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
```

`functions.config()` esta deprecado. Las variables de entorno ya se leen desde `.env` con `process.env`. Eliminar el fallback.

### 4. functions/src/googleMaps.ts - Eliminar import de firebase-functions

Si `googleMaps.ts` solo usa `functions.config()`, eliminar el import de firebase-functions completamente:

**ANTES:**
```typescript
import * as functions from 'firebase-functions';
import axios from 'axios';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || functions.config().google?.maps_api_key;
```

**DESPUES:**
```typescript
import axios from 'axios';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
```

---

## Frontend: SIN CAMBIOS

El archivo `src/services/bydApi.ts` usa `httpsCallable` de `firebase/functions` (cliente web).
Gen 2 `onCall` es **100% compatible** con el cliente `httpsCallable`.
La region `europe-west1` se mantiene igual.

**NO tocar `bydApi.ts`.**

---

## Pasos de Ejecucion (en orden)

### Paso 1: Crear branch
```bash
git checkout -b feat/gen2-migration
```

### Paso 2: Actualizar dependencias
```bash
cd functions
npm install firebase-functions@latest
```

### Paso 3: Editar `functions/src/index.ts`
- Cambiar import de `import * as functions from 'firebase-functions'` a `import { onCall } from 'firebase-functions/v2/https'`
- Eliminar `const regionalFunctions = functions.region(REGION);`
- Cambiar `ping` de `regionalFunctions.https.onCall(()` a `onCall({ region: REGION }, ()`
- Cambiar VERSION a '5.0.0'
- Los re-exports de bydFunctions no cambian

### Paso 4: Editar `functions/src/bydFunctions.ts`
Aplicar cambios en este orden:

1. **Imports (linea 8)**: Reemplazar `import * as functions from 'firebase-functions';` por:
   ```typescript
   import { onCall, onRequest, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
   import { onSchedule } from 'firebase-functions/v2/scheduler';
   ```

2. **Eliminar regionalFunctions (linea 24)**: Borrar `const regionalFunctions = functions.region(REGION);`

3. **HttpsError global**: Buscar y reemplazar TODAS las ocurrencias:
   - Buscar: `functions.https.HttpsError`
   - Reemplazar: `HttpsError`
   - Son ~39 ocurrencias

4. **onCall functions (19 funciones)**: Para cada una, reemplazar la firma:
   - Buscar: `regionalFunctions.https.onCall(async (data, context) => {`
   - Reemplazar: `onCall({ region: REGION }, async (request: CallableRequest) => {`
   - IMPORTANTE: Despues de reemplazar cada firma, dentro del body de esa funcion cambiar las
     referencias a `data` por `request.data`. Buscar el destructuring al inicio de cada funcion:
     - `const { vin } = data;` -> `const { vin } = request.data;`
     - `const { username, password, countryCode, controlPin, userId } = data;` -> `const { username, password, countryCode, controlPin, userId } = request.data;`
     - etc. (ver lista en seccion 3c)
   - Si alguna funcion usa `context.auth`, cambiar a `request.auth`

5. **onRequest function (1 funcion - bydMqttWebhook, linea 1014)**:
   - Buscar: `regionalFunctions.https.onRequest(async (req, res) => {`
   - Reemplazar: `onRequest({ region: REGION }, async (req, res) => {`
   - El body no cambia

6. **Scheduled functions (2 funciones)**:
   - `bydActiveTripMonitor` (linea 1587):
     ```
     ANTES:  regionalFunctions.runWith({ timeoutSeconds: 300 }).pubsub.schedule('every 1 minutes').onRun(async (context) => {
     DESPUES: onSchedule({ schedule: 'every 1 minutes', region: REGION, timeoutSeconds: 300 }, async (event) => {
     ```
   - `bydIdleHeartbeat` (linea 1619):
     ```
     ANTES:  regionalFunctions.runWith({ timeoutSeconds: 300 }).pubsub.schedule('every 3 hours').onRun(async (context) => {
     DESPUES: onSchedule({ schedule: 'every 3 hours', region: REGION, timeoutSeconds: 300 }, async (event) => {
     ```
   - Dentro de las funciones, si se usa `context` cambiarlo a `event` (o simplemente no usarlo si no se referencia)

### Paso 5: Editar `functions/src/googleMaps.ts`
- Eliminar `import * as functions from 'firebase-functions';`
- Cambiar `const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || functions.config().google?.maps_api_key;`
  a `const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;`

### Paso 6: Build y verificar
```bash
cd functions
npm run build
```
Debe compilar sin errores. Si hay errores de TypeScript, seran probablemente:
- `data` no existe en el scope (olvidaste cambiar a `request.data`)
- `functions` no definido (olvidaste cambiar algun `functions.https.HttpsError`)

### Paso 7: Deploy
```bash
cd functions
npm run deploy
```

IMPORTANTE: Firebase desplegara las funciones Gen 2 como funciones NUEVAS (Cloud Run based).
Las funciones Gen 1 antiguas se eliminaran automaticamente al desplegar con el mismo nombre.

### Paso 8: Verificar en produccion
1. Abrir la app BYD Stats
2. Verificar que QuickActions funciona (flash, lock, climate)
3. Verificar que el polling de viajes sigue funcionando
4. Verificar que bydConnect/bydDisconnect funciona

### Paso 9: Commit
```bash
git add functions/
git commit -m "feat: migrate Cloud Functions from Gen 1 to Gen 2

- Update firebase-functions to v6.x
- Convert all onCall functions to v2/https onCall with CallableRequest
- Convert scheduled functions to v2/scheduler onSchedule
- Convert onRequest to v2/https onRequest
- Remove deprecated functions.config() usage
- Remove deprecated regionalFunctions pattern
- No frontend changes needed (httpsCallable is compatible)"
```

---

## Resumen de Cambios por Archivo

| Archivo | Cambios |
|---------|---------|
| `functions/package.json` | Actualizar firebase-functions a ^6.3.0 |
| `functions/src/index.ts` | Imports Gen 2, eliminar regionalFunctions, migrar ping |
| `functions/src/bydFunctions.ts` | Imports Gen 2, migrar 19 onCall + 1 onRequest + 2 scheduled, HttpsError x39 |
| `functions/src/googleMaps.ts` | Eliminar import functions, eliminar functions.config() fallback |
| `src/services/bydApi.ts` | **SIN CAMBIOS** |

## Equivalencias Rapidas (Cheat Sheet)

| Gen 1 | Gen 2 |
|-------|-------|
| `import * as functions from 'firebase-functions'` | `import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'` |
| `functions.region(REGION).https.onCall(async (data, context) =>` | `onCall({ region: REGION }, async (request: CallableRequest) =>` |
| `data.vin` | `request.data.vin` |
| `context.auth` | `request.auth` |
| `functions.https.HttpsError(...)` | `HttpsError(...)` |
| `functions.region(R).https.onRequest(async (req, res) =>` | `onRequest({ region: R }, async (req, res) =>` |
| `functions.region(R).runWith({timeout}).pubsub.schedule(S).onRun(async (ctx) =>` | `onSchedule({ schedule: S, region: R, timeoutSeconds: T }, async (event) =>` |
| `functions.config().key` | `process.env.KEY` |

---

## Riesgos y Notas

1. **Compatibilidad cliente**: `httpsCallable` del SDK de Firebase web funciona igual con Gen 2. NO hay cambios en frontend.
2. **Cold starts**: Gen 2 usa Cloud Run, cold starts pueden ser ligeramente diferentes pero generalmente mejores.
3. **Concurrencia**: Gen 2 soporta multiples requests concurrentes por instancia (Gen 1 solo 1). Esto es una mejora.
4. **Timeout**: Gen 2 permite hasta 3600s (Gen 1 maximo 540s). Las funciones con timeout 300s se benefician.
5. **Deploy atomico**: Firebase desplegara Gen 2 funciones junto a las Gen 1 existentes. Una vez verificado, las Gen 1 se eliminan. Si el deploy falla, las Gen 1 siguen funcionando.
6. **Variables de entorno**: El `.env` funciona igual en Gen 2. No hay cambios.
7. **admin.initializeApp()**: Funciona igual en Gen 2. El doble try/catch en bydFunctions.ts es innecesario pero no rompe nada.
