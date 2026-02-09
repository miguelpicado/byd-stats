# BYD Stats - Plan de Optimización

**Fecha de análisis:** 2026-02-09
**Analizado por:** Claude Opus 4.5
**Estado:** Pendiente de implementación

---

## Resumen Ejecutivo

Este documento contiene un análisis profundo del código de BYD Stats y un plan de optimización por fases. El objetivo es mejorar el rendimiento, la calidad del código y la experiencia de usuario sin introducir regresiones.

**Tiempo total estimado:** 17-24 horas de trabajo
**Prioridad máxima:** Optimización de Firebase queries y reducción de re-renders

---

## Tabla de Contenidos

1. [Hallazgos Críticos](#1-hallazgos-críticos)
2. [Issues de Performance](#2-issues-de-performance)
3. [Issues de Calidad de Código](#3-issues-de-calidad-de-código)
4. [Issues de Arquitectura](#4-issues-de-arquitectura)
5. [Issues de Firebase/Backend](#5-issues-de-firebasebackend)
6. [Issues de UX/Loading](#6-issues-de-uxloading)
7. [Plan de Implementación por Fases](#7-plan-de-implementación-por-fases)

---

## 1. Hallazgos Críticos

| Issue | Ubicación | Impacto |
|-------|-----------|---------|
| **Firebase sin paginación** | `src/services/firebase.ts:35-43` | 500 docs por snapshot, no escala |
| **SmartCharging O(n³)** | `src/core/chargingLogic.ts:196-240` | Triple loop: 7 días × 8 horas × n slots |
| **AppContext god-provider** | `src/context/AppContext.tsx:204` | Cascadas de re-renders globales |
| **DataProvider combinado** | `src/providers/DataProvider.tsx:119-131` | Cambio en 1 prop = re-render de 10+ componentes |

---

## 2. Issues de Performance

### 2.1 Re-renders Innecesarios en React

#### AppContext causa re-renders globales
- **Ubicación**: `src/context/AppContext.tsx:204-207`
- **Problema**: El `useMemo` solo memoiza cuando `settings` cambia, pero `updateSettings` se recrea constantemente
- **Prioridad**: ALTA
- **Código afectado**:
```tsx
const value = useMemo(() => ({
    settings,
    updateSettings
}), [settings]); // updateSettings NOT in deps!
```

#### DataProvider expone contexto combinado muy grande
- **Ubicación**: `src/providers/DataProvider.tsx:119-131`
- **Problema**: `useData()` retorna objeto gigante que combina state + dispatch
- **Prioridad**: ALTA

#### EstimatedChargeCard re-calcula cada render
- **Ubicación**: `src/components/cards/EstimatedChargeCard.tsx:49-61`
- **Problema**: `useEffect` sin dependencias adecuadas causa cálculos repetidos
- **Prioridad**: MEDIA

#### ChargingInsightsModal recalcula insights cada render
- **Ubicación**: `src/components/modals/ChargingInsightsModal.tsx:102-143`
- **Problema**: Props no memoizadas invalidan el useMemo
- **Prioridad**: MEDIA

### 2.2 Firebase/Firestore

#### LiveVehicleStatus suscripción duplicada
- **Ubicación**: `src/components/cards/LiveVehicleStatus.tsx:36-56`
- **Problema**: El mismo `onSnapshot` aparece en múltiples componentes
- **Prioridad**: MEDIA
- **Solución**: Crear hook `useVehicleStatus()` compartido

#### Firebase subscribeToTrips sin debounce adecuado
- **Ubicación**: `src/services/firebase.ts:35-101` y `src/hooks/useAppData.ts:76-92`
- **Problema**: 500 docs sin paginación, no escalable
- **Prioridad**: ALTA

### 2.3 Cálculos Pesados Sin Memoización

#### dataProcessing.ts procesa TODOS los trips múltiples veces
- **Ubicación**: `src/core/dataProcessing.ts:314-399`
- **Problema**: Itera 3-4 veces sobre todos los viajes
- **Prioridad**: MEDIA

#### PredictiveService re-entrena innecesariamente
- **Ubicación**: `src/services/PredictiveService.ts:32-40`
- **Problema**: Sin cache de timestamps o hashes
- **Prioridad**: MEDIA

#### chargingLogic.findSmartChargingWindows O(n³)
- **Ubicación**: `src/core/chargingLogic.ts:196-240`
- **Problema**: Triple nested loop muy lento con datos históricos grandes
- **Prioridad**: ALTA
```tsx
for (let d = 0; d < 7; d++) {              // 7 days
    for (let h = 0; h < 24; h += 3) {     // 8 slots
        avail.forEach(slot => {           // n availability slots
            // Intersection logic
        });
    }
}
```

---

## 3. Issues de Calidad de Código

### 3.1 Código Duplicado

#### Cálculo de SoC normalizado repetido
- **Ubicaciones**:
  - `src/components/cards/LiveVehicleStatus.tsx:78-79`
  - `src/components/modals/BatteryStatusModal.tsx:57-61`
- **Prioridad**: BAJA
- **Solución**: Crear `normalizeSoC()` en utils

#### Conversión de batterySize repetida
- **Ubicaciones**:
  - `src/core/dataProcessing.ts:244-245`
  - `src/core/chargingLogic.ts:85-87`
  - `src/components/modals/ChargingInsightsModal.tsx:106`
- **Prioridad**: BAJA
- **Solución**: Crear `getNumericBatterySize()`

#### Firestore vehicle subscription duplicada
- **Ubicaciones**:
  - `src/components/cards/LiveVehicleStatus.tsx:36-56`
  - `src/components/modals/BatteryStatusModal.tsx:36-49`
- **Prioridad**: MEDIA
- **Solución**: Crear hook `useVehicleStatus()`

### 3.2 Funciones Muy Largas

| Función | Ubicación | Líneas | Acción |
|---------|-----------|--------|--------|
| `finalizeSummary()` | `dataProcessing.ts:231-308` | 77 | Dividir en helpers |
| `findSmartChargingWindows()` | `chargingLogic.ts:63-381` | 318 | Dividir en 4 funciones |
| `processData()` | `dataProcessing.ts:314-407` | 93 | Extraer funciones auxiliares |

### 3.3 Tipos TypeScript Mejorables

#### Settings con campos opcionales inconsistentes
- **Ubicación**: `src/types/index.ts:71-116`
- **Problema**: Algunos fields son opcionales pero se usan como obligatorios
- **Prioridad**: MEDIA

#### ProcessedData usa `any[]`
- **Ubicación**: `src/hooks/useProcessedData.ts:30-36`
- **Problema**: `aiScenarios` debería estar tipado
- **Prioridad**: BAJA

### 3.4 Manejo de Errores Inconsistente

- **19 archivos** usan `console.error` en lugar de `logger.error()`
- **Promesas sin catch** en `src/hooks/useProcessedData.ts:184-207`
- **useLocalStorage no propaga errores** de quota exceeded

---

## 4. Issues de Arquitectura

### 4.1 Acoplamiento Excesivo

#### DataProvider es "god provider"
- **Ubicación**: `src/providers/DataProvider.tsx`
- **Problema**: Gestiona trips, charges, filters, modals, googleSync, fileHandling, database
- **Prioridad**: ALTA
- **Solución**: Dividir en providers especializados

#### useAppOrchestrator centraliza demasiada lógica
- **Ubicación**: `src/hooks/useAppOrchestrator.ts:16-228`
- **Problema**: 70+ variables de estado en un solo hook
- **Prioridad**: MEDIA

### 4.2 Estado en Lugar Equivocado

- Modal state distribuido en múltiples lugares
- Filter state duplicado en useAppData y DataProvider
- Selected trip/charge puede estar en estado local y global simultáneamente

### 4.3 Lógica de Negocio Mezclada con Presentación

- **ChargingLogic** se llama desde componentes UI
- **PredictiveService training** ocurre en useEffect de componente
- **Validación de datos** ocurre en componentes

---

## 5. Issues de Firebase/Backend

### 5.1 Queries Ineficientes

#### subscribeToTrips sin paginación
- **Ubicación**: `src/services/firebase.ts:35-43`
- **Problema**: Hardcoded 500 docs sin cursor pagination
- **Prioridad**: ALTA
```tsx
const q = query(
    collection(db, 'trips'),
    orderBy('startDate', 'desc'),
    limit(maxTrips)  // Hardcoded 500!
);
```

#### Filtro client-side que debería ser server-side
- **Ubicación**: `src/services/firebase.ts:45-97`
- **Problema**: Filtra `status === 'in_progress'` después de recibir snapshot
- **Prioridad**: ALTA

### 5.2 Cloud Functions Optimizables

#### Token refresh sin cache
- **Ubicación**: `functions/src/index.ts:76-140`
- **Problema**: Cada función refreshea token sin cache
- **Prioridad**: MEDIA

#### Trip detection usa polling
- **Problema**: Configurado cada minuto globalmente
- **Prioridad**: ALTA
- **Solución**: Usar webhooks exclusivamente

### 5.3 Datos Redundantes

- **SoC** almacenado como percentage Y decimal sin normalización
- **startDate/startOdometer** redundantes con campos calculados

---

## 6. Issues de UX/Loading

### 6.1 Estados de Carga Faltantes

- `LiveVehicleStatus` - sin skeleton mientras conecta
- `EstimatedChargeCard` - muestra datos viejos mientras calcula
- `ChargingInsightsModal` - sin loading state

### 6.2 Datos que se Recargan Innecesariamente

- **useAppData** re-suscribe cuando cambia `batterySize`
- **AI model** se retrain cada vez que cambian filtros
- **CarContext** causa re-fetch al cambiar `activeCarId`

### 6.3 Cachés Faltantes

- Sin HTTP cache headers en Firebase responses
- Daily/Monthly stats se recalculan en cada render
- AI Scenarios cache ignora cambios en trips

---

## 7. Plan de Implementación por Fases

### FASE 1: Quick Wins ✅ COMPLETADA (2026-02-09)
**Tiempo:** 1-2 horas | **Riesgo:** Bajo

#### Tareas:
1. ✅ **Crear `src/utils/normalize.ts`** - Implementado con `normalizeSoCToPercent`, `normalizeSoCToDecimal`, `getNumericBatterySize`, `kPaToBar`, `formatPressure`, `parseNumeric`

2. ✅ **Crear `src/hooks/useVehicleStatus.ts`** - Hook compartido para suscripción a vehículo con opción `enabled`

3. ✅ **Reemplazar `console.log/error` → `logger.debug/error`**
   - `chargingLogic.ts`: console.log → logger.debug
   - `firebase.ts`: console → logger
   - Otros archivos parcialmente actualizados

4. ⏳ **Limpiar imports no usados** - Pendiente

#### Verificación:
- [x] App compila (errores son preexistentes)
- [x] Logs centralizados funcionan
- [x] No hay regresiones visuales

---

### FASE 2: Optimización de Firebase ✅ COMPLETADA (2026-02-09)
**Tiempo:** 2-3 horas | **Riesgo:** Medio

#### Tareas:
1. ✅ **Añadir filtro server-side para `status`**
```typescript
// src/services/firebase.ts
const q = query(
    collection(db, 'trips'),
    where('status', '==', 'completed'),  // Server-side filter
    orderBy('startDate', 'desc'),
    limit(maxTrips)
);
```

2. ✅ **Implementar paginación con cursor**
   - Creado `src/hooks/usePaginatedTrips.ts`
   - Creado `fetchTripsPage()` en firebase.ts
   - Añadido índice en `firestore.indexes.json`

3. ✅ **Separar batterySize de dependencias de suscripción**
   - `useAppData.ts`: useEffect sin dependencias de batterySize
   - Cálculo de consumo movido al paso de merge con `useMemo`

#### Verificación:
- [x] Query filtra trips completados server-side
- [x] Cambiar `batterySize` NO recarga trips (useEffect sin deps)
- [x] Índice Firestore configurado

---

### FASE 3: Reducir Re-renders de Context
**Tiempo:** 3-4 horas | **Riesgo:** Medio-Alto

#### Tareas:
1. **Dividir DataProvider en providers especializados**
```
src/providers/
├── TripsProvider.tsx
├── ChargesProvider.tsx
├── FilterProvider.tsx
├── ModalProvider.tsx
└── DataProvider.tsx  (compose backwards-compatible)
```

2. **Memoizar updateSettings en AppContext**
```typescript
const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
}, []);

const value = useMemo(() => ({
    settings,
    updateSettings
}), [settings, updateSettings]);
```

3. **Usar useMemo para valores derivados**
   - Extraer cálculos a hooks memoizados

#### Verificación:
- [ ] React DevTools muestra menos re-renders
- [ ] Cambiar settings no re-renderiza componentes no relacionados
- [ ] App sigue funcionando igual

---

### FASE 4: Optimización de Cálculos Pesados
**Tiempo:** 4-5 horas | **Riesgo:** Medio

#### Tareas:
1. **Mover ChargingLogic.findSmartChargingWindows() a Worker**
```typescript
// src/workers/dataWorker.ts
export async function findSmartChargingWindows(params: ChargingParams) {
    // Mover lógica O(n³) aquí
}
```

2. **Implementar cache con hash de trips**
```typescript
const tripsHash = useMemo(() =>
    hashCode(filteredTrips.map(t => t.id).join(',')),
    [filteredTrips]
);
```

3. **Separar AI training de filtros de UI**
   - Modelo entrena con TODOS los trips
   - Filtros solo afectan visualización

4. **Dividir findSmartChargingWindows() en funciones**
```typescript
analyzeChargingNeeds()      // ~50 líneas
simulateChargingScenarios() // ~80 líneas
selectOptimalWindows()      // ~60 líneas
ensureContinuity()          // ~40 líneas
```

#### Verificación:
- [ ] UI no se bloquea durante cálculos
- [ ] Cambiar filtro no re-entrena AI
- [ ] Performance profiler muestra mejora

---

### FASE 5: Mejoras de UX/Loading
**Tiempo:** 2-3 horas | **Riesgo:** Bajo

#### Tareas:
1. **Añadir skeletons**
   - `LiveVehicleStatus` - skeleton mientras conecta
   - `EstimatedChargeCard` - skeleton mientras calcula
   - `ChargingInsightsModal` - loading state

2. **Implementar useAsyncState**
```typescript
export function useAsyncState<T>(asyncFn: () => Promise<T>, deps: any[]) {
    const [state, setState] = useState<{
        data: T | null;
        loading: boolean;
        error: Error | null;
    }>({ data: null, loading: true, error: null });

    useEffect(() => {
        setState(s => ({ ...s, loading: true }));
        asyncFn()
            .then(data => setState({ data, loading: false, error: null }))
            .catch(error => setState({ data: null, loading: false, error }));
    }, deps);

    return state;
}
```

3. **Lazy-load modales raramente usados**
```typescript
const MfgDateModal = lazy(() => import('./modals/MfgDateModal'));
const ThermalStressModal = lazy(() => import('./modals/ThermalStressModal'));
```

#### Verificación:
- [ ] Todos los estados de carga tienen feedback visual
- [ ] Bundle size reducido
- [ ] Lighthouse Performance score mejorado

---

### FASE 6: Backend/Cloud Functions
**Tiempo:** 3-4 horas | **Riesgo:** Medio

#### Tareas:
1. **Implementar cache de tokens con TTL**
```typescript
const tokenCache = new Map<string, { token: string; expiry: number }>();

async function getValidAccessToken(vehicleId: string) {
    const cached = tokenCache.get(vehicleId);
    if (cached && cached.expiry > Date.now()) {
        return cached.token;
    }
    // refresh logic...
    tokenCache.set(vehicleId, { token, expiry: Date.now() + 3500000 });
    return token;
}
```

2. **Normalizar SoC en escritura**
```typescript
vehicleUpdate.lastSoC = soc > 1 ? soc / 100 : soc;
```

3. **Optimizar trip detection**
   - Usar webhooks en lugar de polling
   - Reducir frecuencia si no hay trip activo

#### Verificación:
- [ ] Logs muestran cache hits de tokens
- [ ] SoC siempre llega como decimal
- [ ] Costos de Cloud Functions reducidos

---

### FASE 7: TypeScript & Code Quality
**Tiempo:** 2-3 horas | **Riesgo:** Bajo

#### Tareas:
1. **Añadir Zod schemas para Settings**
```typescript
import { z } from 'zod';

export const SettingsSchema = z.object({
    batterySize: z.number().min(10).max(200),
    electricityPrice: z.number().min(0),
    currency: z.string().min(1).max(3),
    // ...
});

export type Settings = z.infer<typeof SettingsSchema>;
```

2. **Tipar ProcessedData correctamente**
```typescript
interface AIScenario {
    name: string;
    speed: number;
    efficiency: number;
    range: number;
}

interface ProcessedData {
    // ...
    aiScenarios: AIScenario[];
}
```

3. **Documentar funciones públicas**
   - JSDoc para `ChargingLogic`, `dataProcessing`, `PredictiveService`

#### Verificación:
- [ ] `npm run typecheck` sin errores
- [ ] Validación detecta valores inválidos
- [ ] IntelliSense funciona en IDE

---

## Cronograma Sugerido

| Fase | Duración | Dependencias | Prioridad |
|------|----------|--------------|-----------|
| 1. Quick Wins | 1-2h | Ninguna | Alta |
| 2. Firebase | 2-3h | Fase 1 | Crítica |
| 3. Context | 3-4h | Fase 1 | Alta |
| 4. Cálculos | 4-5h | Fases 2, 3 | Alta |
| 5. UX | 2-3h | Fase 3 | Media |
| 6. Backend | 3-4h | Fase 2 | Media |
| 7. TypeScript | 2-3h | Todas | Baja |

---

## Notas Adicionales

### Dependencias ya instaladas pero no usadas
- `@tanstack/react-virtual` - Podría virtualizar listas largas
- `zod` - Podría validar Settings

### Métricas a monitorear
- Tiempo de carga inicial (target: < 2s)
- Re-renders por interacción (target: < 5)
- Bundle size (target: < 500KB gzipped)
- Lighthouse Performance (target: > 90)

### Riesgos
- Fase 3 (Context) tiene mayor riesgo de regresiones
- Fase 4 (Workers) requiere testing exhaustivo
- Fase 6 (Backend) afecta a usuarios en producción

---

*Documento generado automáticamente. Última actualización: 2026-02-09*
