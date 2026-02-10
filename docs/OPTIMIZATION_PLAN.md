# BYD Stats - Plan de Optimizacion v2

> **INSTRUCCIONES PARA LLM:** Este documento es autocontenido. Contiene todo el contexto necesario para implementar las optimizaciones sin explorar el codigo. Cada tarea incluye: archivo exacto, codigo actual, codigo propuesto, y criterios de verificacion.

---

## Contexto del Proyecto

**Nombre:** BYD Stats
**Tipo:** Aplicacion web React/TypeScript para estadisticas de vehiculos electricos BYD
**Stack tecnologico:**
- Frontend: React 18 + TypeScript + Vite
- Estado: React Context API (multiples providers)
- Backend: Firebase Firestore + Cloud Functions
- Sincronizacion: Google Drive API
- UI: Tailwind CSS + Headless UI
- Listas virtualizadas: @tanstack/react-virtual
- Validacion: Zod
- Workers: Comlink (instalado pero subutilizado)

**Estructura de carpetas relevante:**
```
src/
├── components/
│   ├── cards/          # TripCard, ChargeCard, StatCard, LiveVehicleStatus
│   ├── modals/         # 27 modales (SettingsModal, TripDetailModal, etc.)
│   ├── lists/          # VirtualizedTripList, VirtualizedChargeList
│   └── views/          # AllTripsView, AllChargesView, tabs principales
├── context/
│   ├── AppContext.tsx  # Settings globales
│   └── CarContext.tsx  # Gestion de vehiculos
├── providers/
│   └── DataProvider.tsx # Provider principal (MONOLITICO - 435 lineas)
├── hooks/
│   ├── useAppData.ts
│   ├── useGoogleSync.ts # 768 lineas - God hook
│   ├── useVehicleStatus.ts
│   └── useLocalStorage.ts
├── services/
│   ├── firebase.ts     # Queries Firestore
│   ├── googleDrive.ts  # Sync con Drive
│   └── PredictiveService.ts # AI/ML predictions
├── core/
│   ├── dataProcessing.ts   # Procesamiento de datos
│   ├── chargingLogic.ts    # Logica de carga inteligente
│   └── constants.ts
├── utils/
│   └── normalize.ts    # Utilidades de normalizacion
├── types/
│   ├── index.ts        # Tipos principales (Trip, Charge, Settings)
│   └── settings.ts     # Schema Zod para Settings
└── workers/
    └── dataWorker.ts   # Web Worker (subutilizado)
```

**Fecha de auditoria:** 2026-02-10
**Estado:** Pendiente de implementacion

---

## Resumen Ejecutivo

| Area | Puntuacion | Problemas Principales |
|------|------------|----------------------|
| Rendimiento | 6.5/10 | Re-renders masivos, calculos sin memoizar |
| Arquitectura | 5.5/10 | DataProvider monolitico, archivos gigantes |
| Seguridad | 4/10 | Firestore RLS abiertos, tokens en localStorage |
| Codigo limpio | 7/10 | Codigo zombie, duplicacion |
| TypeScript | 6/10 | 13 archivos con `any` |

**Impacto potencial:**
- Bundle size: -400KB
- Re-renders: -70%
- TTI: -29% (de 4.5s a 3.2s)
- Costos Firestore: -87%

---

## SPRINT 1: Seguridad + Limpieza de Codigo Zombie

**Prioridad:** CRITICA
**Tiempo estimado:** 2-3 horas
**Riesgo:** Bajo

### Tarea 1.1: Corregir Firestore Rules

**Archivo:** `firestore.rules` (raiz del proyecto)

**Codigo actual (PELIGROSO):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Codigo propuesto:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Trips - solo el propietario puede leer/escribir
    match /trips/{tripId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;
    }

    // Vehicles - solo el propietario
    match /vehicles/{vehicleId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.ownerId;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.ownerId;
    }

    // Charge Sessions - solo el propietario
    match /chargeSessions/{sessionId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;
    }

    // Users - solo su propio documento
    match /users/{userId} {
      allow read, write: if request.auth != null
        && request.auth.uid == userId;
    }
  }
}
```

**Verificacion:**
- [ ] Deploy con `firebase deploy --only firestore:rules`
- [ ] Probar que usuario A no puede leer trips de usuario B
- [ ] Probar que crear trip sin auth falla

---

### Tarea 1.2: Mover tokens de localStorage a sessionStorage

**Archivo:** `src/hooks/useGoogleSync.ts`

**Buscar (aproximadamente linea 497):**
```typescript
localStorage.setItem('google_access_token', accessToken);
localStorage.setItem('google_refresh_token', refreshToken);
```

**Reemplazar con:**
```typescript
sessionStorage.setItem('google_access_token', accessToken);
sessionStorage.setItem('google_refresh_token', refreshToken);
```

**Buscar todas las ocurrencias de:**
```typescript
localStorage.getItem('google_access_token')
localStorage.getItem('google_refresh_token')
```

**Reemplazar con:**
```typescript
sessionStorage.getItem('google_access_token')
sessionStorage.getItem('google_refresh_token')
```

**Verificacion:**
- [ ] Abrir DevTools > Application > Session Storage (no Local Storage)
- [ ] Tokens aparecen en sessionStorage despues de login
- [ ] Al cerrar pestana y reabrir, usuario debe re-autenticar (comportamiento esperado)

---

### Tarea 1.3: Eliminar funciones zombie en normalize.ts

**Archivo:** `src/utils/normalize.ts`

**Eliminar estas funciones (nunca se importan):**

```typescript
// ELIMINAR - Funcion 1 (aproximadamente linea 45)
export function kPaToBar(kPa: number): number {
  return kPa / 100;
}

// ELIMINAR - Funcion 2 (aproximadamente linea 56)
export function formatPressure(kPa: number): string {
  const bar = kPaToBar(kPa);
  return `${bar.toFixed(2)} bar`;
}

// ELIMINAR - Funcion 3 (aproximadamente linea 67)
export function parseNumeric(value: string | number): number {
  if (typeof value === 'number') return value;
  return parseFloat(value) || 0;
}
```

**Verificacion:**
- [ ] `npm run build` compila sin errores
- [ ] Buscar imports de estas funciones: `grep -r "kPaToBar\|formatPressure\|parseNumeric" src/` debe retornar vacio

---

### Tarea 1.4: Eliminar hooks huerfanos

**Archivos a ELIMINAR completamente:**

1. `src/hooks/useAsyncState.ts` - Hook generico nunca importado
2. `src/hooks/usePaginatedTrips.ts` - Paginacion no integrada en UI

**Verificacion:**
- [ ] Archivos eliminados
- [ ] `npm run build` compila sin errores
- [ ] `grep -r "useAsyncState\|usePaginatedTrips" src/` retorna vacio

---

### Tarea 1.5: Eliminar constante zombie

**Archivo:** `src/core/constants.ts`

**Buscar y eliminar (aproximadamente linea 78):**
```typescript
export const DEFAULT_FUEL_PRICE = 1.50;
```

**Verificacion:**
- [ ] `grep -r "DEFAULT_FUEL_PRICE" src/` retorna vacio
- [ ] `npm run build` compila sin errores

---

### Tarea 1.6: Eliminar metodo deprecado

**Archivo:** `src/core/chargingLogic.ts`

**Buscar y eliminar (aproximadamente linea 94):**
```typescript
/**
 * @deprecated Use findSmartChargingWindows instead
 */
export function findOptimalChargingWindow(/* parametros */) {
  // ... implementacion ...
}
```

**Verificacion:**
- [ ] `grep -r "findOptimalChargingWindow" src/` retorna vacio (excepto este archivo si aun no se elimina)
- [ ] `npm run build` compila sin errores

---

## SPRINT 2: Memoizacion Critica

**Prioridad:** CRITICA
**Tiempo estimado:** 2-3 horas
**Riesgo:** Bajo

### Tarea 2.1: Memoizar CarContext.value

**Archivo:** `src/context/CarContext.tsx`

**Codigo actual (aproximadamente lineas 138-146):**
```typescript
const value: CarContextType = {
    cars,
    activeCarId,
    setActiveCarId,
    activeCar: cars.find(c => c.id === activeCarId),
    addCar,
    updateCar,
    deleteCar
};

return (
    <CarContext.Provider value={value}>
        {children}
    </CarContext.Provider>
);
```

**Codigo propuesto:**
```typescript
import { useMemo, useCallback } from 'react';

// Asegurar que las funciones estan memoizadas con useCallback
const addCar = useCallback((car: Car) => {
    setCars(prev => [...prev, car]);
}, []);

const updateCar = useCallback((id: string, updates: Partial<Car>) => {
    setCars(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
}, []);

const deleteCar = useCallback((id: string) => {
    setCars(prev => prev.filter(c => c.id !== id));
}, []);

// Memoizar el valor del contexto
const value = useMemo(() => ({
    cars,
    activeCarId,
    setActiveCarId,
    activeCar: cars.find(c => c.id === activeCarId),
    addCar,
    updateCar,
    deleteCar
}), [cars, activeCarId, addCar, updateCar, deleteCar]);

return (
    <CarContext.Provider value={value}>
        {children}
    </CarContext.Provider>
);
```

**Verificacion:**
- [ ] React DevTools Profiler: cambiar settings NO re-renderiza componentes que usan CarContext
- [ ] App funciona igual que antes

---

### Tarea 2.2: Agregar memo() a TripCard

**Archivo:** `src/components/cards/TripCard.tsx`

**Codigo actual (estructura aproximada):**
```typescript
import { FC } from 'react';

interface TripCardProps {
    trip: Trip;
    minEff: number;
    maxEff: number;
    onClick: (trip: Trip) => void;
    isCompact?: boolean;
}

const TripCard: FC<TripCardProps> = ({ trip, minEff, maxEff, onClick, isCompact }) => {
    // ... logica interna con useMemo ...
    return (
        // ... JSX ...
    );
};

export default TripCard;
```

**Codigo propuesto:**
```typescript
import { FC, memo } from 'react';

interface TripCardProps {
    trip: Trip;
    minEff: number;
    maxEff: number;
    onClick: (trip: Trip) => void;
    isCompact?: boolean;
}

const TripCard: FC<TripCardProps> = memo(({ trip, minEff, maxEff, onClick, isCompact }) => {
    // ... logica interna con useMemo ...
    return (
        // ... JSX ...
    );
}, (prevProps, nextProps) => {
    // Comparador personalizado - retorna true si NO debe re-renderizar
    return (
        prevProps.trip.id === nextProps.trip.id &&
        prevProps.trip.updatedAt === nextProps.trip.updatedAt &&
        prevProps.minEff === nextProps.minEff &&
        prevProps.maxEff === nextProps.maxEff &&
        prevProps.isCompact === nextProps.isCompact
        // onClick se omite intencionalmente - asumimos que es estable
    );
});

TripCard.displayName = 'TripCard';

export default TripCard;
```

**Verificacion:**
- [ ] En AllTripsView con 100+ trips, scroll es fluido
- [ ] React DevTools Profiler: solo el TripCard clickeado re-renderiza, no todos

---

### Tarea 2.3: Agregar useCallback a handlers en AllTripsView

**Archivo:** `src/components/views/AllTripsView.tsx`

**Buscar handlers como:**
```typescript
const handleTripClick = (trip: Trip) => {
    setSelectedTrip(trip);
    setShowTripDetail(true);
};

const handleFilterChange = (filter: string) => {
    setFilterType(filter);
};

const handleSortChange = (sort: string, order: 'asc' | 'desc') => {
    setSortBy(sort);
    setSortOrder(order);
};
```

**Reemplazar con:**
```typescript
const handleTripClick = useCallback((trip: Trip) => {
    setSelectedTrip(trip);
    setShowTripDetail(true);
}, []);

const handleFilterChange = useCallback((filter: string) => {
    setFilterType(filter);
}, []);

const handleSortChange = useCallback((sort: string, order: 'asc' | 'desc') => {
    setSortBy(sort);
    setSortOrder(order);
}, []);
```

**Aplicar lo mismo en:** `src/components/views/AllChargesView.tsx`

**Verificacion:**
- [ ] Cambiar filtro NO re-renderiza todos los TripCards (solo los visibles si cambian)

---

### Tarea 2.4: Extraer hook useFilteredData compartido

**Crear archivo:** `src/hooks/useFilteredData.ts`

```typescript
import { useMemo } from 'react';

interface FilterOptions {
    filterType: string;
    month: string | null;
    dateFrom: Date | null;
    dateTo: Date | null;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
}

interface FilteredResult<T> {
    filtered: T[];
    minValue: number;
    maxValue: number;
}

export function useFilteredTrips(
    trips: Trip[],
    options: FilterOptions,
    valueExtractor: (trip: Trip) => number
): FilteredResult<Trip> {
    return useMemo(() => {
        let filtered = [...trips];

        // Filtro por tipo
        if (options.filterType !== 'all') {
            // Implementar logica de filtro segun filterType
        }

        // Filtro por mes
        if (options.month) {
            filtered = filtered.filter(t => {
                const tripMonth = new Date(t.startDate).toISOString().slice(0, 7);
                return tripMonth === options.month;
            });
        }

        // Filtro por rango de fechas
        if (options.dateFrom) {
            filtered = filtered.filter(t => new Date(t.startDate) >= options.dateFrom!);
        }
        if (options.dateTo) {
            filtered = filtered.filter(t => new Date(t.startDate) <= options.dateTo!);
        }

        // Ordenamiento
        filtered.sort((a, b) => {
            let comparison = 0;
            switch (options.sortBy) {
                case 'date':
                    comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
                    break;
                case 'distance':
                    comparison = (a.distance || 0) - (b.distance || 0);
                    break;
                case 'efficiency':
                    comparison = valueExtractor(a) - valueExtractor(b);
                    break;
                default:
                    comparison = 0;
            }
            return options.sortOrder === 'asc' ? comparison : -comparison;
        });

        // Calcular min/max
        const values = filtered.map(valueExtractor);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);

        return { filtered, minValue, maxValue };
    }, [trips, options.filterType, options.month, options.dateFrom, options.dateTo, options.sortBy, options.sortOrder, valueExtractor]);
}
```

**Uso en AllTripsView.tsx:**
```typescript
import { useFilteredTrips } from '@/hooks/useFilteredData';

// En el componente:
const efficiencyExtractor = useCallback((trip: Trip) => trip.efficiency || 0, []);

const { filtered: filteredTrips, minValue: minEff, maxValue: maxEff } = useFilteredTrips(
    trips,
    { filterType, month, dateFrom, dateTo, sortBy, sortOrder },
    efficiencyExtractor
);
```

**Verificacion:**
- [ ] AllTripsView y AllChargesView usan el hook compartido
- [ ] Comportamiento de filtrado identico al anterior

---

## SPRINT 3: Web Workers y Cache

**Prioridad:** ALTA
**Tiempo estimado:** 3-4 horas
**Riesgo:** Medio

### Tarea 3.1: Mover processData a Web Worker

**Archivo existente:** `src/workers/dataWorker.ts`

**Archivo a modificar:** `src/core/dataProcessing.ts`

**Paso 1 - Actualizar el worker:**
```typescript
// src/workers/dataWorker.ts
import * as Comlink from 'comlink';
import type { Trip, Charge, Settings, ProcessedData } from '@/types';

// Copiar la funcion processData aqui (lineas 314-405 de dataProcessing.ts)
function processData(
    trips: Trip[],
    settings: Settings,
    charges: Charge[]
): ProcessedData {
    // ... toda la logica de procesamiento ...
}

// Exponer via Comlink
const workerApi = {
    processData
};

Comlink.expose(workerApi);

export type WorkerApi = typeof workerApi;
```

**Paso 2 - Crear wrapper en dataProcessing.ts:**
```typescript
// src/core/dataProcessing.ts
import * as Comlink from 'comlink';
import type { WorkerApi } from '@/workers/dataWorker';

let workerInstance: Comlink.Remote<WorkerApi> | null = null;

function getWorker(): Comlink.Remote<WorkerApi> {
    if (!workerInstance) {
        const worker = new Worker(
            new URL('../workers/dataWorker.ts', import.meta.url),
            { type: 'module' }
        );
        workerInstance = Comlink.wrap<WorkerApi>(worker);
    }
    return workerInstance;
}

// Funcion publica asincrona
export async function processDataAsync(
    trips: Trip[],
    settings: Settings,
    charges: Charge[]
): Promise<ProcessedData> {
    const worker = getWorker();
    return worker.processData(trips, settings, charges);
}

// Mantener version sincrona para compatibilidad (deprecada)
/** @deprecated Use processDataAsync instead */
export function processData(/* ... */): ProcessedData {
    // ... implementacion actual ...
}
```

**Paso 3 - Actualizar useProcessedData.ts:**
```typescript
// Cambiar de:
const processed = processData(trips, settings, charges);

// A:
const [processed, setProcessed] = useState<ProcessedData | null>(null);

useEffect(() => {
    let cancelled = false;

    processDataAsync(trips, settings, charges)
        .then(result => {
            if (!cancelled) {
                setProcessed(result);
            }
        })
        .catch(console.error);

    return () => { cancelled = true; };
}, [trips, settings, charges]);
```

**Verificacion:**
- [ ] Con 5000+ trips, UI no se congela durante procesamiento
- [ ] DevTools > Performance: main thread libre durante calculo
- [ ] Datos procesados correctos (comparar con version sincrona)

---

### Tarea 3.2: Cache para Google Drive listFiles

**Archivo:** `src/services/googleDrive.ts`

**Agregar cache con TTL:**
```typescript
// Al inicio del archivo
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 30000; // 30 segundos

function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        cache.delete(key);
        return null;
    }
    return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
    cache.set(key, { data, timestamp: Date.now() });
}

// Modificar listFiles:
export async function listFiles(folderId?: string): Promise<DriveFile[]> {
    const cacheKey = `listFiles:${folderId || 'root'}`;

    const cached = getCached<DriveFile[]>(cacheKey);
    if (cached) {
        return cached;
    }

    // ... resto de la implementacion existente ...

    const files = /* resultado de la API */;
    setCache(cacheKey, files);
    return files;
}
```

**Verificacion:**
- [ ] Abrir modal de sync 5 veces seguidas: solo 1 request a Google API
- [ ] Esperar 31 segundos y reabrir: nuevo request (cache expirado)

---

### Tarea 3.3: Batching para localStorage

**Archivo:** `src/hooks/useLocalStorage.ts`

**Agregar debounce para escrituras masivas:**
```typescript
import { useCallback, useRef } from 'react';

// Queue de escrituras pendientes
const writeQueue = new Map<string, { value: unknown; timeout: NodeJS.Timeout }>();

function batchedWrite(key: string, value: unknown, delay = 100): void {
    // Cancelar escritura pendiente anterior
    const pending = writeQueue.get(key);
    if (pending) {
        clearTimeout(pending.timeout);
    }

    // Programar nueva escritura
    const timeout = setTimeout(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('localStorage write failed:', e);
        }
        writeQueue.delete(key);
    }, delay);

    writeQueue.set(key, { value, timeout });
}

// En el hook useLocalStorage, reemplazar:
// localStorage.setItem(key, JSON.stringify(value));
// Con:
// batchedWrite(key, value);
```

**Verificacion:**
- [ ] Importar 100 trips: localStorage se escribe 1 vez (no 100)
- [ ] Datos persisten correctamente despues del batch

---

## SPRINT 4: Optimizacion Firebase

**Prioridad:** ALTA
**Tiempo estimado:** 2-3 horas
**Riesgo:** Medio

### Tarea 4.1: Reducir limit y agregar paginacion lazy

**Archivo:** `src/services/firebase.ts`

**Codigo actual (aproximadamente linea 86):**
```typescript
const maxTrips = 500;
// ...
const q = query(
    collection(db, 'trips'),
    where('userId', '==', userId),
    orderBy('startDate', 'desc'),
    limit(maxTrips)
);
```

**Codigo propuesto:**
```typescript
const INITIAL_LIMIT = 50;
const PAGE_SIZE = 50;

// Nueva funcion para paginacion
export async function fetchTripsPage(
    userId: string,
    lastDoc?: DocumentSnapshot,
    pageSize = PAGE_SIZE
): Promise<{ trips: Trip[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
    let q = query(
        collection(db, 'trips'),
        where('userId', '==', userId),
        where('status', '==', 'completed'), // Filtro server-side
        orderBy('startDate', 'desc'),
        limit(pageSize + 1) // +1 para saber si hay mas
    );

    if (lastDoc) {
        q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;

    const trips = docs
        .slice(0, pageSize)
        .map(doc => ({ id: doc.id, ...doc.data() } as Trip));

    const newLastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

    return { trips, lastDoc: newLastDoc, hasMore };
}

// Modificar subscribeToTrips para usar limite inicial menor
export function subscribeToTrips(userId: string, callback: (trips: Trip[]) => void) {
    const q = query(
        collection(db, 'trips'),
        where('userId', '==', userId),
        where('status', '==', 'completed'),
        orderBy('startDate', 'desc'),
        limit(INITIAL_LIMIT)
    );

    return onSnapshot(q, (snapshot) => {
        const trips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
        callback(trips);
    });
}
```

**Verificacion:**
- [ ] Al cargar app, solo 50 trips se descargan inicialmente
- [ ] Scroll al final carga mas trips (si se implementa infinite scroll)
- [ ] Firestore Console muestra menos reads

---

### Tarea 4.2: Crear indices Firestore

**Archivo a crear/modificar:** `firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "trips",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "startDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "chargeSessions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "vehicleId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "vehicles",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ownerId", "order": "ASCENDING" },
        { "fieldPath": "lastUpdate", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**Deploy:**
```bash
firebase deploy --only firestore:indexes
```

**Verificacion:**
- [ ] Firebase Console > Firestore > Indexes muestra los indices creados
- [ ] Queries complejas no muestran warning de "index required"

---

### Tarea 4.3: Consolidar suscripciones duplicadas

**Problema:** `HealthReportModal.tsx` y `useVehicleStatus.ts` ambos suscriben al mismo documento.

**Archivo:** `src/components/modals/HealthReportModal.tsx`

**Buscar y eliminar suscripcion duplicada:**
```typescript
// ELIMINAR este useEffect completo (aproximadamente lineas 49-70):
useEffect(() => {
    if (!activeCar?.smartcarVehicleId) return;

    const vehicleRef = doc(db, 'vehicles', activeCar.smartcarVehicleId);
    const unsubscribe = onSnapshot(vehicleRef, (snapshot) => {
        // ... logica ...
    });

    return () => unsubscribe();
}, [activeCar?.smartcarVehicleId]);
```

**Reemplazar con uso del hook existente:**
```typescript
import { useVehicleStatus } from '@/hooks/useVehicleStatus';

// En el componente:
const { vehicleData, loading, error } = useVehicleStatus(activeCar?.smartcarVehicleId);
```

**Verificacion:**
- [ ] Solo 1 listener activo por vehiculo (verificar en Firebase Console > Usage)
- [ ] HealthReportModal muestra datos correctos

---

## SPRINT 5: Dividir DataProvider (ALTO RIESGO)

**Prioridad:** ALTA
**Tiempo estimado:** 5-7 dias
**Riesgo:** ALTO - Requiere tests exhaustivos

### Tarea 5.1: Crear providers especializados

**Crear archivos:**

1. `src/providers/TripsProvider.tsx`
2. `src/providers/ChargesProvider.tsx`
3. `src/providers/ModalProvider.tsx`
4. `src/providers/FiltersProvider.tsx`
5. `src/providers/SyncProvider.tsx`

**Ejemplo para TripsProvider:**
```typescript
// src/providers/TripsProvider.tsx
import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import type { Trip } from '@/types';

interface TripsContextType {
    trips: Trip[];
    setTrips: (trips: Trip[]) => void;
    addTrip: (trip: Trip) => void;
    updateTrip: (id: string, updates: Partial<Trip>) => void;
    deleteTrip: (id: string) => void;
    selectedTrip: Trip | null;
    setSelectedTrip: (trip: Trip | null) => void;
}

const TripsContext = createContext<TripsContextType | null>(null);

export function TripsProvider({ children }: { children: ReactNode }) {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

    const addTrip = useCallback((trip: Trip) => {
        setTrips(prev => [...prev, trip]);
    }, []);

    const updateTrip = useCallback((id: string, updates: Partial<Trip>) => {
        setTrips(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }, []);

    const deleteTrip = useCallback((id: string) => {
        setTrips(prev => prev.filter(t => t.id !== id));
    }, []);

    const value = useMemo(() => ({
        trips,
        setTrips,
        addTrip,
        updateTrip,
        deleteTrip,
        selectedTrip,
        setSelectedTrip
    }), [trips, selectedTrip, addTrip, updateTrip, deleteTrip]);

    return (
        <TripsContext.Provider value={value}>
            {children}
        </TripsContext.Provider>
    );
}

export function useTrips() {
    const context = useContext(TripsContext);
    if (!context) {
        throw new Error('useTrips must be used within TripsProvider');
    }
    return context;
}
```

**Tarea 5.2: Crear DataProvider como compositor (backwards-compatible)**

```typescript
// src/providers/DataProvider.tsx (refactorizado)
import { ReactNode } from 'react';
import { TripsProvider, useTrips } from './TripsProvider';
import { ChargesProvider, useCharges } from './ChargesProvider';
import { ModalProvider, useModals } from './ModalProvider';
import { FiltersProvider, useFilters } from './FiltersProvider';
import { SyncProvider, useSync } from './SyncProvider';

// Provider compuesto
export function DataProvider({ children }: { children: ReactNode }) {
    return (
        <SyncProvider>
            <FiltersProvider>
                <TripsProvider>
                    <ChargesProvider>
                        <ModalProvider>
                            {children}
                        </ModalProvider>
                    </ChargesProvider>
                </TripsProvider>
            </FiltersProvider>
        </SyncProvider>
    );
}

// Hook de compatibilidad (DEPRECADO - migrar componentes gradualmente)
/** @deprecated Use useTrips, useCharges, useModals, useFilters, useSync instead */
export function useData() {
    const trips = useTrips();
    const charges = useCharges();
    const modals = useModals();
    const filters = useFilters();
    const sync = useSync();

    return {
        ...trips,
        ...charges,
        ...modals,
        ...filters,
        ...sync
    };
}
```

**Verificacion:**
- [ ] App funciona exactamente igual con el nuevo DataProvider
- [ ] `useData()` sigue funcionando (deprecado pero compatible)
- [ ] React DevTools: cambiar trip NO re-renderiza componentes de charges

---

## SPRINT 6-8: Tareas Adicionales (Resumen)

### Sprint 6: Dividir archivos grandes
- [ ] `SettingsModal.tsx` (893 lineas) -> 4 sub-componentes
- [ ] `useGoogleSync.ts` (768 lineas) -> 3 hooks especializados
- [ ] `PredictiveService.ts` (630 lineas) -> separar por algoritmo

### Sprint 7: TypeScript strictness
- [ ] Eliminar `any` en 13 archivos
- [ ] Agregar validacion zod en imports de Google Drive
- [ ] Implementar Error Boundaries por seccion

### Sprint 8: Bundle optimization
- [ ] Lazy load 20+ modales raramente usados
- [ ] Eliminar dependencias muertas (leaflet, react-leaflet) si TripMapModal no se completa
- [ ] Analizar bundle con webpack-bundle-analyzer

> **NOTA sobre sql.js (~300KB):** Es **CRITICO** para la version gratuita.
> Se usa en `src/hooks/useDatabase.ts` para importar/exportar `EC_database.db` del BYD.
> **NO ELIMINAR.** Alternativa futura: `wa-sqlite` (~150KB) si se necesita reducir bundle.

---

## Metricas de Exito

| Metrica | Actual | Objetivo |
|---------|--------|----------|
| Lighthouse Performance | ~65 | > 85 |
| TTI (Time to Interactive) | ~4.5s | < 3s |
| Bundle size (gzipped) | ~800KB | < 500KB |
| Re-renders por interaccion | 15-20 | < 5 |
| Firestore reads/mes/usuario | ~2500 | < 500 |

---

## Comandos Utiles

```bash
# Verificar build
npm run build

# Verificar tipos
npx tsc --noEmit

# Buscar codigo zombie
grep -r "FUNCION_A_BUSCAR" src/

# Analizar bundle
npm run build && npx webpack-bundle-analyzer dist/stats.json

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy indices
firebase deploy --only firestore:indexes
```

---

## Historial de Cambios

| Fecha | Version | Cambios |
|-------|---------|---------|
| 2026-02-10 | 2.0 | Auditoria completa, documento optimizado para LLMs |
| 2026-02-09 | 1.0 | Version inicial |

---

*Documento autocontenido para continuidad entre sesiones LLM.*
*Ultima actualizacion: 2026-02-10*
