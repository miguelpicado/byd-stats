# 🔍 Auditoría Completa — BYD-Stats-Premium (`PremiumAPK`)

**Fecha:** 2026-03-03  
**Rama:** `PremiumAPK`  
**Scope:** Repositorio completo (src, functions, android, mqtt-listener, configs)

---

## Archivos Clave Detectados

| Área | Archivos |
|------|----------|
| **Config / Secrets** | `.env`, `.env.example`, `.gitignore`, `capacitor.config.json` |
| **Android** | `android/app/src/main/AndroidManifest.xml` |
| **Firebase** | `firestore.rules`, `firebase.json`, `firestore.indexes.json` |
| **Services** | `firebase.ts`, `bydApi.ts`, `googleDrive.ts`, `StorageService.ts` |
| **Hooks (38)** | `useProcessedData.ts`, `useAppData.ts`, `useDatabase.ts`, `useGoogleSync.ts`, etc. |
| **Cloud Functions** | `functions/src/bydFunctions.ts` (3,042 líneas) |
| **MQTT Listener** | `mqtt-listener/src/` |
| **Core** | `core/logger.ts`, `core/dataProcessing.ts`, `core/batteryCalculations.ts` |

---

## 1. 🔐 Seguridad y Vulnerabilidades

---

**[SEGURIDAD]** | **🔴 Crítico**
- **Archivo/Ubicación:** [.env](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/.env)
- **Descripción:** El archivo `.env` con API keys reales de Firebase (`AIzaSyDHKIVJ18ox5C_6dYNEaZmlp_q14jZpIhA`), Google Maps (`AIzaSyCQiK7QVEf15EDpa7JHAAtknnvJVh8Y0CM`), y Google OAuth Client ID está **tracked en Git** a pesar de estar en `.gitignore`. Esto significa que las keys están en el historial de commits y cualquier persona con acceso al repo puede extraerlas.
- **Impacto:** Abuso de quotas de Firebase/Google Maps, acceso no autorizado al proyecto Firebase, costes inesperados. Google Maps API key sin restricciones puede generar facturación masiva.
- **Solución propuesta:**
  1. `git rm --cached .env` para dejar de trackear el archivo
  2. Rotar ALL API keys inmediatamente (Firebase Console + Google Cloud Console)
  3. Restringir Google Maps API key por referrer/package en Google Cloud Console
  4. Considerar usar [git-filter-repo](https://github.com/newren/git-filter-repo) para eliminar del historial
- **Esfuerzo estimado:** Medio

---

**[SEGURIDAD]** | **🟠 Alto**
- **Archivo/Ubicación:** [firestore.rules](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/firestore.rules#L77-L100) (líneas 77-100)
- **Descripción:** Las colecciones legacy (`trips`, `vehicles`, `chargeSessions`, `chargeNotifications`) permiten **lectura a cualquier usuario autenticado** sin verificar ownership. Cualquier usuario con una cuenta Firebase puede leer TODOS los trips/vehículos/sesiones de carga de TODOS los demás usuarios.
- **Impacto:** Fuga de datos sensibles: rutas de viaje (ubicaciones), patrones de carga, información del vehículo de otros usuarios.
- **Solución propuesta:**
  ```
  // Bloquear lectura o restringir por userId
  match /trips/{tripId} {
    allow read: if request.auth != null 
      && resource.data.vehicleId == request.auth.uid; // O el campo correcto
    allow write: if false;
  }
  ```
  Si son colecciones abandonadas sin campo `userId`, añadir `userId` vía migración o directamente bloquear: `allow read, write: if false;`
- **Esfuerzo estimado:** Bajo

---

**[SEGURIDAD]** | **🟠 Alto**
- **Archivo/Ubicación:** [bydFunctions.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/functions/src/bydFunctions.ts#L246-L248) (líneas 246-248 y múltiples `catch`)
- **Descripción:** Los bloques `catch` en Cloud Functions re-lanzan el `error.message` original directamente al cliente: `throw new HttpsError('internal', error.message)`. Esto puede filtrar información interna del servidor (stack traces, nombres de servicios internos, rutas de archivos).
- **Impacto:** Information disclosure que facilita ataques dirigidos. Un atacante puede obtener detalles de la infraestructura interna.
- **Solución propuesta:**
  ```typescript
  catch (error: any) {
    safeLog('[bydConnect] Error:', error.message);
    throw new HttpsError('internal', 'An error occurred. Please try again.');
  }
  ```
  Mantener el log interno para debugging, pero enviar mensaje genérico al cliente.
- **Esfuerzo estimado:** Bajo

---

**[SEGURIDAD]** | **🟡 Medio**
- **Archivo/Ubicación:** [AndroidManifest.xml](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/android/app/src/main/AndroidManifest.xml#L87) (línea 87)
- **Descripción:** Se solicita `READ_EXTERNAL_STORAGE`, un permiso **deprecated** desde Android 13 (API 33). También es un permiso excesivamente amplio para la funcionalidad de importar archivos SQLite/CSV.
- **Impacto:** Play Store warnings, rechazo en revisión, y acceso innecesario a archivos del usuario.
- **Solución propuesta:** Reemplazar por `READ_MEDIA_*` para Android 13+ o eliminar si Capacitor File Picker ya maneja los permisos correctamente con SAF (Storage Access Framework).
- **Esfuerzo estimado:** Bajo

---

**[SEGURIDAD]** | **🟡 Medio**
- **Archivo/Ubicación:** [firebase.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/services/firebase.ts#L39-L47) (líneas 39-47)
- **Descripción:** Se realiza `signInAnonymously()` al cargar el módulo, y si falla se ignora con un `catch` que usa `logger.warn`. Esto permite funcionar sin autenticación, pero las Firestore rules requieren `request.auth != null`, lo que significa que operaciones fallarán silenciosamente si el auth anónimo falla.
- **Impacto:** Flujo de autenticación inconsistente. En desarrollo puede funcionar sin auth, pero en producción podría causar estados inestables.
- **Solución propuesta:** Eliminar el fallback silencioso en producción. Si auth falla, debería mostrar un estado claro al usuario de que no puede acceder a datos.
- **Esfuerzo estimado:** Bajo

---

**[SEGURIDAD]** | **🟢 Bajo**
- **Archivo/Ubicación:** [bydFunctions.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/functions/src/bydFunctions.ts#L172) (múltiples)
- **Descripción:** `const crypto = require('crypto')` se importa de forma dinámica dentro de funciones en lugar de en el top-level. Aunque funcional, dificulta tree-shaking y no sigue best practices de Node.js.
- **Solución propuesta:** Mover `import crypto from 'node:crypto'` al inicio del archivo.
- **Esfuerzo estimado:** Bajo

---

## 2. 🧹 Calidad y Limpieza de Código

---

**[CALIDAD]** | **🟠 Alto**
- **Archivo/Ubicación:** [bydFunctions.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/functions/src/bydFunctions.ts) — 3,042 líneas, 115 funciones
- **Descripción:** Archivo monolítico de **130 KB** que contiene TODA la lógica de Cloud Functions: autenticación, CRUD, control remoto del vehículo, polling, procesamiento de viajes, sesiones MQTT, diagnósticos, etc. Viola el SRP (Single Responsibility Principle) de forma extrema.
- **Impacto:** Mantenimiento muy difícil, alto riesgo de efectos secundarios en cualquier cambio, imposible testear unitariamente, cold-starts de Cloud Functions más lentos.
- **Solución propuesta:** Dividir en módulos:
  - `auth.ts` — `requireAuth`, `requireAuthAndOwnership`, `checkRateLimit`
  - `connect.ts` — `bydConnectV2`, `bydDisconnectV2`
  - `vehicle.ts` — `bydGetRealtimeV2`, `bydGetGpsV2`, `bydGetChargingV2`
  - `control.ts` — `bydLockV2`, `bydUnlockV2`, `bydStartClimateV2`, etc.
  - `polling.ts` — `pollVehicleInternal`, `bydWakeVehicleV2`
  - `trips.ts` — Procesamiento y corrección de viajes
  - `crypto.ts` — `encrypt`, `getDecryptor`
- **Esfuerzo estimado:** Alto

---

**[CALIDAD]** | **🟡 Medio**
- **Archivo/Ubicación:** [bydApi.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/services/bydApi.ts) — múltiples usos de `any`
- **Descripción:** Uso extensivo de `any` en tipos: `raw?: any` (L50), `httpsCallable<any, ...>` (L92, L107, etc.), `overrideValues?: any` (L311), `updates?: any` (L313), `analysis?: any` (L314). Esto anula las ventajas de TypeScript y puede ocultar bugs en tiempo de compilación.
- **Impacto:** Bugs silentes, pérdida de autocompletado, tipos incorrectos que solo se detectan en runtime.
- **Solución propuesta:** Reemplazar cada `any` con tipos específicos. Por ejemplo:
  ```typescript
  export async function bydFixTrip(vin: string, tripId: string, overrideValues?: Record<string, unknown>): Promise<{
      success: boolean;
      updates?: Record<string, unknown>;
      analysis?: TripAnalysis;
      message?: string;
  }> { ... }
  ```
- **Esfuerzo estimado:** Medio

---

**[CALIDAD]** | **🟡 Medio**
- **Archivo/Ubicación:** [bydFunctions.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/functions/src/bydFunctions.ts#L173-L179) y [L309-L315](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/functions/src/bydFunctions.ts#L309-L315)
- **Descripción:** La función `encrypt()` está **duplicada** en al menos dos lugares (dentro de `bydConnectV2` y `bydSaveAbrpToken`). Misma lógica copiada verbatim, violando DRY.
- **Impacto:** Si se descubre un bug o se necesita cambiar el algoritmo de encriptación, hay que encontrar y modificar todas las copias.
- **Solución propuesta:** Extraer a una función top-level `encrypt(text: string, encryptionKey: string): string` reutilizable.
- **Esfuerzo estimado:** Bajo

---

**[CALIDAD]** | **🟡 Medio**
- **Archivo/Ubicación:** Directorio `functions/` raíz
- **Descripción:** Scripts de utilidad/debug mezclados con el código fuente: `call_cleanup.cjs`, `check_trips.cjs`, `get_creds.js`, `get_creds.ts`, `inspect_today_trips.js`, `list_trips.cjs`, `query_trips.js`, `recover_trip.cjs`, `reset_polling.cjs`, `set_capacity.js`, `test_md5.js`, `wipe_sessions.ts`. Algunos incluyendo lógica que accede a Firestore admin.
- **Impacto:** Confusión sobre qué es código de producción vs. tooling. Scripts con acceso admin no deberían estar junto al código fuente.
- **Solución propuesta:** Moverlos a `functions/scripts/` o `functions/tools/` y añadir al `.gitignore` si contienen datos sensibles.
- **Esfuerzo estimado:** Bajo

---

**[CALIDAD]** | **🟢 Bajo**
- **Archivo/Ubicación:** [bydApi.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/services/bydApi.ts#L257-L258) (líneas 257-258)
- **Descripción:** JSDoc duplicado — bloque `/** Get full diagnostic */` aparece dos veces consecutivas antes de `bydDiagnostic`.
- **Solución propuesta:** Eliminar el duplicado.
- **Esfuerzo estimado:** Bajo

---

## 3. 🐛 Bugs y Errores Potenciales

---

**[BUGS]** | **🟠 Alto**
- **Archivo/Ubicación:** [useProcessedData.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/hooks/useProcessedData.ts#L418) (línea 418)
- **Descripción:** La condición `if (needsSoHTraining && !isProcessing)` usa el **estado `isProcessing`** que ya fue seteado a `true` en la línea 352. Esto significa que `!isProcessing` siempre es `false` cuando se evalúa dentro del bloque `try`, por lo que **el entrenamiento SoH nunca se ejecuta automáticamente**.
- **Impacto:** El modelo de SoH solo se entrena manualmente (`recalculateSoH`), nunca automáticamente al cambiar los datos de carga. El usuario no recibe predicciones SoH actualizadas.
- **Solución propuesta:** Usar un `ref` independiente como `isTrainingRef` o una variable local:
  ```typescript
  // En vez de: if (needsSoHTraining && !isProcessing)
  if (needsSoHTraining && !isSoHTrainingRef.current) {
      isSoHTrainingRef.current = true;
      // ...
  }
  ```
- **Esfuerzo estimado:** Bajo

---

**[BUGS]** | **🟡 Medio**
- **Archivo/Ubicación:** [firebase.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/services/firebase.ts#L69-L87) (líneas 69-87)
- **Descripción:** `waitForAuth` tiene un potencial **memory leak**: si el timer de timeout se dispara primero, se resuelve la promise, pero el listener `onAuthStateChanged` también puede dispararse después, intentando resolver una promise ya resuelta. Aunque no causa un error, el `unsubscribe` en la línea 74 solo se ejecuta si el auth se resuelve primero.
- **Impacto:** Listener de auth huérfano que no se limpia en el camino del timeout.
- **Solución propuesta:**
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
              resolve(currentUser?.uid || null);
          }, timeoutMs);
      });
  };
  ```
- **Esfuerzo estimado:** Bajo

---

**[BUGS]** | **🟡 Medio**
- **Archivo/Ubicación:** [useProcessedData.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/hooks/useProcessedData.ts#L197-L198) (líneas 197-198)
- **Descripción:** Acceso a `allTrips[len - 1]` y `allTrips[0]` sin verificar que `allTrips` no esté vacío. Aunque hay un guard `allTrips.length >= 5`, la misma lógica del hash se repite en la línea 299-303 con un guard `allTrips.length === 0`, pero sin protección para `len - 1`.
- **Impacto:** Posible crash si `allTrips` está vacío en un edge case no previsto.
- **Solución propuesta:** Ya existe el guard en L299, pero añadir guard defensivo:
  ```typescript
  if (!allTrips || allTrips.length === 0) return '';
  ```
- **Esfuerzo estimado:** Bajo

---

## 4. ⚡ Optimizaciones de Rendimiento

---

**[RENDIMIENTO]** | **🟡 Medio**
- **Archivo/Ubicación:** [useProcessedData.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/hooks/useProcessedData.ts#L266-L523) (efecto principal)
- **Descripción:** El `useEffect` principal (260 líneas) se re-ejecuta cuando cambian `filteredTrips`, `allTrips`, `settings`, `charges`, `language`, o `recalcTrigger`. Dado que `settings` es un objeto, cualquier re-render del padre que pase un nuevo objeto `settings` (incluso si es idéntico en contenido) dispara un re-procesamiento completo incluyendo Web Worker + potencial re-entrenamiento de modelos AI.
- **Impacto:** Re-procesamiento innecesario de datos (potencialmente cientos de ms), re-entrenamiento de modelos ML, uso excesivo de CPU/batería.
- **Solución propuesta:** Usar `useMemo` o un hash comparativo para `settings`/`charges` y solo ejecutar el efecto cuando realmente cambian los datos:
  ```typescript
  const settingsHash = useMemo(() => JSON.stringify(settings), [settings]);
  // Usar settingsHash en la dependency array del useEffect
  ```
- **Esfuerzo estimado:** Medio

---

**[RENDIMIENTO]** | **🟡 Medio**
- **Archivo/Ubicación:** [firestore.rules](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/firestore.rules#L29-L34) (líneas 29-34)
- **Descripción:** Las reglas de subcollecciones (`trips`, `charges`, `chargingSessions`, `autoCharges`) bajo `bydVehicles/{vehicleId}` usan `get()` para verificar ownership del vehículo padre en CADA operación de lectura/escritura. Cada `get()` cuenta como una lectura de Firestore adicional.
- **Impacto:** Coste x2 en lecturas de Firestore para cada operación en subcollecciones. Si un usuario tiene 500 trips, listarlos genera 501 lecturas (500 trips + 500 get del padre) en lugar de 500.
- **Solución propuesta:** Usar una estructura basada en Custom Claims de Firebase Auth para evitar `get()` en cada regla, o propagar `userId` a las subcollecciones para evitar el `get()` del documento padre.
- **Esfuerzo estimado:** Alto

---

**[RENDIMIENTO]** | **🟢 Bajo**
- **Archivo/Ubicación:** [googleDrive.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/services/googleDrive.ts#L290) (línea 290)
- **Descripción:** `uploadFile` serializa todo el `SyncData` con `JSON.stringify(data)` sin compresión. Para usuarios con muchos trips/charges, este payload puede ser grande.
- **Impacto:** Uploads lentos en conexiones móviles, mayor consumo de datos.
- **Solución propuesta:** Considerar compresión gzip antes del upload, o implementar diffs incrementales.
- **Esfuerzo estimado:** Medio

---

## 5. 🏗️ Arquitectura y Estructura del Repo

---

**[ARQUITECTURA]** | **🟠 Alto**
- **Archivo/Ubicación:** `functions/src/bydFunctions.ts` — 3,042 líneas en un solo archivo
- **Descripción:** Como mencionado en Calidad, este monolito contiene toda la lógica backend. Pero desde el punto de vista arquitectónico, el problema es más profundo: no hay separación de capas (controller/service/repository), la lógica de negocio está mezclada con la infraestructura de Firebase, y no hay inyección de dependencias.
- **Impacto:** Imposible testear unitariamente sin mockear Firebase completo. Los cold starts de Cloud Functions cargan TODO el archivo incluso si solo se invoca una función.
- **Solución propuesta:** Adoptar una arquitectura por capas:
  ```
  functions/src/
  ├── handlers/          # onCall/onRequest handlers (thin layer)
  ├── services/          # Business logic
  ├── repositories/      # Firestore operations
  ├── utils/             # Crypto, logging, rate limiting
  └── index.ts           # Export all functions
  ```
- **Esfuerzo estimado:** Alto

---

**[ARQUITECTURA]** | **🟡 Medio**
- **Archivo/Ubicación:** `.gitignore` + `dist/` directory
- **Descripción:** El directorio `dist/` (build artifacts) está presente en el repo. Aunque está en `.gitignore`, que esté listado en `list_dir` sugiere que fue commiteado en algún momento o no se limpió correctamente.
- **Impacto:** Repo inflado innecesariamente, posible confusión sobre qué versión del build está en producción.
- **Solución propuesta:** `git rm -r --cached dist/` y verificar que `.gitignore` lo excluya correctamente (ya está incluido).
- **Esfuerzo estimado:** Bajo

---

**[ARQUITECTURA]** | **🟡 Medio**
- **Archivo/Ubicación:** `vitest.config.js` + `vitest.config.ts`
- **Descripción:** Existen **dos archivos de configuración de Vitest** (`.js` y `.ts`). Esto puede causar confusión sobre cuál se usa realmente.
- **Impacto:** Comportamiento inesperado al ejecutar tests si Vitest resuelve uno u otro dependiendo del contexto.
- **Solución propuesta:** Eliminar el archivo `.js` y mantener solo `vitest.config.ts`.
- **Esfuerzo estimado:** Bajo

---

## 6. 📦 Dependencias y Build

---

**[DEPENDENCIAS]** | **🟡 Medio**
- **Archivo/Ubicación:** [package.json](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/package.json#L35) (línea 35)
- **Descripción:** `@tensorflow/tfjs` (v4.22.0) es una dependencia **muy pesada** (~3MB minificada). Se usa únicamente para modelos de predicción de autonomía, SoH y parking que se ejecutan en un Web Worker.
- **Impacto:** Aumenta significativamente el tamaño del bundle y las builds. En el contexto de un APK de Capacitor, esto añade peso a la app.
- **Solución propuesta:** Evaluar si `@tensorflow/tfjs` se puede reemplazar por una solución más ligera (e.g., `onnxruntime-web` o modelos lineales simples sin framework). Si es necesario mantenerlo, asegurar que solo se carga en el Web Worker y nunca en el main thread (ya parece ser el caso vía Comlink).
- **Esfuerzo estimado:** Alto

---

**[DEPENDENCIAS]** | **🟢 Bajo**
- **Archivo/Ubicación:** [package.json](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/package.json#L85-L91) (líneas 85-91)
- **Descripción:** Hay `overrides` para `tar`, `rollup`, `serialize-javascript`, `ajv`, y `minimatch` para forzar versiones mínimas seguras. Esto indica que las dependencias transitivas tenían **CVEs conocidos** que se han parcheado manualmente.
- **Impacto:** Correcto como medida temporal, pero los overrides deben revisarse periódicamente ya que las dependencias directas deberían actualizarse para resolverlos nativamente.
- **Solución propuesta:** Ejecutar `npm audit` y verificar si los overrides siguen siendo necesarios con las versiones actuales de dependencias directas.
- **Esfuerzo estimado:** Bajo

---

## 7. 📋 Documentación y Mantenibilidad

---

**[DOCUMENTACIÓN]** | **🟡 Medio**
- **Archivo/Ubicación:** [useProcessedData.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/hooks/useProcessedData.ts) — 550 líneas
- **Descripción:** El hook más complejo de la app (gestiona Web Workers, 4 modelos ML, caching multi-capa) tiene un JSDoc de 8 líneas al inicio pero **ningún comentario inline** explicando la lógica de caching, las condiciones para re-entrenamiento, o el flujo de datos. Los nombres de variables como `aiCacheRef`, `sohCacheRef`, `parkingCacheRef`, `efficiencyCacheRef` son descriptivos pero la interacción entre ellos no se documenta.
- **Impacto:** Onboarding muy difícil. Un nuevo desarrollador necesitaría días para entender la lógica de caching y re-entrenamiento.
- **Solución propuesta:** Añadir JSDoc con `@remarks` explicando el flujo, un diagrama de estado, y comentarios inline en las decisiones de caching y training.
- **Esfuerzo estimado:** Medio

---

**[DOCUMENTACIÓN]** | **🟢 Bajo**
- **Archivo/Ubicación:** [bydFunctions.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/functions/src/bydFunctions.ts)
- **Descripción:** Las funciones están well-commented individualmente con JSDoc, pero falta un **documento de arquitectura** que explique el flujo completo: cómo se conecta un vehículo, cómo se gestionan las sesiones MQTT, cómo funciona el polling, cuándo se crean/cierran trips automáticamente.
- **Solución propuesta:** Crear un `functions/README.md` o `docs/backend-architecture.md` con diagramas de secuencia.
- **Esfuerzo estimado:** Medio

---

## 📊 Resumen Ejecutivo

### Hallazgos por Área y Severidad

| Área | 🔴 Crítico | 🟠 Alto | 🟡 Medio | 🟢 Bajo | **Total** |
|------|:----:|:----:|:----:|:----:|:----:|
| 🔐 Seguridad | 1 | 2 | 2 | 1 | **6** |
| 🧹 Calidad | 0 | 1 | 3 | 1 | **5** |
| 🐛 Bugs | 0 | 1 | 2 | 0 | **3** |
| ⚡ Rendimiento | 0 | 0 | 2 | 1 | **3** |
| 🏗️ Arquitectura | 0 | 1 | 2 | 0 | **3** |
| 📦 Dependencias | 0 | 0 | 1 | 1 | **2** |
| 📋 Documentación | 0 | 0 | 1 | 1 | **2** |
| **Total** | **1** | **5** | **13** | **5** | **24** |

### 🔥 Top 5 Prioridades

| # | Hallazgo | Justificación |
|---|----------|--------------|
| 1 | **`.env` con API keys en Git** | 🔴 Riesgo inmediato de abuso. Las keys ya están en el historial y deben rotarse YA. |
| 2 | **Legacy Firestore rules sin ownership check** | 🟠 Cualquier usuario autenticado puede leer datos de otros usuarios. GDPR/privacy violation. |
| 3 | **Error messages internos expuestos al cliente** | 🟠 Information disclosure en Cloud Functions que facilita ataques. Fix trivial. |
| 4 | **Bug: SoH auto-training nunca se ejecuta** | 🟠 Feature rota: el modelo de SoH no se actualiza automáticamente, degradando la UX. |
| 5 | **bydFunctions.ts monolítico (3042 líneas)** | 🟠 Deuda técnica severa que dificulta testeo, mantenimiento y aumenta cold starts. |

### 🏥 Estado de Salud del Repositorio: **62/100**

| Dimensión | Score | Notas |
|-----------|:-----:|-------|
| Seguridad | 45/100 | Keys en Git es crítico. Rules legacy sin ownership. |
| Calidad de Código | 60/100 | Monolito backend, `any` types, duplicación. Logger centralizado es positivo. |
| Estabilidad | 70/100 | Bug en SoH training, pero error handling generalmente correcto. |
| Rendimiento | 70/100 | Web Workers para ML es excelente. Firestore `get()` en rules es costoso. |
| Arquitectura | 55/100 | Frontend bien organizado (core/hooks/services). Backend monolítico. |
| Dependencias | 75/100 | CVE overrides presentes. TensorFlow.js pesado pero justificado. |
| Documentación | 65/100 | README y JSDoc existen. Falta documentación de arquitectura backend. |

> **Nota:** La puntuación refleja el estado actual sin considerar los audits previos que ya se aplicaron. El proyecto tiene buenas prácticas en muchas áreas (logger centralizado, Zod validation en Functions, encryption AES-256-GCM, rate limiting, Web Workers para ML), pero los hallazgos de seguridad y la deuda técnica del backend bajan la puntuación significativamente.
