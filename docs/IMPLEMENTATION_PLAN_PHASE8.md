# PLAN DE IMPLEMENTACION FASE 8 — Refinamiento Final para Produccion

## Objetivo: Llevar todas las dimensiones al 95/100

**Proyecto:** BYD Stats Premium v2.1.0
**Root:** `byd-stats-premium/` (dentro del monorepo)
**Stack:** React 19 + TypeScript + Vite + Firebase + Capacitor + TailwindCSS
**Tests:** Vitest (`npx vitest run` desde `byd-stats-premium/`)
**Lint:** `npx eslint src --max-warnings=999`
**Build:** `npm run build`

---

## CONTEXTO DEL PROYECTO

### Estructura de Carpetas
```
byd-stats-premium/
  src/
    components/       # UI components
      cards/          # TripCard, ChargeCard, etc.
      common/         # ErrorBoundary, ModalHeader, FloatingActionButton
      layout/         # BottomNavigation, DesktopSidebar, BaseLayout
      lists/          # VirtualizedTripList, VirtualizedChargeList
      maps/           # MapView
      modals/         # 26 modal components (AddChargeModal, SettingsModal, etc.)
      settings/       # BydSettings, GoogleSyncSettings, VehicleSettings
      ui/             # Skeleton, Toggle, etc.
    context/          # AppContext, CarContext, LayoutContext
    core/             # Pure business logic (NO React)
      batteryCalculations.ts, chargingLogic.ts, dataProcessing.ts,
      dateUtils.ts, formatters.ts, constants.ts, logger.ts
    features/         # Feature modules
      dashboard/      # DashboardLayout, tabs (DashboardTab, HistoryTab, etc.)
      navigation/     # Header.tsx
    hooks/            # 40+ custom hooks
      sync/           # useGoogleAuth, useDriveSync, etc.
    i18n/             # i18next config
    pages/            # LandingPage, AllTripsView, AllChargesView
    providers/        # ChargesProvider, TripsProvider, FilterProvider, ModalProvider
    services/         # firebase.ts, googleDrive.ts, AnomalyService.ts
      ai/             # EfficiencyModel, ParkingModel, SoHModel
    types/            # index.ts (Trip, Charge, Car, Settings, etc.)
    utils/            # secureStorage.ts, parseChargeRegistry.ts, typeGuards.ts
    workers/          # dataWorker.ts, tensorflowWorker.ts
  functions/src/      # Firebase Cloud Functions
    bydFunctions.ts   # BYD API integration
  public/             # Static assets
  firebase.json       # Firebase config
  firestore.rules     # Security rules
  vitest.config.ts    # Test config
  tsconfig.json       # TypeScript config (strict: true)
  tailwind.config.js  # Tailwind config
```

### Path Aliases (tsconfig.json + vite.config.ts)
```
@         -> src/
@components -> src/components/
@hooks    -> src/hooks/
@core     -> src/core/
@features -> src/features/
@tabs     -> src/features/dashboard/tabs/
@services -> src/services/
```

### Estado Actual de Tests
- 354 tests pasando, 28 archivos de test
- Coverage global: 33.25% (statements)
- Setup file: `src/setupTests.ts` (mocks Worker, matchMedia, ResizeObserver, crypto.randomUUID)
- Vitest config: `vitest.config.ts` — IMPORTANTE: custom `exclude` reemplaza defaults, siempre incluir `**/node_modules/**`

### Estado Actual ESLint
- 187 warnings, 0 errors
- 104 `no-explicit-any`, 23 `exhaustive-deps`, 16 `setState-in-effect`, 8 `rules-of-hooks`

### Patrones de Test Establecidos
```typescript
// Factory functions para datos de test
const makeTrip = (overrides?: Partial<Trip>): Trip => ({
  id: 'trip-1', start_timestamp: 1700000000000, end_timestamp: 1700003600000,
  start_soc: 80, end_soc: 70, distance: 25, ...overrides
});
const makeCharge = (overrides?: Partial<Charge>): Charge => ({
  id: 'charge-1', date: '2024-01-15', kwhCharged: 20, soc_start: 30, soc_end: 80, ...overrides
});

// Provider wrapper pattern
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SomeProvider>{children}</SomeProvider>
);
const { result } = renderHook(() => useSomeContext(), { wrapper });

// Comlink worker mock pattern
const state = vi.hoisted(() => ({
  capturedApi: null as any,
  mockTfWorker: { trainEfficiency: vi.fn().mockResolvedValue(null) }
}));
vi.mock('comlink', () => ({
  expose: (api: unknown) => { state.capturedApi = api; },
  wrap: () => state.mockTfWorker,
}));
```

---

## FASE 8.1: SEGURIDAD CRITICA (Objetivo: 72 -> 95)

### 8.1.1 Limpiar API keys del historial git

**Contexto:** El archivo `.env` contiene keys reales de Firebase y Google Maps que pueden estar en el historial git.

**Accion:**
1. Crear `.env.example` con placeholders:
```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GOOGLE_WEB_CLIENT_ID=your_google_client_id
GOOGLE_MAPS_API_KEY=your_maps_api_key
```
2. Verificar que `.env` esta en `.gitignore` (lineas 61-70 del .gitignore actual)
3. NO ejecutar BFG automaticamente — anotar como tarea manual para el usuario

### 8.1.2 Security Headers en Firebase Hosting

**Archivo:** `firebase.json`
**Estructura actual (lineas 7-18):**
```json
"hosting": {
  "public": "dist",
  "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
  "rewrites": [{ "source": "**", "destination": "/index.html" }]
}
```

**Accion:** Anadir bloque `headers` DENTRO de `hosting`, ANTES de `rewrites`:
```json
"headers": [
  {
    "source": "**",
    "headers": [
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
      { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
      {
        "key": "Content-Security-Policy",
        "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.googleapis.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net wss://*.firebaseio.com https://identitytoolkit.googleapis.com; frame-src https://accounts.google.com"
      }
    ]
  }
]
```

### 8.1.3 Mejorar secureStorage con salt por dispositivo

**Archivo:** `src/utils/secureStorage.ts`
**Problema actual (linea 10):** `KEY_MATERIAL = 'byd-stats-storage-key'` — key deterministica e igual para todos los usuarios

**Accion:** Reemplazar la derivacion de clave para usar un salt unico por dispositivo:
```typescript
const STORAGE_PREFIX = 'sec_';
const DEVICE_SALT_KEY = 'byd_device_salt';

function getOrCreateDeviceSalt(): string {
  let salt = localStorage.getItem(DEVICE_SALT_KEY);
  if (!salt) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    salt = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(DEVICE_SALT_KEY, salt);
  }
  return salt;
}

async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const deviceSalt = getOrCreateDeviceSalt();
  const keyMaterial = encoder.encode('byd-stats-v2-' + deviceSalt);
  const salt = encoder.encode('byd-stats-salt-' + deviceSalt);
  const baseKey = await crypto.subtle.importKey('raw', keyMaterial, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
```
Mantener la retrocompatibilidad: `secureGet` ya intenta leer la key antigua como fallback (linea 63).

### 8.1.4 Validacion de inputs con Zod en Cloud Functions

**Archivo:** `functions/src/bydFunctions.ts`
**Problema actual (lineas 107-117):** Solo valida presencia, no formato/longitud

**Accion:** Instalar zod en functions (`cd functions && npm install zod`) y crear schemas:
```typescript
import { z } from 'zod';

const BydConnectSchema = z.object({
  username: z.string().min(3).max(100).trim(),
  password: z.string().min(1).max(200),
  countryCode: z.string().min(2).max(5).regex(/^[A-Z]{2,3}$/),
  controlPin: z.string().max(10).optional(),
  userId: z.string().min(1).max(128),
});

// Usar en bydConnectV2 (linea 113):
const parsed = BydConnectSchema.safeParse(request.data);
if (!parsed.success) {
  throw new HttpsError('invalid-argument', 'Invalid input: ' + parsed.error.issues.map(i => i.path.join('.')).join(', '));
}
const { username, password, countryCode, controlPin, userId } = parsed.data;
```

Crear schemas similares para: `bydRefreshStatus`, `bydClimateCommand`, `bydLockCommand`, `bydFindVehicle`.

### 8.1.5 Reducir logging sensible en Cloud Functions

**Archivo:** `functions/src/bydFunctions.ts`
**Problema:** 142 console statements con VINs, user IDs

**Accion:** Crear helper de logging sanitizado:
```typescript
const sanitize = (text: string) =>
  text.replace(/[A-HJ-NPR-Z0-9]{17}/gi, 'VIN:***')  // VINs
      .replace(/[a-zA-Z0-9]{28}/g, 'UID:***');         // Firebase UIDs

const safeLog = (tag: string, ...args: unknown[]) => {
  const sanitized = args.map(a => typeof a === 'string' ? sanitize(a) : a);
  console.log(`[${tag}]`, ...sanitized);
};
```
Reemplazar `console.log` por `safeLog` en todas las funciones. Eliminar logs que impriman datos completos de vehiculos.

### 8.1.6 Rate limiting atomico con Firestore transactions

**Archivo:** `functions/src/bydFunctions.ts` — funcion `checkRateLimit` (lineas 80-97)
**Problema:** TOCTOU race condition — read y write no son atomicos

**Accion:** Reemplazar con transaccion:
```typescript
async function checkRateLimit(uid: string, action: string, maxPerMinute: number = 10): Promise<void> {
  const ref = db.collection('rateLimits').doc(`${uid}_${action}`);
  const now = Date.now();
  const windowMs = 60_000;

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    const data = doc.data();

    if (data && data.count >= maxPerMinute && (now - data.windowStart) < windowMs) {
      throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
    }

    if (!data || (now - data.windowStart) >= windowMs) {
      transaction.set(ref, { count: 1, windowStart: now });
    } else {
      transaction.update(ref, { count: data.count + 1 });
    }
  });
}
```

### 8.1.7 Encriptar token ABRP antes de guardar

**Archivo:** `src/components/settings/BydSettings.tsx` (linea 119)
**Problema:** `abrpUserToken: abrpToken.trim()` — texto plano en Firestore

**Accion:** Crear Cloud Function para encriptar el token server-side:
```typescript
// En functions/src/bydFunctions.ts — nueva funcion
export const saveAbrpToken = onCall({ region: REGION }, async (request: CallableRequest) => {
  const uid = requireAuth(request);
  const { vin, token } = request.data;
  if (!vin || !token) throw new HttpsError('invalid-argument', 'Missing vin or token');

  const encrypted = encrypt(token);
  await db.collection('bydVehicles').doc(vin).collection('private').doc('abrp').set({
    encryptedToken: encrypted, updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { success: true };
});
```
En el frontend, llamar a esta funcion en lugar de guardar directamente.

### 8.1.8 Mejorar validacion de file upload

**Archivo:** `src/components/modals/DatabaseUploadModal.tsx` (linea 95)
**Problema:** `accept="*/*,image/*,.db,.jpg,.jpeg,.csv,.json"` — demasiado amplio

**Accion:**
1. Cambiar accept a: `accept=".db,.sqlite,.sqlite3,.csv,.json,.jpg,.jpeg"`
2. Anadir validacion de tamano maximo (100MB):
```typescript
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > MAX_FILE_SIZE) {
    toast.error(t('errors.fileTooLarge', 'File exceeds 100MB limit'));
    return;
  }
  // ... existing logic
};
```

### 8.1.9 Limpiar datos sensibles en logout

**Accion:** En el flujo de logout/desconexion, limpiar datos sensibles de localStorage:
```typescript
// En el handler de logout existente, anadir:
const sensitiveKeys = ['google_access_token', 'google_token_expiry', 'sec_google_access_token'];
sensitiveKeys.forEach(key => localStorage.removeItem(key));
```

---

## FASE 8.2: RESILIENCIA DE RED (Objetivo: 72 -> 95)

### 8.2.1 Crear utility de fetch con timeout y retry

**Archivo nuevo:** `src/utils/resilientFetch.ts`
```typescript
interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  retryOn?: (response: Response) => boolean;
}

const DEFAULT_TIMEOUT = 30_000;  // 30s
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1_000; // 1s base (exponential)

export async function resilientFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY,
    retryOn = (r) => r.status >= 500 || r.status === 429,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      clearTimeout(timeoutId);

      if (retryOn(response) && attempt < maxRetries) {
        const delay = retryDelayMs * Math.pow(2, attempt); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error as Error;

      if (error instanceof DOMException && error.name === 'AbortError') {
        lastError = new Error(`Request timeout after ${timeoutMs}ms`);
      }

      if (attempt < maxRetries) {
        const delay = retryDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}
```

### 8.2.2 Aplicar resilientFetch en googleDrive.ts

**Archivo:** `src/services/googleDrive.ts`
**Reemplazar** todas las llamadas `fetch(url, { headers })` por `resilientFetch(url, { headers, timeoutMs: 30_000, maxRetries: 2 })`.

Hay 5 puntos de llamada:
1. Linea ~190: `listFiles` — busqueda de archivos
2. Linea ~227: `listAllDatabaseFiles` — lista completa
3. Linea ~249: `downloadFile` — descarga (timeout mas largo: 60s)
4. Linea ~308: `uploadFile` — subida (timeout mas largo: 120s, maxRetries: 1)
5. Linea ~333: `deleteFile` — borrado

Importar al inicio: `import { resilientFetch } from '@/utils/resilientFetch';`

### 8.2.3 Deteccion de estado de red (online/offline)

**Archivo nuevo:** `src/hooks/useNetworkStatus.ts`
```typescript
import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

**Integracion:** Usar en `MainLayout.tsx` para mostrar un banner sutil:
```tsx
const isOnline = useNetworkStatus();
// En el JSX, justo despues de <Header />:
{!isOnline && (
  <div className="bg-amber-500 text-white text-center text-xs py-1 font-medium" role="alert">
    {t('common.offline', 'Sin conexion — Los cambios se sincronizaran al reconectar')}
  </div>
)}
```
Anadir la key `common.offline` a todos los archivos de traduccion en `public/locales/`.

### 8.2.4 Propagar errores del Worker al main thread

**Archivo:** `src/workers/tensorflowWorker.ts`

En la funcion `loadModelFromIDB` (alrededor de linea 75), en vez de retornar null silenciosamente:
```typescript
async function loadModelFromIDB(key: string): Promise<Sequential | null> {
  try {
    const model = await tf.loadLayersModel(`indexeddb://${key}`);
    return model as Sequential;
  } catch (error) {
    console.warn(`[TF Worker] Could not load model "${key}" from IndexedDB:`, (error as Error).message);
    return null; // Mantener null pero ahora con log visible
  }
}
```

En las funciones expuestas via Comlink (`trainEfficiency`, `trainParking`, `trainSoH`), envolver en try-catch que lance errores significativos:
```typescript
trainEfficiency: async (data: TrainData[]): Promise<TrainResult> => {
  try {
    // ... existing training logic
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown training error';
    throw new Error(`[AI] Efficiency training failed: ${msg}`);
  }
}
```

### 8.2.5 Error wrapper para operaciones async en hooks

**Archivo nuevo:** `src/utils/asyncErrorHandler.ts`
```typescript
import toast from 'react-hot-toast';
import { TFunction } from 'i18next';

export function createAsyncHandler(t: TFunction) {
  return async function handleAsync<T>(
    operation: () => Promise<T>,
    options?: {
      errorKey?: string;
      fallbackMessage?: string;
      silent?: boolean;
      onError?: (error: Error) => void;
    }
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (!options?.silent) {
        toast.error(
          options?.errorKey
            ? t(options.errorKey, options.fallbackMessage || message)
            : message
        );
      }
      options?.onError?.(error instanceof Error ? error : new Error(message));
      return null;
    }
  };
}
```

Usar este wrapper en hooks con operaciones async que actualmente no manejan errores consistentemente.

### 8.2.6 Timeout en waitForAuth de Firebase

**Archivo:** `src/services/firebase.ts` (linea 69)
**Estado actual:** Ya tiene timeout de 5s — OK. Pero agregar logging:
```typescript
setTimeout(() => {
  unsubscribe();
  if (!currentUser?.uid) {
    console.warn('[Firebase] Auth timeout after', timeoutMs, 'ms — continuing without auth');
  }
  resolve(currentUser?.uid || null);
}, timeoutMs);
```

---

## FASE 8.3: CALIDAD DE CODIGO REACT (Objetivo: 74 -> 95)

### 8.3.1 Corregir hooks condicionales en HealthReportModal

**Archivo:** `src/components/modals/HealthReportModal.tsx`

**Accion principal:** La investigacion detallada muestra que los hooks NO son condicionales en este archivo — los useEffect estan correctamente en el nivel superior. Los 8 warnings de `rules-of-hooks` en ESLint son probablemente del React Compiler plugin, no de hooks condicionales reales.

Verificar ejecutando: `npx eslint src/components/modals/HealthReportModal.tsx --max-warnings=999 2>&1`

Si los warnings son del React Compiler (`react-compiler/react-compiler`), no de `react-hooks/rules-of-hooks`, entonces:
- Son warnings informativos del compilador
- No requieren cambio si los hooks estan correctamente ordenados

### 8.3.2 Extraer StatusRow fuera del componente

**Archivo:** `src/components/modals/HealthReportModal.tsx` (alrededor de linea 120)
**Problema:** `StatusRow` se define DENTRO del componente, recreandose cada render.

**Accion:** Mover fuera y tipar como componente separado:
```typescript
// ANTES de HealthReportModal:
interface StatusRowProps {
  title: string;
  items: Anomaly[];
  icon: React.ReactNode;
  emptyText: string;
  onAcknowledge?: (id: string) => void;
}

const StatusRow: React.FC<StatusRowProps> = ({ title, items, icon, emptyText, onAcknowledge }) => (
  // ... existing JSX, pero ahora recibe onAcknowledge como prop
);
```
Pasar `onAcknowledge` como prop en vez de capturarlo del closure.

### 8.3.3 Corregir exhaustive-deps (23 instancias)

Ejecutar `npx eslint src --rule '{"react-hooks/exhaustive-deps": "warn"}' --max-warnings=999 2>&1 | grep exhaustive` para obtener la lista exacta.

**Estrategia general para cada caso:**
1. Si la dependencia faltante es una funcion: envolverla en `useCallback`
2. Si la dependencia faltante es un objeto/array: envolverla en `useMemo`
3. Si el effect no debe re-ejecutarse con la dependencia: usar `useRef` para la dependencia
4. Si el efecto usa `setState` del mismo state: usar la forma funcional `setState(prev => ...)`

**Archivos principales a corregir:**
- `src/components/PWAManager.tsx:145` — `updateServiceWorker` no en deps
- `src/components/cards/EstimatedChargeCard.tsx:69` — faltan `settings`, `trips`
- `src/components/cards/LiveVehicleStatus.tsx:58` — falta `handleStopCharge`
- `src/components/modals/AddChargeModal.tsx:137, 194, 227` — multiples deps
- `src/components/modals/ChargingInsightsModal.tsx:62`
- `src/components/modals/OdometerAdjustmentModal.tsx:20`

### 8.3.4 Eliminar setState-in-useEffect antipattern (16 instancias)

**Patron actual problematico:**
```typescript
useEffect(() => {
  setSomeState(computedValue); // Causa render extra
}, [dependency]);
```

**Solucion preferida:** Usar `useMemo` en vez de `useEffect` + `setState`:
```typescript
const someState = useMemo(() => computedValue, [dependency]);
```

**Archivos a corregir:**
- `src/components/PWAManager.tsx:120` — `setDeferredPrompt(window.deferredPrompt)` -> mover a event handler
- `src/components/cards/EstimatedChargeCard.tsx:60` — `setIsCalculating(true)` -> integrar en la logica de calculo
- `src/components/modals/AddChargeModal.tsx:85, 220`
- `src/components/modals/ChargingInsightsModal.tsx:62`
- `src/components/modals/LegalModal.tsx:22`
- `src/components/modals/OdometerAdjustmentModal.tsx:20`
- `src/context/AppContext.tsx:101`

En cada caso, evaluar si el estado derivado puede ser un `useMemo` en vez de `useState` + `useEffect`.

### 8.3.5 Mover SVG components fuera de PWAManager

**Archivo:** `src/components/PWAManager.tsx` (lineas 25-39)
**Problema:** `LogOut` y `RefreshCw` se definen inline, recreandose cada render.

**Accion:** Mover a `src/components/Icons.tsx` (o al archivo de iconos existente que ya exporta X, Activity, Battery, etc.)

Buscar el archivo de iconos: probablemente `src/components/Icons.tsx` o `src/components/Icons.jsx`. Anadir:
```typescript
export const LogOut = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export const RefreshCw = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
```
Luego importar en PWAManager: `import { LogOut, RefreshCw } from './Icons';`

### 8.3.6 Eliminar funciones inline en DashboardLayout

**Archivo:** `src/features/dashboard/DashboardLayout.tsx` (linea 46)
**Problema:** `(() => { })` como fallback crea nueva funcion cada render

**Accion:** Crear constante a nivel de modulo:
```typescript
// Al inicio del archivo, fuera del componente:
const NOOP = () => {};

// En el componente:
return <DesktopDashboardView
  {...props}
  fadingTab={props.fadingTab || ''}
  backgroundLoad={props.backgroundLoad || false}
  onTripSelect={props.onTripSelect || NOOP}
  onChargeSelect={props.onChargeSelect || NOOP}
/>;
```

### 8.3.7 Memoizar context values en providers

**Archivos:** Todos los providers en `src/providers/`

**Patron a aplicar en cada provider:**
```typescript
// En ChargesProvider, TripsProvider, FilterProvider, ModalProvider:
const contextValue = useMemo(() => ({
  // ... all context values
}), [/* dependencies */]);

return <SomeContext.Provider value={contextValue}>{children}</SomeContext.Provider>;
```

**IMPORTANTE:** Esto evita que TODOS los consumers se re-rendericen cuando el provider parent re-renderiza sin cambio de estado real.

Verificar que cada provider ya no lo haga, y anadir `useMemo` donde falte.

### 8.3.8 Reducir ESLint warnings de 187 a <30

Despues de aplicar las correcciones anteriores (8.3.1-8.3.7), los warnings deberian reducirse significativamente:
- `-16` por eliminar setState-in-effect
- `-23` por corregir exhaustive-deps
- `-8` por rules-of-hooks (si son del React Compiler, se mantienen como info)
- Total estimado: ~140 warnings restantes (mayoria `no-explicit-any` justificados)

Para los `no-explicit-any` justificados en `bydApi.ts` (Firebase httpsCallable), anadir `// eslint-disable-next-line @typescript-eslint/no-explicit-any` con comentario explicativo en cada caso, o crear un tipo generico:
```typescript
// En bydApi.ts, reemplazar:
const callable = httpsCallable<any, SomeReturnType>(functions, 'functionName');
// Por:
const callable = httpsCallable<Record<string, unknown>, SomeReturnType>(functions, 'functionName');
```

---

## FASE 8.4: TESTS CRITICOS (Objetivo: 72 -> 95)

### IMPORTANTE — Convencion de tests

- Ubicacion: `src/<module>/__tests__/<fileName>.test.ts(x)`
- Nombrado: describe blocks descriptivos, test names que expliquen el comportamiento
- Pattern: Given-When-Then implicito
- Mocks: Minimos necesarios, preferir test doubles realistas
- Assertions: Behavior-focused, no implementation-focused
- Cada test debe ser independiente (no compartir estado mutable)

### 8.4.1 Tests para chargingLogic.ts (~40 tests)

**Archivo nuevo:** `src/core/__tests__/chargingLogic.test.ts`
**Archivo bajo test:** `src/core/chargingLogic.ts`

El archivo exporta `ChargingLogic` como objeto con metodos. Testear cada metodo:

```typescript
import { ChargingLogic } from '../chargingLogic';

describe('ChargingLogic', () => {
  describe('calculateOptimalChargeDay', () => {
    it('should return the day with lowest average consumption', () => { ... });
    it('should handle empty daily stats', () => { ... });
    it('should handle all days with equal consumption', () => { ... });
    it('should respect settings if provided', () => { ... });
  });

  describe('getChargingRecommendation', () => {
    it('should recommend balanced charging for normal usage', () => { ... });
    it('should recommend slow charging when time permits', () => { ... });
    it('should recommend fast charging for urgent needs', () => { ... });
    it('should return proper translationParams', () => { ... });
  });

  describe('analyzeDayShiftPotential', () => {
    it('should identify days with shift potential', () => { ... });
    it('should handle single day data', () => { ... });
  });

  describe('calculateCostSavings', () => {
    it('should compute monthly savings potential', () => { ... });
    it('should mark infeasible when off-peak hours insufficient', () => { ... });
    it('should handle zero charges', () => { ... });
  });

  // ... mas metodos segun lo que exporte ChargingLogic
});
```

Leer el archivo completo antes de escribir tests para entender todos los metodos y sus firmas.

### 8.4.2 Tests para firebase.ts (~30 tests)

**Archivo nuevo:** `src/services/__tests__/firebase.test.ts`
**Archivo bajo test:** `src/services/firebase.ts`

Requiere mock completo de Firebase:
```typescript
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApp: vi.fn(() => ({})),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signInAnonymously: vi.fn(),
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback({ uid: 'test-uid' });
    return vi.fn(); // unsubscribe
  }),
}));
vi.mock('firebase/firestore', () => ({
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(),
  persistentMultipleTabManager: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  Timestamp: { fromDate: (d: Date) => ({ seconds: d.getTime() / 1000 }) },
}));
```

Testear: `waitForAuth`, `mapDocToTrip`, `subscribeToTrips`, `saveTrip`, `updateTrip`, `deleteTrip`, manejo de errores de auth.

### 8.4.3 Tests para googleDrive.ts (~25 tests)

**Archivo:** `src/services/__tests__/googleDrive.test.ts` (ya existe parcialmente — extender)

Testear con mock de fetch (si usamos `resilientFetch`, mockear ese):
```typescript
vi.mock('@/utils/resilientFetch', () => ({
  resilientFetch: vi.fn(),
}));
```

Tests clave:
- `listFiles`: respuesta exitosa, respuesta vacia, error 401 (limpieza de token), error 403, timeout
- `downloadFile`: descarga exitosa, archivo no encontrado
- `uploadFile`: subida exitosa, error de red, timeout largo
- `deleteFile`: borrado exitoso, error
- Cache: verificar que cache funciona con TTL correcto

### 8.4.4 Tests para modals principales (~25 tests)

**Archivos nuevos:**
- `src/components/modals/__tests__/AddChargeModal.test.tsx`
- `src/components/modals/__tests__/AddCarModal.test.tsx`
- `src/components/modals/__tests__/SettingsModal.test.tsx`

**Patron para testear modals:**
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
// Mock all context providers
vi.mock('@/context/AppContext', () => ({
  useApp: () => ({ settings: { /* mock settings */ }, updateSettings: vi.fn() }),
}));

describe('AddChargeModal', () => {
  it('should render when isOpen is true', () => { ... });
  it('should not render when isOpen is false', () => { ... });
  it('should call onClose when X button clicked', () => { ... });
  it('should validate required fields before submit', () => { ... });
  it('should call onSave with correct data on submit', () => { ... });
  it('should show error toast on save failure', () => { ... });
  it('should clear form on close', () => { ... });
});
```

### 8.4.5 Tests de integracion multi-provider (~15 tests)

**Archivo nuevo:** `src/providers/__tests__/ProviderIntegration.test.tsx`

```typescript
import { renderHook, act } from '@testing-library/react';
import { AppProviders } from '@/providers/AppProviders'; // o el archivo que anide todos

describe('Provider Integration', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppProviders>{children}</AppProviders>
  );

  it('should provide trips data through provider chain', () => { ... });
  it('should filter trips when filter changes', () => { ... });
  it('should update charges when new charge added', () => { ... });
  it('should propagate car selection to all providers', () => { ... });
  it('should handle provider chain with empty data', () => { ... });
});
```

Mockear Firebase, localStorage, y workers como en tests existentes.

### 8.4.6 Tests para AI services (~15 tests)

**Archivo nuevo:** `src/services/ai/__tests__/EfficiencyModel.test.ts`

```typescript
vi.mock('@tensorflow/tfjs', () => ({
  sequential: vi.fn(() => ({
    add: vi.fn(),
    compile: vi.fn(),
    fit: vi.fn().mockResolvedValue({ history: { loss: [0.1] } }),
    predict: vi.fn(() => ({ dataSync: () => [0.85] })),
  })),
  layers: {
    dense: vi.fn(() => ({})),
  },
  tensor2d: vi.fn((data) => ({ dispose: vi.fn() })),
}));
```

### 8.4.7 Tests para hooks de sync (~10 tests)

**Archivo nuevo:** `src/hooks/sync/__tests__/useGoogleAuth.test.ts`

Testear: login flow, token refresh, token expiry, logout cleanup.

### 8.4.8 Objetivo de coverage

Despues de estos tests el coverage deberia subir de 33% a ~55-65%. Para llegar al 70%+ (necesario para un score de 95), tambien anadir tests para:
- `src/core/dataProcessing.ts` (actualmente 17% — subir a 80%+)
- `src/hooks/useDatabase.ts` (0% — al menos las funciones criticas)
- `src/utils/typeGuards.ts` (parcialmente testeado — completar)

---

## FASE 8.5: ACCESIBILIDAD Y UX (Objetivo: 72 -> 95)

### 8.5.1 HTML semantico en MainLayout

**Archivo:** `src/features/MainLayout.tsx`

**Cambio en linea ~52:** Reemplazar el div raiz del contenido por `<main>`:
```tsx
// Cambiar:
<div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
// Por:
<main className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300" role="main">
```

**Cambio en linea ~58:** Anadir `role="region"` al area de contenido:
```tsx
<div className="flex-1 overflow-hidden" role="region" aria-label={t('common.mainContent', 'Main content')}>
```

### 8.5.2 HTML semantico en BottomNavigation

**Archivo:** `src/components/layout/BottomNavigation.tsx`

Ya tiene `role="tablist"` (bueno). Anadir `<nav>` wrapper:
```tsx
return (
  <nav aria-label={t('common.mainNavigation', 'Main navigation')}
       className="fixed bottom-0 left-0 right-0 z-50 ...">
    <div className="max-w-7xl mx-auto px-2 py-2">
      <div role="tablist" aria-label="Main navigation" className="flex justify-around items-center">
        {/* tabs */}
      </div>
    </div>
  </nav>
);
```

### 8.5.3 Skip-to-main-content link

**Archivo:** `src/App.tsx` (o `src/features/MainLayout.tsx`)

Anadir al inicio del JSX, antes de todo:
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-slate-900 focus:font-medium">
  {t('common.skipToContent', 'Skip to main content')}
</a>
```

Y anadir `id="main-content"` al contenedor principal.

### 8.5.4 Focus indicators en todos los botones interactivos

**Archivo:** `src/index.css`

Anadir regla global para focus-visible:
```css
/* Focus indicators for accessibility */
button:focus-visible,
a:focus-visible,
[role="tab"]:focus-visible,
[role="button"]:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 2px solid #EA0029;
  outline-offset: 2px;
  border-radius: 8px;
}
```

### 8.5.5 Aumentar touch targets en Header

**Archivo:** `src/features/navigation/Header.tsx` (lineas 170-210)

Reemplazar `w-10 h-10` por `w-11 h-11` (44px) en TODOS los botones del header:
```
Buscar:  w-10 h-10
Reemplazar por: w-11 h-11 min-w-[44px] min-h-[44px]
```

Esto afecta a los botones de: help, fullscreen, history, settings, filter (5 botones).

### 8.5.6 aria-live regions para contenido dinamico

**Archivo:** `src/features/MainLayout.tsx`

Anadir al Toaster config (linea ~95):
```tsx
<Toaster
  // ... existing config
  toastOptions={{
    // ... existing options
    ariaProps: { role: 'status', 'aria-live': 'polite' },
  }}
/>
```

**Archivo:** `src/App.tsx` (loading screen, linea ~78)

Anadir `role="status"` y `aria-label`:
```tsx
<div className="fixed inset-0 ..." role="status" aria-label={t('common.loading', 'Loading application')}>
```

### 8.5.7 Skeleton loaders para carga de datos

**Archivo nuevo:** `src/components/ui/SkeletonCard.tsx`
```tsx
const SkeletonCard = ({ lines = 3 }: { lines?: number }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 animate-pulse" role="status" aria-label="Loading">
    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
    {Array.from({ length: lines - 1 }).map((_, i) => (
      <div key={i} className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2" />
    ))}
    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
  </div>
);

export default SkeletonCard;
```

Usar en las listas de viajes/cargas mientras `isProcessing` es true:
```tsx
{isProcessing ? (
  <div className="space-y-3 p-4">
    <SkeletonCard /><SkeletonCard /><SkeletonCard />
  </div>
) : (
  <VirtualizedTripList ... />
)}
```

### 8.5.8 Empty states con UI contextual

**Archivo nuevo:** `src/components/common/EmptyState.tsx`
```tsx
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
  icon: React.ReactNode;
  titleKey: string;
  descriptionKey: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, titleKey, descriptionKey, actionLabel, onAction }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-slate-300 dark:text-slate-600 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">{t(titleKey)}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">{t(descriptionKey)}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="mt-4 px-4 py-2 bg-[#EA0029] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          {t(actionLabel)}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
```

Usar en listas de viajes/cargas cuando no hay datos:
```tsx
{filteredTrips.length === 0 && !isProcessing && (
  <EmptyState
    icon={<Car className="w-16 h-16" />}
    titleKey="empty.noTrips"
    descriptionKey="empty.noTripsDescription"
    actionLabel="empty.importData"
    onAction={() => openModal('database')}
  />
)}
```

Anadir las keys de traduccion correspondientes a todos los archivos de locales.

### 8.5.9 Internacionalizacion de moneda

**Archivo:** `src/core/formatters.ts`

Anadir formateador de moneda localizado:
```typescript
export const formatCurrency = (amount: number, locale = 'es-ES', currency = 'EUR'): string => {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
};
```

Reemplazar usos hardcodeados de "€" en componentes por esta funcion.

### 8.5.10 Keyboard accessibility en cards

**Archivos:** `src/components/cards/TripCard.tsx`, `src/components/cards/ChargeCard.tsx`

Si las cards son clickeables (tienen `onClick`), asegurar que son accesibles por teclado:
```tsx
// Si el div tiene onClick, anadir:
<div
  onClick={handleClick}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
  role="button"
  tabIndex={0}
  aria-label={`${t('trip.viewDetails')} - ${distance}km`}
  className="... cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
>
```

---

## FASE 8.6: RENDIMIENTO FINAL (Objetivo: 75 -> 95)

### 8.6.1 Optimizar app_icon_v2.png

**Archivo:** `public/app_icon_v2.png` (349KB)

**Accion manual:** Comprimir la imagen a WebP/PNG optimizado:
1. Usar https://squoosh.app/ o `npx sharp-cli` para reducir a <50KB
2. Si el formato original es PNG de 512x512, comprimir sin perdida visible
3. Considerar generar versiones multiples (192x192 y 512x512) como archivos separados

Actualizar `vite.config.ts` manifest si se cambian los nombres de archivo.

### 8.6.2 useCallback en event handlers de componentes frecuentes

**Archivos principales:**
- `src/features/dashboard/DashboardLayout.tsx`
- `src/components/cards/TripCard.tsx`
- `src/components/cards/ChargeCard.tsx`

**Patron:** Cualquier funcion pasada como prop a un componente hijo memo-izado debe estar envuelta en `useCallback`:
```typescript
const handleTripSelect = useCallback((trip: Trip) => {
  // ... logic
}, [/* stable dependencies */]);
```

### 8.6.3 Request deduplication para Firebase

**Archivo:** `src/services/firebase.ts`

Crear mecanismo simple de deduplication para consultas simultaneas:
```typescript
const pendingRequests = new Map<string, Promise<unknown>>();

export async function deduplicatedQuery<T>(key: string, queryFn: () => Promise<T>): Promise<T> {
  const existing = pendingRequests.get(key);
  if (existing) return existing as Promise<T>;

  const promise = queryFn().finally(() => pendingRequests.delete(key));
  pendingRequests.set(key, promise);
  return promise;
}
```

Usar en las funciones de subscripcion y consulta.

### 8.6.4 Preload de assets criticos

**Archivo:** `index.html`

Anadir preloads para fuentes y assets criticos:
```html
<link rel="preload" href="/app_icon_v2.png" as="image" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

### 8.6.5 Consolidar useEffect en useSwipeGesture

**Archivo:** `src/hooks/useSwipeGesture.ts`

Si hay multiples useEffect para actualizar refs (lineas 46-49), consolidar en uno solo:
```typescript
useEffect(() => {
  callbackRef.current = onSwipe;
  thresholdRef.current = threshold;
  velocityRef.current = velocityThreshold;
}, [onSwipe, threshold, velocityThreshold]);
```

### 8.6.6 Background Sync para PWA

**Archivo:** `vite.config.ts` — seccion workbox

Anadir runtime caching para API calls:
```typescript
workbox: {
  globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
  cleanupOutdatedCaches: true,
  navigateFallback: 'index.html',
  globIgnores: ['**/node_modules/**/*', '*.map'],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/www\.googleapis\.com\/drive\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'google-drive-api',
        expiration: { maxEntries: 50, maxAgeSeconds: 300 },
        networkTimeoutSeconds: 10,
      },
    },
    {
      urlPattern: /^https:\/\/firestore\.googleapis\.com\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'firestore-api',
        expiration: { maxEntries: 100, maxAgeSeconds: 600 },
        networkTimeoutSeconds: 10,
      },
    },
  ],
}
```

---

## FASE 8.7: ARQUITECTURA (Objetivo: 76 -> 95)

### 8.7.1 Dividir useAppOrchestrator en sub-hooks

**Archivo:** `src/hooks/useAppOrchestrator.ts` (300+ LOC)

Dividir en hooks mas pequenos y enfocados:

1. **`useAppState.ts`** — Agrega contexts y devuelve estado unificado (sin logica)
2. **`useTabOrchestration.ts`** — Logica de tabs, navegacion, swipe
3. **`useDataOrchestration.ts`** — Logica de datos, import/export, sync
4. **`useModalOrchestration.ts`** — Logica de modals, confirmaciones

`useAppOrchestrator` se convierte en un thin wrapper:
```typescript
export const useAppOrchestrator = () => {
  const appState = useAppState();
  const tabs = useTabOrchestration(appState);
  const data = useDataOrchestration(appState);
  const modals = useModalOrchestration(appState);

  return { ...appState, ...tabs, ...data, ...modals };
};
```

### 8.7.2 Refactorizar TripsProvider

**Archivo:** `src/providers/TripsProvider.tsx` (200+ LOC)

Separar la logica de AI y anomalias en hooks dedicados:

1. Extraer AI-related state a `useAiInsights.ts`:
   - `isAiTraining`, `aiScenarios`, `aiLoss`, `aiSoH`, `aiSoHStats`
   - `predictDeparture`, `findSmartChargingWindows`
   - `recalculateSoH`, `recalculateAutonomy`

2. Extraer anomaly state a `useAnomalyTracking.ts`:
   - `acknowledgedAnomalies`, `setAcknowledgedAnomalies`
   - `deletedAnomalies`, `setDeletedAnomalies`

3. TripsProvider se simplifica a ~80 LOC con datos y acciones de trips solamente.

### 8.7.3 Crear shared test utilities

**Archivo nuevo:** `src/test-utils/factories.ts`
```typescript
import { Trip, Charge, Car, Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@core/constants';

export const makeTrip = (overrides?: Partial<Trip>): Trip => ({
  id: `trip-${Math.random().toString(36).slice(2, 8)}`,
  start_timestamp: 1700000000000,
  end_timestamp: 1700003600000,
  start_soc: 80,
  end_soc: 70,
  distance: 25,
  start_latitude: 0,
  start_longitude: 0,
  end_latitude: 0,
  end_longitude: 0,
  ...overrides,
});

export const makeCharge = (overrides?: Partial<Charge>): Charge => ({
  id: `charge-${Math.random().toString(36).slice(2, 8)}`,
  date: '2024-01-15',
  kwhCharged: 20,
  soc_start: 30,
  soc_end: 80,
  ...overrides,
});

export const makeCar = (overrides?: Partial<Car>): Car => ({
  id: 'car-1',
  name: 'Test BYD',
  batterySize: 60.48,
  ...overrides,
});

export const makeSettings = (overrides?: Partial<Settings>): Settings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
});
```

**Archivo nuevo:** `src/test-utils/providers.tsx`
```typescript
import { ReactNode } from 'react';
// Import all necessary providers and mock their dependencies

export const AllProviders = ({ children }: { children: ReactNode }) => (
  // Nested providers for integration tests
  <AppProvider><CarProvider><DataProvider>{children}</DataProvider></CarProvider></AppProvider>
);

export const renderWithProviders = (ui: React.ReactElement) => {
  return render(ui, { wrapper: AllProviders });
};
```

Actualizar `vitest.config.ts` para anadir alias: `'@test-utils': path.resolve(__dirname, './src/test-utils')`

---

## CHECKLIST DE VERIFICACION FINAL

Despues de implementar todas las fases, ejecutar estos comandos para verificar:

```bash
# 1. Tests
cd byd-stats-premium && npx vitest run
# Objetivo: 450+ tests pasando, 0 failing

# 2. Coverage
npx vitest run --coverage
# Objetivo: >60% statements, >50% branches

# 3. ESLint
npx eslint src --max-warnings=999 2>&1 | tail -5
# Objetivo: <30 warnings, 0 errors

# 4. TypeScript
npx tsc --noEmit
# Objetivo: 0 errors

# 5. Build
npm run build
# Objetivo: Build exitoso sin errores, chunks <500KB

# 6. Security headers
# Deploy a Firebase hosting y verificar con:
# curl -I https://your-app.web.app | grep -E "(X-Frame|Content-Security|Strict-Transport)"
```

---

## ORDEN DE EJECUCION RECOMENDADO

1. **Fase 8.1** (Seguridad) — Hacer PRIMERO, es bloqueante para produccion
2. **Fase 8.2** (Resiliencia) — Segundo, impacto directo en UX
3. **Fase 8.3** (Calidad React) — Tercero, mejora la base para tests
4. **Fase 8.5** (Accesibilidad) — Cuarto, cambios UI independientes
5. **Fase 8.6** (Performance) — Quinto, optimizaciones finales
6. **Fase 8.7** (Arquitectura) — Sexto, refactoring mayor
7. **Fase 8.4** (Tests) — ULTIMO, testear sobre el codigo final

Cada fase es independiente y puede ejecutarse en aislamiento. Si se trabaja en paralelo, 8.1+8.2 y 8.5+8.6 son buenos pares paralelos.

---

## PROYECCION DE PUNTUACIONES POST-IMPLEMENTACION

| Dimension | Actual | Post-Fase 8 | Mejoras Clave |
|---|---|---|---|
| Seguridad | 72 | **93-96** | Headers, Zod validation, encrypted tokens, atomic rate limit, sanitized logging |
| Calidad de Codigo | 74 | **92-95** | <30 ESLint warnings, no antipatterns, proper memoization |
| Rendimiento | 75 | **91-94** | Optimized images, useCallback, request dedup, runtime caching |
| Manejo de Errores | 72 | **93-96** | Retry+timeout everywhere, offline detection, worker error propagation |
| Testing | 72 | **90-93** | 450+ tests, 60%+ coverage, integration tests, AI service tests |
| Arquitectura | 76 | **91-94** | Split orchestrator, lean providers, shared test utils |
| UI/UX & Accesibilidad | 72 | **91-94** | Semantic HTML, focus indicators, skip link, skeletons, empty states |
| **MEDIA GLOBAL** | **73.3** | **93-95** | **Listo para produccion y beta testing** |

---

*Documento generado: 2 de marzo de 2026*
*Para uso con: Claude Sonnet 4.6, Claude Opus 4.6, Gemini 3.1, o cualquier LLM de codigo*
