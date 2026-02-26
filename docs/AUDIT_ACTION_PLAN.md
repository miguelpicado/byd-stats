# 🛡️ BYD-Stats Premium — Plan de Acción de Auditoría de Seguridad y Calidad

> **Documento autocontenido para agentes AI (Gemini, Sonnet, etc.)**
> Generado: 2026-02-26 | Rama: `PremiumAPK` | Repo: `BYD-Stats-Premium/byd-stats-premium`

---

## Contexto del Proyecto

**BYD-Stats Premium** es una app Android (APK) construida con:
- **Frontend:** React 19 + TypeScript + Vite 7 + TailwindCSS
- **Native wrapper:** Capacitor 8 (Android)
- **Backend:** Firebase Cloud Functions (Node.js/TS) — región `europe-west1`
- **Base de datos:** Firestore (eur3)
- **Integraciones:** BYD Auto API (vehículos eléctricos), Google Drive, Google OAuth, Smartcar, MQTT (Raspberry Pi listener)
- **AI/ML:** TensorFlow.js (Web Worker) para modelos de eficiencia, SoH batería, y predicción de parking
- **Wear OS:** Companion app con servicio de mensajería

La app permite a los usuarios conectar su vehículo BYD eléctrico, monitorizar estado en tiempo real (SoC, GPS, puertas), controlar el vehículo remotamente (lock/unlock, climatización), y analizar estadísticas de viajes y cargas.

---

## Estructura del Repositorio (Resumen)

```
byd-stats-premium/
├── src/                          # Frontend React (189 archivos)
│   ├── components/               # UI components (70 archivos)
│   ├── hooks/                    # Custom hooks (33 archivos)
│   ├── services/                 # API services
│   │   ├── firebase.ts           # Firestore client (270 líneas)
│   │   ├── bydApi.ts             # BYD API client (312 líneas)
│   │   └── googleDrive.ts        # Google Drive sync (517 líneas)
│   ├── core/                     # Utilities, logger, calculations
│   ├── features/                 # Feature modules (dashboard, navigation)
│   ├── providers/                # React context providers
│   └── workers/                  # Web Workers (TensorFlow)
├── functions/                    # Firebase Cloud Functions
│   └── src/
│       ├── index.ts              # Entry point (48 líneas)
│       ├── bydFunctions.ts       # ⚠️ MONOLITO 2698 líneas / 114KB
│       ├── googleMaps.ts         # Snap-to-road service
│       └── byd/                  # BYD client library
├── mqtt-listener/                # MQTT listener (Raspberry Pi)
│   └── src/index.ts              # Main listener (40KB)
├── android/                      # Capacitor Android project
│   ├── app/src/main/AndroidManifest.xml
│   └── wear/                     # Wear OS companion
├── .env                          # ⚠️ COMMITTEADO con claves reales
├── .env.example                  # Template
├── firestore.rules               # ⚠️ COMPLETAMENTE ABIERTO
├── firebase.json                 # Firebase config
└── package.json                  # Dependencies
```

---

## Tareas Ordenadas por Prioridad

> ⚠️ **REGLA:** No modifiques archivos fuera de tu tarea asignada. Si encuentras un problema tangencial, documéntalo pero no lo arregles.

---

### 🔴 PRIORIDAD 1 — CRÍTICA (Seguridad Inmediata)

#### Tarea 1.1: Cerrar Reglas de Firestore

**Archivo:** `firestore.rules`

**Estado actual:** TODAS las reglas son `allow read, write: if true` — sin autenticación.

**Lo que hay que hacer:**
1. Implementar reglas basadas en `request.auth.uid` para que cada usuario solo acceda a sus propios datos
2. Bloquear completamente la subcolección `private/` (solo accesible desde Cloud Functions con admin SDK)
3. Mantener acceso de lectura para datos legacy si es necesario, pero con auth

**Reglas propuestas:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // BYD Vehicles — solo el propietario puede leer/escribir
    match /bydVehicles/{vehicleId} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;

      // Credenciales — SOLO Cloud Functions (admin SDK)
      match /private/{doc} {
        allow read, write: if false;
      }

      // Trips — acceso del propietario
      match /trips/{tripId} {
        allow read, write: if request.auth != null
          && get(/databases/$(database)/documents/bydVehicles/$(vehicleId)).data.userId == request.auth.uid;

        match /points/{pointId} {
          allow read, write: if request.auth != null
            && get(/databases/$(database)/documents/bydVehicles/$(vehicleId)).data.userId == request.auth.uid;
        }
      }

      match /charges/{chargeId} {
        allow read, write: if request.auth != null
          && get(/databases/$(database)/documents/bydVehicles/$(vehicleId)).data.userId == request.auth.uid;
      }

      match /chargingSessions/{sessionId} {
        allow read, write: if request.auth != null
          && get(/databases/$(database)/documents/bydVehicles/$(vehicleId)).data.userId == request.auth.uid;
      }
    }

    // Users — solo su propio doc
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Legacy collections — bloquear o migrar
    match /trips/{tripId} {
      allow read: if request.auth != null;
      allow write: if false; // Solo lectura para migración
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
  }
}
```

**Validación:** Ejecutar `firebase emulators:start` y verificar que las reglas bloquean acceso no autenticado y entre usuarios distintos.

---

#### Tarea 1.2: Añadir Autenticación a Cloud Functions

**Archivo:** `functions/src/bydFunctions.ts`

**Estado actual:** Ninguna función `onCall` valida `request.auth`. Cualquiera puede invocar funciones de control del vehículo.

**Lo que hay que hacer:**
1. Crear un helper `requireAuth` reutilizable
2. Aplicarlo a TODAS las funciones exportadas
3. Validar que el `request.auth.uid` coincide con el `userId` almacenado en el documento del vehículo

**Helper a crear:**
```typescript
async function requireAuthAndOwnership(request: CallableRequest, vin: string): Promise<string> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const uid = request.auth.uid;

  const vehicleDoc = await db.collection('bydVehicles').doc(vin).get();
  if (!vehicleDoc.exists) {
    throw new HttpsError('not-found', 'Vehicle not found');
  }

  const vehicleData = vehicleDoc.data()!;
  if (vehicleData.userId !== uid) {
    throw new HttpsError('permission-denied', 'Not the vehicle owner');
  }

  return uid;
}
```

**Uso:** Añadir al inicio de cada función:
```typescript
export const bydGetRealtimeV2 = onCall({ region: REGION }, async (request) => {
  const { vin } = request.data;
  if (!vin) throw new HttpsError('invalid-argument', 'Missing VIN');
  await requireAuthAndOwnership(request, vin);
  // ... resto de la lógica
});
```

**Excepción:** `bydConnectV2` necesita un tratamiento especial porque crea el vínculo usuario-vehículo por primera vez. Solo validar `request.auth` sin ownership.

**Validación:** Intentar llamar funciones sin autenticación y verificar que devuelven error `unauthenticated`.

---

#### Tarea 1.3: Eliminar PIN de los Logs

**Archivo:** `functions/src/bydFunctions.ts`, línea ~445

**Estado actual:**
```typescript
console.log(`[${commandName}] Using PIN: length=${controlPin.length}, isNumeric=${isNumeric}, isUpper=${isUppercase}, rawVal=${controlPin}`);
```

**Lo que hay que hacer:** Eliminar `rawVal=${controlPin}` del log. Cambiar a:
```typescript
console.log(`[${commandName}] Using PIN: length=${controlPin.length}, isNumeric=${isNumeric}`);
```

**Búsqueda adicional:** Buscar otros `console.log` que puedan exponer datos sensibles en todo `bydFunctions.ts`. Patrones a buscar:
- `password`, `pin`, `token`, `encryToken`, `signToken` en logs
- Cualquier `rawVal` o dump completo de credenciales

**Validación:** `grep -n "rawVal\|password\|Pin.*=\|token.*=" functions/src/bydFunctions.ts` no debe devolver exposiciones de valores sensibles.

---

#### Tarea 1.4: Limpiar `.env` del Historial de Git

**Estado actual:** `.env` con claves reales de Firebase, Google OAuth y Smartcar está en el historial de git (commits: `33156ad`, `d00819c`, `960d3b9`).

**Lo que hay que hacer:**
1. `git rm --cached .env` (dejar de trackear)
2. Usar BFG Repo-Cleaner para limpiar el historial:
   ```bash
   bfg --delete-files .env
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   git push --force
   ```
3. **Rotar todas las claves comprometidas:**
   - Firebase API Key → Firebase Console > Project Settings
   - Google OAuth Client ID → Google Cloud Console > Credentials
   - Smartcar Client ID → Smartcar Dashboard
4. Verificar que `.env` sigue en `.gitignore`

**Validación:** `git log --all -- .env` no debe devolver commits.

---

### 🟠 PRIORIDAD 2 — ALTA

#### Tarea 2.1: Desactivar Cleartext Traffic en Release

**Archivo:** `android/app/src/main/AndroidManifest.xml`, línea 10

**Cambiar:**
```xml
android:usesCleartextTraffic="true"
```

**A:** Crear `android/app/src/main/res/xml/network_security_config.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">localhost</domain>
    <domain includeSubdomains="true">10.0.2.2</domain>
  </domain-config>
</network-security-config>
```

En `AndroidManifest.xml`:
```xml
android:usesCleartextTraffic="false"
android:networkSecurityConfig="@xml/network_security_config"
```

---

#### Tarea 2.2: Restringir Intent Filter SEND

**Archivo:** `android/app/src/main/AndroidManifest.xml`, líneas 37-41

**Cambiar** `android:mimeType="*/*"` por tipos específicos:
```xml
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="application/x-sqlite3" />
    <data android:mimeType="application/octet-stream" />
    <data android:mimeType="text/csv" />
    <data android:mimeType="application/json" />
</intent-filter>
```

---

#### Tarea 2.3: Limpieza de Archivos Debug/Log del Repo

**Archivos a eliminar (`git rm`):**

```
# Android build logs
android/build_error_full.txt          (224KB)
android/build_log.txt
android/build_log_2.txt
android/build_log_antigravity.txt     (106KB)
android/build_log_antigravity_debug.txt (112KB)

# Functions debug logs
functions/feb4_logs.txt               (63KB)
functions/feb4_logs_utf8.txt
functions/recent_flash_500.txt
functions/recent_flash_logs.txt
functions/recent_logs.txt             (52KB)
functions/recent_logs_1000.txt        (273KB)
functions/recent_logs_unfiltered.txt
functions/recent_logs_utf8.txt
functions/reprocess_log.txt

# Root temp files
tmp_diff.txt
test_flash.ts
REGISTRO_CARGAS.csv
REGISTRO_VIAJES.csv
```

**Añadir a `.gitignore`:**
```gitignore
# Debug/temp logs
functions/*.txt
android/build_*.txt
android/*_error*.txt
REGISTRO_*.csv
test_*.ts
tmp_*.txt
```

---

### 🟡 PRIORIDAD 3 — MEDIA

#### Tarea 3.1: Refactorizar `bydFunctions.ts` (2698 líneas → módulos)

**Archivo:** `functions/src/bydFunctions.ts`

**Separar en archivos:**

| Nuevo archivo | Contenido | Líneas aprox. |
|---|---|---|
| `functions/src/bydAuth.ts` | `bydConnectV2`, `bydDisconnectV2`, helpers de encriptación/desencriptación, `getBydClientForVehicle`, `getBydClientWithSession` | ~320 |
| `functions/src/bydData.ts` | `bydGetRealtimeV2`, `bydGetGpsV2`, `bydGetChargingV2`, `bydDiagnosticV2`, `bydDebugV2`, `bydWakeVehicleV2` | ~400 |
| `functions/src/bydControl.ts` | `executeControlCommand`, `bydLockV2`, `bydUnlockV2`, `bydStartClimateV2`, `bydStopClimateV2`, `bydFlashLightsV2`, `bydHonkHornV2`, `bydCloseWindowsV2`, `bydSeatClimateV2`, `bydBatteryHeatV2` | ~300 |
| `functions/src/bydPolling.ts` | `bydPollVehicle`, `bydActiveTripMonitorV2`, `bydIdleHeartbeatV2`, `pollVehicleInternal`, trip detection | ~800 |
| `functions/src/bydMqtt.ts` | `bydGetMqttCredentialsV2`, MQTT webhook handler | ~300 |
| `functions/src/bydTrips.ts` | `bydFixTripV2`, trip processing, snap-to-road | ~400 |
| `functions/src/helpers.ts` | `normalizeSoC`, `requireAuthAndOwnership`, shared Firestore refs, encryption | ~100 |

**`functions/src/index.ts`** re-exporta todo igual que ahora pero desde los nuevos módulos.

---

#### Tarea 3.2: Fix Bug de Stale Closure en `useProcessedData.ts`

**Archivo:** `src/hooks/useProcessedData.ts`, línea 329

**Problema:** `!isAiTraining` lee estado stale dentro del `useEffect` closure.

**Fix:**
```typescript
// Añadir ref al inicio del hook
const isTrainingRef = useRef(false);

// En el useEffect, usar la ref:
if (needsAutonomyTraining && !isTrainingRef.current) {
    isTrainingRef.current = true;
    setIsAiTraining(true);
    // ...
    .finally(() => {
        isTrainingRef.current = false;
        if (isMounted) setIsAiTraining(false);
    });
}
```

---

#### Tarea 3.3: Fix NaN en `firebase.ts`

**Archivo:** `src/services/firebase.ts`, línea 117

**Cambiar:**
```typescript
trip: data.distanceKm || (data.endOdometer - data.startOdometer) || 0,
```
**A:**
```typescript
trip: data.distanceKm || ((data.endOdometer != null && data.startOdometer != null) ? (data.endOdometer - data.startOdometer) : 0),
```

---

#### Tarea 3.4: Eliminar Código Muerto

1. **`src/hooks/useProcessedData.ts` línea 62:** Eliminar `const { } = useTranslation();`
2. **`src/hooks/useAppOrchestrator.ts` líneas 67-73:** Los 6 estados `allCharges*` no se usan en `App.tsx`. Eliminar o conectar.
3. **`package.json`:** Eliminar `prop-types` de dependencies.
4. **`package.json`:** Mover `@capacitor/cli` a `devDependencies`.
5. **`bydFunctions.ts`:** Eliminar JSDoc duplicados (líneas 553-554, 600-601, 248-249).

---

#### Tarea 3.5: Internacionalizar Strings Hardcodeados

**Archivo:** `src/hooks/useDatabase.ts`

Reemplazar strings en español por claves i18n:
- `'Error cargando SQL.js'` → `t('errors.sqlLoadFailed')`
- `'SQL no está listo'` → `t('errors.sqlNotReady')`
- `'CSV vacío o formato incorrecto'` → `t('errors.csvEmpty')`
- `'Sin datos'` → `t('errors.noData')`
- `'Tabla no encontrada'` → `t('errors.tableNotFound')`
- `'Formato JSON no reconocido'` → `t('errors.jsonFormatUnknown')`

---

### 🟢 PRIORIDAD 4 — BAJA

#### Tarea 4.1: Actualizar `firebase-admin` en MQTT Listener

**Archivo:** `mqtt-listener/package.json`

Cambiar `"firebase-admin": "^11.11.0"` → `"firebase-admin": "^12.0.0"` y ejecutar `npm install`.

#### Tarea 4.2: Añadir Documentación de Alto Nivel

Añadir un bloque JSDoc al inicio de:
- `src/hooks/useProcessedData.ts` — Explicar el pipeline de datos + AI + caching
- `src/hooks/useAppOrchestrator.ts` — Explicar el papel de orquestador central
- `src/services/googleDrive.ts` — Explicar el flujo de sync/merge

#### Tarea 4.3: Proteger WearableMessageListenerService

**Archivo:** `android/app/src/main/AndroidManifest.xml`, línea 52

Añadir permission:
```xml
<service
    android:name=".WearableMessageListenerService"
    android:exported="true"
    android:permission="com.google.android.gms.permission.BIND_LISTENER">
```

#### Tarea 4.4: Sanitizar MQTT `.env.example`

**Archivo:** `mqtt-listener/.env.example`, línea 18

Cambiar:
```
FIREBASE_WEBHOOK_URL=https://europe-west1-REDACTED_FIREBASE_PROJECT_ID.cloudfunctions.net/bydMqttWebhook
```
A:
```
FIREBASE_WEBHOOK_URL=https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/bydMqttWebhook
```

---

## Checklist de Verificación Post-Implementación

- [ ] `firebase emulators:start` → Verificar que reglas de Firestore bloquean acceso no autenticado
- [ ] Llamar Cloud Functions sin auth → Verifica error `unauthenticated`
- [ ] `grep -rn "rawVal\|console.log.*password\|console.log.*pin\|console.log.*token" functions/src/` → Sin resultados sensibles
- [ ] `git log --all -- .env` → Sin commits (tras limpieza de historial)
- [ ] `npm run build` → Sin errores tras eliminación de código muerto
- [ ] `npm run test` → Tests pasan
- [ ] APK Release build → Verificar que `usesCleartextTraffic` es false
- [ ] Verificar intent filter → La app no aparece al compartir archivos de tipo no soportado

---

## Notas para el Agente AI

1. **Trabaja SOLO en la rama `PremiumAPK`**. Confirma la rama antes de empezar: `git branch --show-current`
2. **El root del proyecto es:** `byd-stats-premium/` (dentro del workspace)
3. **No modifiques** `node_modules/`, `.git/`, `android/.gradle/`, ni `android/build/`
4. **Cada tarea es independiente.** Si se te asigna una tarea específica (e.g., "Tarea 1.2"), ejecuta SOLO esa tarea
5. **Haz commits atómicos** con mensajes descriptivos: `fix(security): add auth validation to Cloud Functions`
6. **Si una tarea tiene dependencias** (e.g., Tarea 1.2 depende del helper creado en 1.2), completa ambas
7. **Valida tu trabajo** ejecutando los comandos de verificación listados al final
