# 🛠️ Plan de Implementación — Auditoría de Seguridad 2026-03-03

> **Documento autocontenido.** Contiene todas las instrucciones, código y contexto necesarios para que cualquier LLM (Gemini, Sonnet, GPT, etc.) o desarrollador ejecute las correcciones sin necesidad de contexto adicional.

**Rama:** `PremiumAPK`  
**Raíz del proyecto:** `byd-stats-premium/`  
**Stack:** React 19 + Vite 7 + Capacitor 8 + Firebase + TypeScript

---

## Índice de Tareas

| # | Tarea | Severidad | Esfuerzo | Archivos afectados |
|---|-------|-----------|----------|-------------------|
| 1 | Eliminar `.env` del tracking de Git | 🔴 Crítico | Bajo | `.env` |
| 2 | Bloquear legacy Firestore rules | 🟠 Alto | Bajo | `firestore.rules` |
| 3 | Sanitizar error messages en Cloud Functions | 🟠 Alto | Bajo | `functions/src/bydFunctions.ts` |
| 4 | Fix bug SoH auto-training | 🟠 Alto | Bajo | `src/hooks/useProcessedData.ts` |
| 5 | Extraer `encrypt()` duplicada | 🟡 Medio | Bajo | `functions/src/bydFunctions.ts` |
| 6 | Fix memory leak en `waitForAuth` | 🟡 Medio | Bajo | `src/services/firebase.ts` |
| 7 | Eliminar permiso deprecated Android | 🟡 Medio | Bajo | `android/app/src/main/AndroidManifest.xml` |
| 8 | Limpiar duplicados y `any` types | 🟡 Medio | Medio | `src/services/bydApi.ts` |
| 9 | Eliminar `dist/` y `vitest.config.js` duplicado | 🟡 Medio | Bajo | Raíz |
| 10 | Mover scripts sueltos en `functions/` | 🟡 Medio | Bajo | `functions/` |

---

## Tarea 1: Eliminar `.env` del tracking de Git

**Severidad:** 🔴 Crítico  
**Archivo:** `.env`

### Contexto
El archivo `.env` contiene API keys reales de Firebase y Google Maps. Está en `.gitignore` pero fue commiteado previamente, por lo que Git lo sigue trackeando.

### Instrucciones (terminal)

```bash
# Desde la raíz del proyecto (byd-stats-premium/)
git rm --cached .env
git commit -m "security: remove .env from git tracking (keys will be rotated)"
```

### Post-acción manual (humano requerido)
1. **Rotar las siguientes keys** en las consolas correspondientes:
   - Firebase API Key → Firebase Console > Project Settings
   - Google Maps API Key → Google Cloud Console > APIs & Services > Credentials
   - Google OAuth Client ID → Google Cloud Console > APIs & Services > Credentials
2. **Restringir Google Maps API Key** por Android package name (`com.bydstats.app`) y HTTP referrers en Google Cloud Console.
3. Actualizar el `.env` local con las nuevas keys.

---

## Tarea 2: Bloquear legacy Firestore rules

**Severidad:** 🟠 Alto  
**Archivo:** `firestore.rules`

### Contexto
Las colecciones legacy (`trips`, `vehicles`, `chargeSessions`, `chargeNotifications`) permiten lectura a **cualquier usuario autenticado** sin verificar ownership. Esto expone datos de todos los usuarios a cualquier otro usuario autenticado.

### Código: Reemplazar las reglas legacy (líneas 77-100)

Buscar este bloque exacto en `firestore.rules`:

```
    // ==========================================================================
    // LEGACY COLLECTIONS (read-only para migración)
    // Estas colecciones son antiguas y no deben recibir escrituras nuevas.
    // Mantener lectura autenticada para no romper clientes existentes.
    // ==========================================================================
    match /trips/{tripId} {
      allow read: if request.auth != null;
      allow write: if false;

      match /points/{pointId} {
        allow read: if request.auth != null;
        allow write: if false;
      }
    }

    match /vehicles/{vehicleId} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    match /chargeSessions/{sessionId} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    match /chargeNotifications/{notificationId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
```

Reemplazar por:

```
    // ==========================================================================
    // LEGACY COLLECTIONS — FULLY BLOCKED
    // These collections are deprecated. No client should read or write to them.
    // Data has been migrated to bydVehicles/{vin}/trips, etc.
    // If any client still depends on these, it must be updated first.
    // ==========================================================================
    match /trips/{tripId} {
      allow read, write: if false;

      match /points/{pointId} {
        allow read, write: if false;
      }
    }

    match /vehicles/{vehicleId} {
      allow read, write: if false;
    }

    match /chargeSessions/{sessionId} {
      allow read, write: if false;
    }

    match /chargeNotifications/{notificationId} {
      allow read, write: if false;
    }
```

### Despliegue

```bash
firebase deploy --only firestore:rules
```

> ⚠️ **IMPORTANTE:** Antes de desplegar, confirmar que **ningún cliente activo** sigue leyendo de estas colecciones legacy. Buscar en el código frontend referencias a `collection(db, 'trips')` (sin `bydVehicles` como padre) — la ruta legacy está en `firebase.ts` línea 179 y solo se usa para `vehicleId` no-BYD (legacy UUIDs de 36 chars). Si aún hay usuarios legacy activos, considera una migración primero o mantener la lectura con ownership check via `resource.data.vehicleId`.

---

## Tarea 3: Sanitizar error messages en Cloud Functions

**Severidad:** 🟠 Alto  
**Archivo:** `functions/src/bydFunctions.ts`

### Contexto
Múltiples bloques `catch` re-lanzan `error.message` al cliente, lo que puede filtrar información interna del servidor (rutas de archivos, nombres de servicios, stack traces).

### Instrucciones
Buscar TODOS los patrones `catch (error: any)` seguidos de `throw new HttpsError('internal', error.message)` y reemplazar `error.message` por un mensaje genérico. **Mantener el `safeLog` para debugging interno.**

### Código: Patrón a buscar y reemplazar

Hay ~15 ocurrencias de este patrón en el archivo. Para cada una:

**Buscar:**
```typescript
    } catch (error: any) {
        safeLog('[FUNCTION_NAME] Error:', error.message);
        throw new HttpsError('internal', error.message);
    }
```

**Reemplazar por:**
```typescript
    } catch (error: any) {
        safeLog('[FUNCTION_NAME] Error:', error.message);
        throw new HttpsError('internal', 'Operation failed. Please try again later.');
    }
```

**Lista de funciones afectadas** (buscar por nombre para localizar cada `catch`):
1. `bydConnectV2` (~línea 246)
2. `bydDisconnectV2` (~línea 278)
3. `bydSaveAbrpToken` (~línea 332)
4. `bydGetRealtimeV2` (~línea 529)
5. `bydGetGpsV2` (~línea 568)
6. `bydGetChargingV2` (~línea 707)
7. `bydDiagnosticV2` (buscar en archivo)
8. `bydDebugV2` (buscar en archivo)
9. `bydWakeVehicleV2` (buscar en archivo)
10. `bydFixTripV2` (buscar en archivo)

**Excepciones — NO modificar estos:**
- `executeControlCommand` — tiene lógica de retry que usa `error.message` internamente (no lo expone al cliente directamente).
- Cualquier `throw new HttpsError('invalid-argument', ...)` o `throw new HttpsError('unauthenticated', ...)` — estos son errores de validación que SÍ deben informar al usuario.

### Verificación
```bash
# Desde functions/
grep -n "throw new HttpsError('internal', error.message)" src/bydFunctions.ts
# Debería devolver 0 resultados tras la corrección
```

---

## Tarea 4: Fix bug SoH auto-training

**Severidad:** 🟠 Alto  
**Archivo:** `src/hooks/useProcessedData.ts`

### Contexto
En la línea 418, la condición `if (needsSoHTraining && !isProcessing)` siempre es `false` porque `isProcessing` se setea a `true` en la línea 352 y la condición se evalúa dentro del mismo bloque `try`. El auto-training de SoH nunca se ejecuta.

### Código

**Buscar (línea ~418):**
```typescript
                    // Train SoH Model if needed
                    if (needsSoHTraining && !isProcessing) {
```

**Reemplazar por:**
```typescript
                    // Train SoH Model if needed
                    // Note: isProcessing is always true here (set on L352), so we use
                    // a separate guard to prevent concurrent SoH training.
                    if (needsSoHTraining && !isTrainingRef.current) {
```

### Verificación
Después del cambio, ejecutar la app con datos de carga y verificar en la consola que aparece:
```
[INFO] [useProcessedData] Auto-training SoH model...
[INFO] [useProcessedData] SoH model trained and cached
```

---

## Tarea 5: Extraer función `encrypt()` duplicada

**Severidad:** 🟡 Medio  
**Archivo:** `functions/src/bydFunctions.ts`

### Contexto
La función `encrypt()` está definida idénticamente dentro de `bydConnectV2` (líneas 173-179) y `bydSaveAbrpToken` (líneas 309-315). Violación DRY.

### Código

**Paso 1:** Añadir función top-level después de `getDecryptor()` (~línea 363):

```typescript
/**
 * Encrypt a string using AES-256-GCM with the token encryption key.
 * Returns format: iv_hex:authTag_hex:ciphertext_hex
 */
function encryptWithKey(text: string): string {
    const ENCRYPTION_KEY = tokenEncryptionKey.value();
    if (!ENCRYPTION_KEY) {
        throw new HttpsError('internal', 'Encryption key not configured');
    }
    const crypto = require('crypto');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
}
```

**Paso 2:** En `bydConnectV2`, reemplazar las líneas 166-179 (desde `const ENCRYPTION_KEY` hasta el cierre de `encrypt`):

**Buscar:**
```typescript
        const ENCRYPTION_KEY = tokenEncryptionKey.value();
        if (!ENCRYPTION_KEY) {
            throw new HttpsError('internal', 'Encryption key not configured');
        }

        const crypto = require('crypto');
        const encrypt = (text: string) => {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
            const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
            const authTag = cipher.getAuthTag();
            return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
        };
```

**Reemplazar por:**
```typescript
        const encrypt = encryptWithKey;
```

**Paso 3:** En `bydSaveAbrpToken`, aplicar exactamente el mismo reemplazo (buscar el mismo bloque y reemplazar por `const encrypt = encryptWithKey;`).

---

## Tarea 6: Fix memory leak en `waitForAuth`

**Severidad:** 🟡 Medio  
**Archivo:** `src/services/firebase.ts`

### Contexto
`waitForAuth` tiene un listener `onAuthStateChanged` que puede no limpiarse si el timeout se dispara primero.

### Código

**Buscar (líneas 69-87):**
```typescript
export const waitForAuth = async (timeoutMs = 5000): Promise<string | null> => {
    if (currentUser?.uid) return currentUser.uid;

    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            resolve(user?.uid || null);
        });

        // Fallback timeout
        setTimeout(() => {
            unsubscribe();
            if (!currentUser?.uid) {
                console.warn('[Firebase] Auth timeout after', timeoutMs, 'ms — continuing without auth');
            }
            resolve(currentUser?.uid || null); // Return current state (likely null) if timeout
        }, timeoutMs);
    });
};
```

**Reemplazar por:**
```typescript
export const waitForAuth = async (timeoutMs = 5000): Promise<string | null> => {
    if (currentUser?.uid) return currentUser.uid;

    return new Promise((resolve) => {
        let resolved = false;

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timer);
            unsubscribe();
            resolve(user?.uid || null);
        });

        const timer = setTimeout(() => {
            if (resolved) return;
            resolved = true;
            unsubscribe();
            if (!currentUser?.uid) {
                logger.warn('[Firebase] Auth timeout after', timeoutMs, 'ms — continuing without auth');
            }
            resolve(currentUser?.uid || null);
        }, timeoutMs);
    });
};
```

> **Nota:** También se cambia `console.warn` por `logger.warn` para consistencia con el sistema de logging del proyecto.

---

## Tarea 7: Eliminar permiso deprecated Android

**Severidad:** 🟡 Medio  
**Archivo:** `android/app/src/main/AndroidManifest.xml`

### Código

**Buscar (línea 87):**
```xml
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

**Reemplazar por:**
```xml
    <!-- READ_EXTERNAL_STORAGE removed: deprecated since API 33 (Android 13).
         File access is handled by Capacitor File Picker via Storage Access Framework. -->
```

### Verificación
Compilar el APK y verificar que la importación de archivos SQLite/CSV sigue funcionando:
```bash
npm run android:build
```

---

## Tarea 8: Limpiar `any` types y JSDoc duplicado en bydApi.ts

**Severidad:** 🟡 Medio  
**Archivo:** `src/services/bydApi.ts`

### Código — Paso 1: Eliminar JSDoc duplicado

**Buscar (líneas 254-259):**
```typescript
/**
 * Get full diagnostic
 */
/**
 * Get full diagnostic
 */
```

**Reemplazar por:**
```typescript
/**
 * Get full diagnostic
 */
```

### Código — Paso 2: Tipar `httpsCallable` correctamente

Para cada `httpsCallable<any, ...>`, reemplazar el primer tipo genérico (`any` = tipo de request) por el tipo de datos que se envía. Ejemplo:

**Buscar:**
```typescript
    const callable = httpsCallable<any, BydConnectResult>(functions, 'bydConnectV2');
```

**Reemplazar por:**
```typescript
    const callable = httpsCallable<{ username: string; password: string; countryCode: string; controlPin?: string; userId?: string }, BydConnectResult>(functions, 'bydConnectV2');
```

**Lista completa de reemplazos:**

| Función | Request Type |
|---------|-------------|
| `bydConnect` | `{ username: string; password: string; countryCode: string; controlPin?: string; userId?: string }` |
| `bydDisconnect` | `{ vin: string }` |
| `bydSaveAbrpToken` | `{ vin: string; token: string }` |
| `bydGetRealtime` | `{ vin: string }` |
| `bydGetGps` | `{ vin: string }` |
| `bydGetCharging` | `{ vin: string }` |
| `bydLock` | `{ vin: string; pin?: string }` |
| `bydUnlock` | `{ vin: string; pin?: string }` |
| `bydStartClimate` | `{ vin: string; temperature?: number; pin?: string; timeSpan?: number; cycleMode?: number }` |
| `bydStopClimate` | `{ vin: string; pin?: string }` |
| `bydFlashLights` | `{ vin: string; pin?: string }` |
| `bydHonkHorn` | `{ vin: string; pin?: string }` |
| `bydCloseWindows` | `{ vin: string; pin?: string }` |
| `bydSeatClimate` | `{ vin: string; mainHeat?: number; mainVentilation?: number; copilotHeat?: number; copilotVentilation?: number; pin?: string }` |
| `bydBatteryHeat` | `{ vin: string; pin?: string }` |
| `bydDiagnostic` | `{ vin: string }` |
| `bydDebugDump` | `{ vin: string }` |
| `bydWakeVehicle` | `{ vin: string }` |
| `bydFixTrip` | `{ vin: string; tripId: string; overrideValues?: Record<string, unknown> }` |

### Código — Paso 3: Tipar `raw` y return types

**Buscar:**
```typescript
    raw?: any;
```
**Reemplazar por:**
```typescript
    raw?: Record<string, unknown>;
```

**Buscar:**
```typescript
export async function bydDebugDump(vin: string): Promise<{ success: boolean; dump: any }> {
    const callable = httpsCallable<any, { success: boolean; dump: any }>(functions, 'bydDebugV2');
```
**Reemplazar por:**
```typescript
export async function bydDebugDump(vin: string): Promise<{ success: boolean; dump: Record<string, unknown> }> {
    const callable = httpsCallable<{ vin: string }, { success: boolean; dump: Record<string, unknown> }>(functions, 'bydDebugV2');
```

**Buscar:**
```typescript
export async function bydFixTrip(vin: string, tripId: string, overrideValues?: any): Promise<{
    success: boolean;
    updates?: any;
    analysis?: any;
    message?: string;
}> {
    const callable = httpsCallable<any, any>(functions, 'bydFixTripV2');
```
**Reemplazar por:**
```typescript
export async function bydFixTrip(vin: string, tripId: string, overrideValues?: Record<string, unknown>): Promise<{
    success: boolean;
    updates?: Record<string, unknown>;
    analysis?: Record<string, unknown>;
    message?: string;
}> {
    const callable = httpsCallable<{ vin: string; tripId: string; overrideValues?: Record<string, unknown> }, {
        success: boolean;
        updates?: Record<string, unknown>;
        analysis?: Record<string, unknown>;
        message?: string;
    }>(functions, 'bydFixTripV2');
```

---

## Tarea 9: Limpiar archivos innecesarios del repo

**Severidad:** 🟡 Medio

### Instrucciones (terminal)

```bash
# Eliminar dist/ del tracking (ya está en .gitignore)
git rm -r --cached dist/ 2>/dev/null

# Eliminar vitest.config.js duplicado (mantener .ts)
rm vitest.config.js

git add -A
git commit -m "chore: remove dist/ from tracking and duplicate vitest.config.js"
```

---

## Tarea 10: Mover scripts sueltos en `functions/`

**Severidad:** 🟡 Medio

### Contexto
Hay ~12 scripts de utilidad/debug sueltos en la raíz de `functions/` mezclados con el código fuente.

### Instrucciones (terminal)

```bash
cd functions/

# Crear directorio de scripts si no existe
mkdir -p scripts/admin

# Mover scripts sueltos
mv call_cleanup.cjs scripts/admin/
mv check_trips.cjs scripts/admin/
mv get_creds.js scripts/admin/
mv get_creds.ts scripts/admin/
mv inspect_today_trips.js scripts/admin/
mv list_trips.cjs scripts/admin/
mv query_trips.js scripts/admin/
mv query_trips_function.js scripts/admin/
mv recover_trip.cjs scripts/admin/
mv reprocess_trip_snap.js scripts/admin/
mv reset_polling.cjs scripts/admin/
mv set_capacity.js scripts/admin/
mv test_md5.js scripts/admin/
mv wipe_sessions.ts scripts/admin/

cd ..
git add -A
git commit -m "chore: organize functions/ utility scripts into scripts/admin/"
```

---

## Verificación Global

Tras completar todas las tareas, ejecutar:

```bash
# Type check
npm run type-check

# Tests
npm run test -- --run

# Lint
npm run lint

# Build (asegura que Vite compila sin errores)
npm run build

# Functions build
cd functions && npm run build && cd ..
```

**Criterios de éxito:**
- ✅ `type-check` sin errores
- ✅ Tests pasan (puede haber tests pre-existentes fallando, no deben añadirse nuevos fallos)
- ✅ `build` exitoso
- ✅ `git status` no muestra `.env` como tracked
- ✅ `grep "throw new HttpsError('internal', error.message)" functions/src/bydFunctions.ts` devuelve 0 resultados

---

## Orden de Ejecución Recomendado

```
Tarea 1 (git rm .env)          → Requiere acción humana posterior (rotar keys)
Tarea 2 (Firestore rules)      → Requiere confirmar que no hay clientes legacy activos
Tarea 4 (Fix SoH bug)          → Independiente, sin riesgo
Tarea 6 (Fix waitForAuth)      → Independiente, sin riesgo
Tarea 7 (Android manifest)     → Independiente, sin riesgo
Tarea 3 (Error messages)       → Requiere testing funcional de Cloud Functions
Tarea 5 (Extract encrypt)      → Requiere testing funcional de Cloud Functions
Tarea 8 (any types)            → Solo types, sin cambio funcional
Tarea 9 (Cleanup archivos)     → Solo organización
Tarea 10 (Mover scripts)       → Solo organización
```
