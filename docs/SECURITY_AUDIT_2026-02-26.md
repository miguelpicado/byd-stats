# 🔍 Auditoría Completa — Rama `PremiumAPK`

**Repositorio:** `BYD-Stats-Premium/byd-stats-premium`  
**Rama:** `PremiumAPK`  
**Fecha:** 2026-02-26  
**Scope:** Todos los archivos del repositorio en la rama actual

---

## Scope Confirmado

| Área | Archivos clave |
|------|----------------|
| Frontend (React+Vite) | `src/` — 189 archivos (components, hooks, features, services, providers, core) |
| Firebase Functions | `functions/src/bydFunctions.ts` (2698 líneas, 114KB) + `index.ts` |
| Android (Capacitor) | `android/app/src/main/AndroidManifest.xml`, `capacitor.config.json` |
| MQTT Listener | `mqtt-listener/src/` (Raspberry Pi service) |
| Config | `.env`, `.gitignore`, `firestore.rules`, `firebase.json`, `package.json` |

---

## 1. 🔐 Seguridad y Vulnerabilidades

---

**[SEGURIDAD]** | **🔴 Crítico**
- **Archivo:** [.env](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/.env)
- **Descripción:** El archivo `.env` con **API keys reales de Firebase, Google OAuth y Smartcar** está presente en el repositorio y ha sido committeado en **3 commits** del historial de git (`33156ad`, `d00819c`, `960d3b9`). Aunque `.gitignore` lo lista, ya fue committeado y las claves están en el historial.
- **Impacto:** Cualquiera con acceso al repo puede leer las claves de Firebase, Google OAuth y Smartcar. Si el repo es público o se filtra, las claves deben considerarse comprometidas.
- **Solución propuesta:**
  1. Eliminar `.env` del tracking: `git rm --cached .env`
  2. Limpiar el historial con `git filter-branch` o `BFG Repo-Cleaner`
  3. **Rotar todas las claves** (Firebase API Key, Google Client ID, Smartcar Client ID)
  4. Verificar que `.env` permanece en `.gitignore`
- **Esfuerzo estimado:** Medio

---

**[SEGURIDAD]** | **🔴 Crítico**
- **Archivo:** [firestore.rules](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/firestore.rules)
- **Descripción:** **TODAS** las reglas de Firestore permiten lectura y escritura sin autenticación (`allow read, write: if true`). Hay un `TODO` en línea 6 que lo reconoce pero nunca se implementó. Esto afecta colecciones críticas: `bydVehicles`, `trips`, `charges`, `chargingSessions`, `users`.
- **Impacto:** Cualquier usuario puede leer/escribir/borrar **todos los datos** de todos los vehículos, viajes y usuarios de la base de datos. Esto incluye datos privados de ubicación GPS, VINs de vehículos y sesiones de carga.
- **Solución propuesta:**
  ```javascript
  match /bydVehicles/{vehicleId} {
    allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    match /private/{doc} {
      allow read, write: if false; // Solo Cloud Functions
    }
  }
  ```
- **Esfuerzo estimado:** Medio

---

**[SEGURIDAD]** | **🔴 Crítico**
- **Archivo:** [bydFunctions.ts#L445](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/functions/src/bydFunctions.ts#L445)
- **Descripción:** El PIN de control del vehículo se logga en **texto plano** en los logs de Cloud Functions:
  ```typescript
  console.log(`[${commandName}] Using PIN: length=${controlPin.length}, isNumeric=${isNumeric}, isUpper=${isUppercase}, rawVal=${controlPin}`);
  ```
  El `rawVal` expone el PIN completo en los logs de Google Cloud.
- **Impacto:** Cualquier persona con acceso a los logs de Firebase/GCP puede ver los PINes de control de vehículos, permitiendo control remoto no autorizado (desbloqueo, arrancamiento de clima, etc.).
- **Solución propuesta:** Eliminar `rawVal=${controlPin}` del log. Mantener solo la información de debug sin exponer el valor:
  ```typescript
  console.log(`[${commandName}] Using PIN: length=${controlPin.length}, isNumeric=${isNumeric}`);
  ```
- **Esfuerzo estimado:** Bajo

---

**[SEGURIDAD]** | **🟠 Alto**
- **Archivo:** [AndroidManifest.xml#L10](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/android/app/src/main/AndroidManifest.xml#L10)
- **Descripción:** `android:usesCleartextTraffic="true"` permite comunicación HTTP sin cifrar. Aunque necesario para desarrollo local con Capacitor, debe estar desactivado en producción.
- **Impacto:** Datos sensibles (tokens OAuth, datos del vehículo) podrían ser interceptables por atacantes en redes WiFi públicas (MITM).
- **Solución propuesta:** Configurar por perfil de build:
  - Debug: `usesCleartextTraffic="true"`
  - Release: `usesCleartextTraffic="false"` + network security config
- **Esfuerzo estimado:** Bajo

---

**[SEGURIDAD]** | **🟠 Alto**
- **Archivo:** [bydFunctions.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/functions/src/bydFunctions.ts) (todas las funciones `onCall`)
- **Descripción:** Ninguna Cloud Function valida la autenticación del llamante (`request.auth`). Cualquier usuario, incluso anónimo, puede llamar a funciones críticas como `bydConnect`, `bydLock`, `bydUnlock`, `bydStartClimate` con un VIN arbitrario.
- **Impacto:** Control remoto no autorizado de vehículos. Un atacante puede bloquear/desbloquear, encender climatización, tocar claxon de cualquier vehículo conectado si conoce el VIN.
- **Solución propuesta:** Añadir validación de auth en cada función:
  ```typescript
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  // Validar que request.auth.uid == vehicleData.userId
  ```
- **Esfuerzo estimado:** Medio

---

**[SEGURIDAD]** | **🟠 Alto**
- **Archivo:** [AndroidManifest.xml#L38-41](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/android/app/src/main/AndroidManifest.xml#L38-L41)
- **Descripción:** Intent filter con `android:mimeType="*/*"` en la acción `SEND` — la app se registra como receptor de **cualquier tipo de archivo** compartido.
- **Impacto:** La app aparece como opción al compartir cualquier archivo desde cualquier app, confundiendo al usuario. También abre la posibilidad de recibir archivos maliciosos.
- **Solución propuesta:** Restringir a los tipos soportados:
  ```xml
  <data android:mimeType="application/x-sqlite3" />
  <data android:mimeType="text/csv" />
  <data android:mimeType="application/json" />
  ```
- **Esfuerzo estimado:** Bajo

---

**[SEGURIDAD]** | **🟡 Medio**
- **Archivo:** [AndroidManifest.xml#L51-61](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/android/app/src/main/AndroidManifest.xml#L51-L61)
- **Descripción:** `WearableMessageListenerService` con `android:exported="true"` sin restricción de permisos.
- **Impacto:** Otras apps podrían enviar mensajes falsos al servicio haciéndose pasar por el Wear OS companion.
- **Solución propuesta:** Añadir `android:permission="com.google.android.gms.permission.BIND_LISTENER"` o equivalente.
- **Esfuerzo estimado:** Bajo

---

**[SEGURIDAD]** | **🟡 Medio**
- **Archivo:** [mqtt-listener/.env.example#L18](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/mqtt-listener/.env.example#L18)
- **Descripción:** La URL del webhook de Firebase se expone en el `.env.example` con el project ID real: `https://europe-west1-REDACTED_FIREBASE_PROJECT_ID.cloudfunctions.net/bydMqttWebhook`.
- **Impacto:** Facilita ataques dirigidos al endpoint. Combinado con la falta de autenticación en las Cloud Functions, permite invocación directa.
- **Solución propuesta:** Usar un placeholder en el ejemplo: `FIREBASE_WEBHOOK_URL=https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/bydMqttWebhook`
- **Esfuerzo estimado:** Bajo

---

## 2. 🧹 Calidad y Limpieza de Código

---

**[CALIDAD]** | **🟠 Alto**
- **Archivo:** Múltiples archivos en `functions/` y `android/` (16 archivos `.txt`/`.log`)
- **Descripción:** Se han committeado **16 archivos de logs/debug** al repo:
  - `functions/`: `feb4_logs.txt`, `recent_logs.txt`, `recent_logs_1000.txt` (273KB), etc.
  - `android/`: `build_error_full.txt` (224KB), `build_log_antigravity.txt` (106KB), etc.
  - Root: `tmp_diff.txt`, `test_flash.ts`, `REGISTRO_CARGAS.csv`, `REGISTRO_VIAJES.csv`
- **Impacto:** Infla el tamaño del repo, los logs podrían contener datos sensibles (tokens, IPs), y generan ruido en el historial.
- **Solución propuesta:**
  1. `git rm` todos los archivos listados
  2. Añadir a `.gitignore`: `*.log`, `*_logs*.txt`, `build_*.txt`, `tmp_*.txt`
- **Esfuerzo estimado:** Bajo

---

**[CALIDAD]** | **🟠 Alto**
- **Archivo:** [bydFunctions.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/functions/src/bydFunctions.ts)
- **Descripción:** Archivo monolítico de **2698 líneas / 114KB**. Contiene toda la lógica de la API BYD, polling, trip detection, MQTT webhook, scheduling, y Google Maps integration en un solo archivo.
- **Impacto:** Extremadamente difícil de mantener, testear, y revisar. Cualquier cambio en una función arriesga romper otras.
- **Solución propuesta:** Separar en módulos:
  - `bydAuth.ts` — Connect/Disconnect
  - `bydData.ts` — Realtime/GPS/Charging
  - `bydControl.ts` — Lock/Unlock/Climate/Windows
  - `bydPolling.ts` — Trip detection, polling
  - `bydMqtt.ts` — MQTT webhook
  - `helpers.ts` — Shared utils (decryption, normalization)
- **Esfuerzo estimado:** Alto

---

**[CALIDAD]** | **🟡 Medio**
- **Archivo:** [useProcessedData.ts#L62](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/hooks/useProcessedData.ts#L62)
- **Descripción:** Destructuring vacío: `const { } = useTranslation();` — importa el hook pero no usa nada de él.
- **Impacto:** Código muerto que añade confusión y una suscripción innecesaria a cambios de idioma.
- **Solución propuesta:** Eliminar la línea por completo.
- **Esfuerzo estimado:** Bajo

---

**[CALIDAD]** | **🟡 Medio**
- **Archivo:** [bydFunctions.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/functions/src/bydFunctions.ts) — Líneas 553-554, 600-601, 248-249
- **Descripción:** JSDoc duplicados en varias funciones (el comentario se repite dos veces seguidas):
  ```typescript
  /** Lock vehicle */
  /** Lock vehicle */
  export const bydLockV2 = ...
  ```
- **Impacto:** Ruido, indica falta de revisión de código.
- **Solución propuesta:** Eliminar los comentarios duplicados.
- **Esfuerzo estimado:** Bajo

---

**[CALIDAD]** | **🟡 Medio**
- **Archivo:** [useAppOrchestrator.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/hooks/useAppOrchestrator.ts#L67-L73)
- **Descripción:** Se declaran 6 estados para "All Charges" (`allChargesFilterType`, `allChargesMonth`, etc.) pero **no se utilizan en `App.tsx`**, que no pasa `allChargesState` al componente `AllChargesViewLazy`.
- **Impacto:** Código muerto, estados innecesarios en memoria.
- **Solución propuesta:** Eliminar o utilizar efectivamente los estados de All Charges.
- **Esfuerzo estimado:** Bajo

---

## 3. 🐛 Bugs y Errores Potenciales

---

**[BUG]** | **🟠 Alto**
- **Archivo:** [firebase.ts#L117](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/services/firebase.ts#L117)
- **Descripción:** Expresión que puede resultar en `NaN`:
  ```typescript
  trip: data.distanceKm || (data.endOdometer - data.startOdometer) || 0,
  ```
  Si `data.endOdometer` o `data.startOdometer` son `undefined`, la resta produce `NaN`, pero `NaN || 0` sí devuelve 0. Sin embargo, si uno de los dos es `undefined` y el otro tiene valor, se obtiene `NaN` como resultado intermedio que se propaga silenciosamente.
- **Impacto:** Viajes con distancia incorrecta (NaN o 0) cuando los campos del documento no existen.
- **Solución propuesta:**
  ```typescript
  trip: data.distanceKm || ((data.endOdometer && data.startOdometer) ? (data.endOdometer - data.startOdometer) : 0),
  ```
- **Esfuerzo estimado:** Bajo

---

**[BUG]** | **🟡 Medio**
- **Archivo:** [useGoogleAuth.ts#L141](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/hooks/sync/useGoogleAuth.ts#L141)
- **Descripción:** Excepción silenciada en logout:
  ```typescript
  try { await SocialLogin.logout({ provider: 'google' }); } catch (ignored) { }
  ```
- **Impacto:** Si el logout falla, no hay feedback ni logging, puede dejar al usuario en un estado inconsistente.
- **Solución propuesta:** Al menos loggar el error con `logger.warn`.
- **Esfuerzo estimado:** Bajo

---

**[BUG]** | **🟡 Medio**
- **Archivo:** [useProcessedData.ts#L329](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/hooks/useProcessedData.ts#L329)
- **Descripción:** La condición `!isAiTraining` lee estado stale dentro de un `useEffect` (closure stale). React state dentro de closures de effect no refleja el valor actual.
- **Impacto:** Posible doble entrenamiento del modelo de IA si el effect se re-ejecuta rápidamente, consumiendo CPU y memoria.
- **Solución propuesta:** Usar un `useRef` para trackear el estado de training en curso:
  ```typescript
  const isTrainingRef = useRef(false);
  ```
- **Esfuerzo estimado:** Medio

---

**[BUG]** | **🟢 Bajo**
- **Archivo:** [bydFunctions.ts#L15-19](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/functions/src/bydFunctions.ts#L15-L19)
- **Descripción:** `admin.initializeApp()` está wrapeado en try/catch para ignorar "already initialized" — patrón frágil.
- **Impacto:** Oculta cualquier otro error de inicialización que no sea el de duplicación.
- **Solución propuesta:**
  ```typescript
  if (admin.apps.length === 0) admin.initializeApp();
  ```
- **Esfuerzo estimado:** Bajo

---

## 4. ⚡ Optimizaciones de Rendimiento

---

**[RENDIMIENTO]** | **🟡 Medio**
- **Archivo:** [App.tsx#L87-89](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/App.tsx#L87-L89)
- **Descripción:** `new URLSearchParams(window.location.search)` se ejecuta en **cada render** del componente root:
  ```typescript
  const searchParams = new URLSearchParams(window.location.search);
  const isModeApk = searchParams.get('mode') === 'apk';
  ```
- **Impacto:** Creación innecesaria de objetos en cada render. Aunque el costo individual es mínimo, se acumula ya que es el componente raíz.
- **Solución propuesta:** Memoizar con `useMemo`:
  ```typescript
  const { isModeApk, hasSkipLanding } = useMemo(() => ({
    isModeApk: new URLSearchParams(window.location.search).get('mode') === 'apk',
    hasSkipLanding: new URLSearchParams(window.location.search).has('skipLanding')
  }), []);
  ```
- **Esfuerzo estimado:** Bajo

---

**[RENDIMIENTO]** | **🟡 Medio**
- **Archivo:** [useProcessedData.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/hooks/useProcessedData.ts) — 473 líneas
- **Descripción:** El `useEffect` principal (línea 218-446) contiene **toda** la lógica de procesamiento + training de 3 modelos AI en un solo efecto con 7 dependencias (`filteredTrips, allTrips, language, settings, charges, recalcTrigger`). Cualquier cambio en cualquiera de estas dependencias re-ejecuta todo el flujo.
- **Impacto:** Re-entrenamientos innecesarios de modelos TensorFlow.js cuando solo cambia el idioma o un setting no relacionado.
- **Solución propuesta:** Separar en effects independientes: uno para procesamiento de datos, otro para entrenamiento AI, otro para SoH.
- **Esfuerzo estimado:** Medio

---

## 5. 🏗️ Arquitectura y Estructura

---

**[ARQUITECTURA]** | **🟡 Medio**
- **Archivo:** Estructura general de `src/`
- **Descripción:** Le estructura tiene buena separación en capas (`components/`, `hooks/`, `services/`, `providers/`, `core/`), pero hay solapamiento:
  - `providers/` y `context/` coexisten con funciones similares
  - `hooks/sync/` contiene lógica que podría estar en `services/`
  - `features/` contiene principalmente componentes UI, no features completas
- **Impacto:** Dificultad de onboarding, incertidumbre sobre dónde colocar lógica nueva.
- **Solución propuesta:** Considerar unificar `providers/` y `context/` en una sola carpeta `context/`, y mover la lógica de negocio de `hooks/sync/` a `services/`.
- **Esfuerzo estimado:** Medio

---

**[ARQUITECTURA]** | **🟡 Medio**
- **Archivo:** [.gitignore](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/.gitignore)
- **Descripción:** El `.gitignore` tiene buenas reglas pero faltan patrones para los archivos ya committeados:
  - No cubre `*.txt` genéricos en `functions/` y `android/`
  - No cubre `REGISTRO_*.csv` (datos de prueba personales)
  - No cubre `test_*.ts` en raíz (scripts de prueba adhoc)
  - `EC_database_Hybrid.db` está listado pero hay riesgo de otros `.db` en raíz
- **Impacto:** Archivos de debug/test/datos personales se commitan accidentalmente.
- **Solución propuesta:** Añadir al `.gitignore`:
  ```gitignore
  functions/*.txt
  android/*.txt
  REGISTRO_*.csv
  test_*.ts
  tmp_*.txt
  ```
- **Esfuerzo estimado:** Bajo

---

## 6. 📦 Dependencias y Build

---

**[DEPENDENCIAS]** | **🟡 Medio**
- **Archivo:** [package.json](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/package.json)
- **Descripción:** Revisión de dependencias:
  - `@tensorflow/tfjs: ^4.22.0` — **Paquete muy pesado** (~4MB minificado). Se usa solo para 3 modelos simples (eficiencia, SoH, parking) que podrían implementarse con regresión lineal sin TensorFlow.
  - `prop-types: ^15.8.1` — **Obsoleto** en proyectos TypeScript. PropTypes es innecesario cuando se usa TS para tipado estático.
  - `@capacitor/cli: ^8.0.0` — Está en `dependencies` en vez de `devDependencies`.
  - `vite-plugin-pwa: ^1.2.0` — PWA plugin incluido en una app que es primariamente APK nativa.
- **Impacto:** Bundle size innecesariamente grande, dependencias que no aportan valor.
- **Solución propuesta:**
  1. Evaluar reemplazar TensorFlow.js por implementaciones nativas más ligeras
  2. Eliminar `prop-types`
  3. Mover `@capacitor/cli` a `devDependencies`
  4. Evaluar si `vite-plugin-pwa` es necesario en la variante Premium APK
- **Esfuerzo estimado:** Medio

---

**[DEPENDENCIAS]** | **🟢 Bajo**
- **Archivo:** [mqtt-listener/package.json](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/mqtt-listener/package.json)
- **Descripción:** `firebase-admin: ^11.11.0` — La versión actual es v12+. La v11 todavía recibe updates de seguridad pero está una major detrás.
- **Impacto:** Posible pérdida de fixes de seguridad y nuevas funcionalidades.
- **Solución propuesta:** Actualizar a `firebase-admin: ^12.x`.
- **Esfuerzo estimado:** Bajo

---

## 7. 📋 Documentación y Mantenibilidad

---

**[DOCUMENTACIÓN]** | **🟡 Medio**
- **Archivo:** Varios componentes y hooks complejos
- **Descripción:**
  - `useProcessedData.ts` (473 líneas) — Hook complejo con lógica de cache, 3 modelos AI, y Web Worker pero **sin documentación de alto nivel**
  - `useAppOrchestrator.ts` (222 líneas) — Orquestador central sin documentación de flujo
  - `googleDrive.ts` (517 líneas) — Servicio completo de Google Drive sin JSDoc en funciones públicas
- **Impacto:** Dificultad extrema de onboarding para nuevos colaboradores. La lógica de AI caching es particularmente opaca.
- **Solución propuesta:** Añadir JSDoc y comentarios de arquitectura en los hooks y servicios principales. Al mínimo, un bloque de comentario al inicio de cada archivo explicando su responsabilidad.
- **Esfuerzo estimado:** Medio

---

**[DOCUMENTACIÓN]** | **🟢 Bajo**
- **Archivo:** [useDatabase.ts](file:///c:/Users/migue/Github/BYD-Stats/BYD-Stats-Premium/byd-stats-premium/src/hooks/useDatabase.ts)
- **Descripción:** Strings hardcodeados en español en errores de UI: `'Error cargando SQL.js'`, `'SQL no está listo'`, `'CSV vacío o formato incorrecto'`. La app tiene sistema i18n configurado (`i18next`) pero estos mensajes no lo usan.
- **Impacto:** Mensajes de error solo visibles en español, inconsistencia con el resto de la UI internacionalizada.
- **Solución propuesta:** Reemplazar por claves i18n: `t('errors.sqlLoadFailed')`, etc.
- **Esfuerzo estimado:** Bajo

---

## 📊 Resumen Ejecutivo

### Hallazgos por Área y Severidad

| Área | 🔴 Crítico | 🟠 Alto | 🟡 Medio | 🟢 Bajo | Total |
|------|:----------:|:-------:|:--------:|:-------:|:-----:|
| 🔐 Seguridad | 3 | 3 | 2 | 0 | **8** |
| 🧹 Calidad | 0 | 2 | 3 | 0 | **5** |
| 🐛 Bugs | 0 | 1 | 2 | 1 | **4** |
| ⚡ Rendimiento | 0 | 0 | 2 | 0 | **2** |
| 🏗️ Arquitectura | 0 | 0 | 2 | 0 | **2** |
| 📦 Dependencias | 0 | 0 | 1 | 1 | **2** |
| 📋 Documentación | 0 | 0 | 1 | 1 | **2** |
| **Total** | **3** | **6** | **13** | **3** | **25** |

### 🏆 Top 5 Prioridades

| # | Hallazgo | Severidad | Justificación |
|---|----------|-----------|---------------|
| 1 | **Firestore rules `if true`** | 🔴 Crítico | Base de datos completamente abierta. **Riesgo inmediato** de pérdida/manipulación de datos de todos los usuarios. |
| 2 | **Cloud Functions sin auth** | 🟠 Alto | Combinado con Firestore open, permite **control remoto no autorizado** de vehículos (lock/unlock/climate). |
| 3 | **PIN de control expuesto en logs** | 🔴 Crítico | El PIN se logga en texto plano en GCP. Fácil de arreglar, impacto de seguridad inmediato. |
| 4 | **`.env` con claves reales en git history** | 🔴 Crítico | Las claves están expuestas en el historial. Requiere limpieza de historial + rotación de claves. |
| 5 | **`usesCleartextTraffic=true`** en producción | 🟠 Alto | Permite intercepción de tráfico HTTP en redes públicas. Fix simple por config de build. |

### 🏥 Estado de Salud del Repositorio

## **42 / 100**

> [!CAUTION]
> El proyecto tiene una **base funcional sólida** con buena separación de capas, uso de Web Workers para AI, lazy loading, y un sistema de cache bien pensado. Sin embargo, las **vulnerabilidades de seguridad son críticas** — la combinación de Firestore completamente abierta + Cloud Functions sin autenticación + PIN expuesto en logs representa un riesgo real e inmediato para los usuarios del sistema. Se recomienda **abordar las 5 prioridades antes de cualquier release** o despliegue.
