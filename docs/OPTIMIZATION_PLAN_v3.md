# BYD Stats - Plan de Optimizacion v3

> **INSTRUCCIONES PARA LLM:** Este documento es autocontenido. Contiene todo el contexto necesario para implementar las optimizaciones sin explorar el codigo. Cada tarea incluye: archivo exacto, codigo actual (cuando aplica), codigo propuesto, y criterios de verificacion. Sigue las tareas en orden de prioridad.

---

## Contexto del Proyecto

**Nombre:** BYD Stats
**Tipo:** Aplicacion web React/TypeScript para estadisticas de vehiculos electricos BYD
**Stack tecnologico:**
- Frontend: React 18 + TypeScript + Vite
- Estado: React Context API (5 providers especializados)
- Backend: Firebase Firestore + Cloud Functions
- Sincronizacion: Google Drive API
- UI: Tailwind CSS + Headless UI
- Listas virtualizadas: @tanstack/react-virtual
- Validacion: Zod
- Workers: Comlink (configurado, subutilizado)
- AI/ML: TensorFlow.js (PROBLEMA: 222KB gzipped)

**Estructura de carpetas relevante:**
```
src/
├── components/
│   ├── cards/          # TripCard (memoizado), ChargeCard, StatCard
│   ├── modals/         # 27+ modales (lazy loaded)
│   ├── lists/          # VirtualizedTripList, VirtualizedChargeList
│   ├── settings/       # AppPreferences, ChargingSettings, PriceSettings, etc.
│   └── common/         # ModalContainer (61 lazy imports)
├── context/
│   ├── AppContext.tsx  # Settings globales (memoizado)
│   └── CarContext.tsx  # Gestion de vehiculos (memoizado)
├── providers/
│   ├── DataProvider.tsx    # Compositor (268 lineas)
│   ├── TripsProvider.tsx   # Trips + AI
│   ├── ChargesProvider.tsx # Cargas
│   ├── FilterProvider.tsx  # Filtros
│   ├── ModalProvider.tsx   # Estado modales
│   └── SyncProvider.tsx    # Google Drive + DB
├── hooks/
│   ├── useFilteredData.ts  # Hook compartido (OK)
│   ├── useGoogleSync.ts    # Reducido a 180 lineas
│   └── sync/
│       ├── useGoogleAuth.ts
│       ├── useCloudRegistry.ts
│       └── useDriveSync.ts
├── services/
│   ├── firebase.ts
│   ├── googleDrive.ts      # SIN CACHE (pendiente)
│   └── PredictiveService.ts # 630 lineas, TensorFlow (PROBLEMA)
├── core/
│   ├── dataProcessing.ts   # processData (sincrono, no usa worker)
│   ├── chargingLogic.ts
│   └── constants.ts
├── workers/
│   └── dataWorker.ts       # Comlink configurado, SUBUTILIZADO
└── types/
    └── index.ts
```

**Fecha de auditoria:** 2026-02-10
**Version anterior:** v2 (parcialmente implementada)
**Estado:** Requiere optimizaciones criticas de bundle

---

## Resumen del Estado Actual

### Metricas Actuales vs Objetivos

| Metrica | v2 Objetivo | Estado Actual | v3 Objetivo |
|---------|-------------|---------------|-------------|
| Bundle size (gzip) | < 500KB | **781KB** | < 450KB |
| Archivos con `any` | 0 | **51** | < 10 |
| Lighthouse Performance | > 85 | ~65 | > 85 |
| TTI | < 3s | ~4.5s | < 2.5s |
| Firestore reads/mes | < 500 | ~2500 | < 300 |

### Tareas v2 Completadas
- [x] Firestore rules seguras
- [x] Tokens en sessionStorage
- [x] Codigo zombie eliminado
- [x] CarContext memoizado
- [x] TripCard con React.memo
- [x] useFilteredData hook creado
- [x] DataProvider dividido en 5 providers
- [x] SettingsModal dividido (893 -> 83 lineas)
- [x] useGoogleSync dividido (768 -> 180 lineas)
- [x] 61 componentes lazy loaded

### Tareas v2 NO Completadas (Migradas a v3)
- [ ] Bundle size > 500KB (PredictiveService = 222KB)
- [ ] 51 archivos con `any` (empeoro de 13)
- [ ] processDataAsync no integrado
- [ ] Cache Google Drive no implementado
- [ ] Paginacion Firestore no implementada
- [ ] localStorage batching no implementado

---

## SPRINT 1: Reduccion Critica de Bundle (TensorFlow)

**Prioridad:** CRITICA
**Tiempo estimado:** 3-4 horas
**Impacto esperado:** -220KB bundle, TTI -40%

### Problema Principal

El chunk `PredictiveService.js` pesa **222KB gzipped** porque importa TensorFlow.js directamente. Este codigo se carga aunque el usuario nunca use las funciones de AI.

### Tarea 1.1: Mover TensorFlow al Worker (Dynamic Import)

**Archivo:** `src/services/PredictiveService.ts`

**Problema actual:** TensorFlow se importa al inicio del archivo.

**Buscar (lineas 1-10 aproximadamente):**
```typescript
import * as tf from '@tensorflow/tfjs';
```

**Reemplazar con:**
```typescript
// TensorFlow se carga dinamicamente solo cuando se necesita
let tf: typeof import('@tensorflow/tfjs') | null = null;

async function getTensorFlow() {
    if (!tf) {
        tf = await import('@tensorflow/tfjs');
        // Configurar backend optimizado
        await tf.setBackend('webgl');
        await tf.ready();
    }
    return tf;
}
```

**Modificar todos los usos de `tf.` en el archivo:**

Ejemplo - buscar patrones como:
```typescript
const model = tf.sequential();
```

Reemplazar con:
```typescript
const tfLib = await getTensorFlow();
const model = tfLib.sequential();
```

**Lista de metodos a modificar (buscar cada uno):**
- `tf.sequential()` -> `(await getTensorFlow()).sequential()`
- `tf.tensor()` -> `(await getTensorFlow()).tensor()`
- `tf.tensor2d()` -> `(await getTensorFlow()).tensor2d()`
- `tf.layers.*` -> `(await getTensorFlow()).layers.*`
- `tf.train.*` -> `(await getTensorFlow()).train.*`
- `tf.tidy()` -> `(await getTensorFlow()).tidy()`
- `tf.dispose()` -> `(await getTensorFlow()).dispose()`

**Verificacion:**
- [ ] `npm run build` compila sin errores
- [ ] El chunk `PredictiveService.js` ya no aparece en el build inicial
- [ ] TensorFlow aparece como chunk separado cargado bajo demanda
- [ ] Las funciones de AI siguen funcionando (probar RangeInsightsModal)

---

### Tarea 1.2: Crear TensorFlow Worker Dedicado

**Crear archivo:** `src/workers/tensorflowWorker.ts`

```typescript
// TensorFlow Worker - Aislado del main thread
import * as Comlink from 'comlink';

// TensorFlow se carga solo en este worker
let tf: typeof import('@tensorflow/tfjs') | null = null;
let model: any = null;
let parkingModel: any = null;
let sohModel: any = null;

async function ensureTensorFlow() {
    if (!tf) {
        tf = await import('@tensorflow/tfjs');
        await tf.setBackend('webgl');
        await tf.ready();
        console.log('[TF Worker] TensorFlow loaded, backend:', tf.getBackend());
    }
    return tf;
}

interface TrainResult {
    success: boolean;
    loss?: number;
    error?: string;
}

interface PredictionResult {
    scenarios: Array<{ name: string; speed: number; efficiency: number; range: number }>;
    loss: number;
}

const api = {
    // Entrenar modelo de eficiencia
    async trainEfficiency(trips: any[]): Promise<TrainResult> {
        try {
            const tfLib = await ensureTensorFlow();

            // Filtrar viajes validos
            const valid = trips.filter(t =>
                t.distance > 1 &&
                t.electricity > 0 &&
                typeof t.avg_speed === 'number'
            );

            if (valid.length < 10) {
                return { success: false, error: 'Insufficient data (need 10+ trips)' };
            }

            // Preparar datos
            const xs = valid.map(t => [
                t.avg_speed || 50,
                t.distance || 10,
                t.elevation_gain || 0,
                t.temperature || 20
            ]);
            const ys = valid.map(t => t.electricity / t.distance * 100); // Wh/km

            // Normalizar
            const xTensor = tfLib.tensor2d(xs);
            const yTensor = tfLib.tensor1d(ys);

            const xMin = xTensor.min(0);
            const xMax = xTensor.max(0);
            const xNorm = xTensor.sub(xMin).div(xMax.sub(xMin).add(0.001));

            // Modelo simple
            model = tfLib.sequential({
                layers: [
                    tfLib.layers.dense({ units: 16, activation: 'relu', inputShape: [4] }),
                    tfLib.layers.dense({ units: 8, activation: 'relu' }),
                    tfLib.layers.dense({ units: 1 })
                ]
            });

            model.compile({
                optimizer: tfLib.train.adam(0.01),
                loss: 'meanSquaredError'
            });

            const history = await model.fit(xNorm, yTensor, {
                epochs: 50,
                validationSplit: 0.2,
                verbose: 0
            });

            // Cleanup
            xTensor.dispose();
            yTensor.dispose();
            xMin.dispose();
            xMax.dispose();
            xNorm.dispose();

            const finalLoss = history.history.loss[history.history.loss.length - 1] as number;

            return { success: true, loss: finalLoss };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    },

    // Predecir escenarios de autonomia
    async getScenarios(batteryCapacity: number, soh: number): Promise<PredictionResult> {
        const tfLib = await ensureTensorFlow();

        const scenarios = [
            { name: 'Ciudad', speed: 30, temp: 20 },
            { name: 'Mixto', speed: 50, temp: 20 },
            { name: 'Autopista', speed: 120, temp: 20 },
            { name: 'Frio extremo', speed: 50, temp: -10 },
            { name: 'Calor extremo', speed: 50, temp: 40 }
        ];

        const usableCapacity = batteryCapacity * (soh / 100);

        // Si no hay modelo, usar estimaciones basicas
        if (!model) {
            return {
                scenarios: scenarios.map(s => ({
                    name: s.name,
                    speed: s.speed,
                    efficiency: s.speed < 40 ? 140 : s.speed < 80 ? 160 : 200,
                    range: Math.round(usableCapacity / (s.speed < 40 ? 0.14 : s.speed < 80 ? 0.16 : 0.20))
                })),
                loss: 0
            };
        }

        const results = scenarios.map(s => {
            const input = tfLib.tensor2d([[s.speed, 50, 0, s.temp]]);
            const prediction = model.predict(input) as any;
            const efficiency = prediction.dataSync()[0];
            input.dispose();
            prediction.dispose();

            return {
                name: s.name,
                speed: s.speed,
                efficiency: Math.round(efficiency),
                range: Math.round(usableCapacity / (efficiency / 1000))
            };
        });

        return { scenarios: results, loss: 0 };
    },

    // Entrenar modelo de parking (prediccion de salida)
    async trainParking(trips: any[]): Promise<TrainResult> {
        try {
            const tfLib = await ensureTensorFlow();

            const valid = trips.filter(t => t.start_timestamp && t.end_timestamp);
            if (valid.length < 5) {
                return { success: false, error: 'Insufficient parking data' };
            }

            // Extraer patrones de estacionamiento
            const patterns = valid.map(t => {
                const start = new Date(t.start_timestamp * 1000);
                return {
                    dayOfWeek: start.getDay(),
                    hour: start.getHours(),
                    duration: (t.end_timestamp - t.start_timestamp) / 3600
                };
            });

            const xs = patterns.map(p => [p.dayOfWeek / 6, p.hour / 23]);
            const ys = patterns.map(p => Math.min(p.duration, 24) / 24);

            const xTensor = tfLib.tensor2d(xs);
            const yTensor = tfLib.tensor1d(ys);

            parkingModel = tfLib.sequential({
                layers: [
                    tfLib.layers.dense({ units: 8, activation: 'relu', inputShape: [2] }),
                    tfLib.layers.dense({ units: 1, activation: 'sigmoid' })
                ]
            });

            parkingModel.compile({
                optimizer: tfLib.train.adam(0.01),
                loss: 'meanSquaredError'
            });

            await parkingModel.fit(xTensor, yTensor, { epochs: 30, verbose: 0 });

            xTensor.dispose();
            yTensor.dispose();

            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    },

    // Predecir duracion de estacionamiento
    async predictDeparture(startTime: number): Promise<{ departureTime: number; duration: number } | null> {
        if (!parkingModel) return null;

        const tfLib = await ensureTensorFlow();
        const date = new Date(startTime);
        const input = tfLib.tensor2d([[date.getDay() / 6, date.getHours() / 23]]);
        const prediction = parkingModel.predict(input) as any;
        const normalizedDuration = prediction.dataSync()[0];
        input.dispose();
        prediction.dispose();

        const duration = normalizedDuration * 24; // Denormalizar
        return {
            departureTime: startTime + duration * 3600 * 1000,
            duration
        };
    },

    // Entrenar modelo de SoH
    async trainSoH(charges: any[], capacity: number): Promise<TrainResult> {
        try {
            const tfLib = await ensureTensorFlow();

            const valid = charges.filter(c =>
                c.energyAdded > 0 &&
                c.socStart !== undefined &&
                c.socEnd !== undefined &&
                c.socEnd > c.socStart
            );

            if (valid.length < 5) {
                return { success: false, error: 'Insufficient charge data' };
            }

            // Calcular SoH por carga
            const dataPoints = valid.map((c, idx) => {
                const socDiff = c.socEnd - c.socStart;
                const theoreticalEnergy = (socDiff / 100) * capacity;
                const actualSoH = (c.energyAdded / theoreticalEnergy) * 100;
                return { index: idx, soh: Math.min(actualSoH, 110) };
            });

            const xs = dataPoints.map(d => [d.index / valid.length]);
            const ys = dataPoints.map(d => d.soh / 100);

            const xTensor = tfLib.tensor2d(xs);
            const yTensor = tfLib.tensor1d(ys);

            sohModel = tfLib.sequential({
                layers: [
                    tfLib.layers.dense({ units: 4, activation: 'relu', inputShape: [1] }),
                    tfLib.layers.dense({ units: 1 })
                ]
            });

            sohModel.compile({
                optimizer: tfLib.train.adam(0.005),
                loss: 'meanSquaredError'
            });

            await sohModel.fit(xTensor, yTensor, { epochs: 50, verbose: 0 });

            xTensor.dispose();
            yTensor.dispose();

            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    },

    // Obtener SoH actual
    async getSoH(charges: any[], capacity: number): Promise<number | null> {
        if (!sohModel || charges.length < 5) return null;

        const tfLib = await ensureTensorFlow();
        const input = tfLib.tensor2d([[1.0]]); // Prediccion para "ahora"
        const prediction = sohModel.predict(input) as any;
        const soh = prediction.dataSync()[0] * 100;
        input.dispose();
        prediction.dispose();

        return Math.round(soh * 10) / 10;
    },

    // Liberar memoria
    async dispose(): Promise<void> {
        if (model) { model.dispose(); model = null; }
        if (parkingModel) { parkingModel.dispose(); parkingModel = null; }
        if (sohModel) { sohModel.dispose(); sohModel = null; }
    }
};

Comlink.expose(api);

export type TensorFlowWorkerApi = typeof api;
```

**Verificacion:**
- [ ] Archivo creado sin errores de TypeScript
- [ ] Worker se puede instanciar desde main thread

---

### Tarea 1.3: Actualizar dataWorker.ts para usar TensorFlow Worker

**Archivo:** `src/workers/dataWorker.ts`

**Reemplazar el contenido completo con:**

```typescript
// BYD Stats - Data Processing Worker (v21 - TensorFlow Isolated)
import * as Comlink from 'comlink';
import { processData } from '../core/dataProcessing';
import type { Trip, Settings, Charge } from '../types';

// TensorFlow Worker (lazy loaded, isolated)
let tfWorker: Comlink.Remote<import('./tensorflowWorker').TensorFlowWorkerApi> | null = null;

async function getTfWorker() {
    if (!tfWorker) {
        const worker = new Worker(
            new URL('./tensorflowWorker.ts', import.meta.url),
            { type: 'module' }
        );
        tfWorker = Comlink.wrap(worker);
    }
    return tfWorker;
}

/**
 * Smart Charging Windows - Uses AI predictions
 */
async function findSmartChargingWindows(
    trips: Trip[],
    settings: Settings
): Promise<{
    windows: { day: string; start: string; end: string; tariffLimit: string; startMins: number; endMins: number }[];
    weeklyKwh: number;
    requiredHours: number;
    hoursFound: number;
    note?: string;
}> {
    const tf = await getTfWorker();

    // Train parking model if needed
    if (trips.length > 5) {
        await tf.trainParking(trips);
    }

    // 1. Calculate Weekly Needs
    let totalKwh = 0;
    let daysActive = 30;

    if (trips && trips.length > 0) {
        const tripsWithElectricity = trips.map(t => {
            if (t.electricity) return t;
            if (t.start_soc && t.end_soc && settings?.batterySize) {
                const batterySize = typeof settings.batterySize === 'number'
                    ? settings.batterySize
                    : parseFloat(settings.batterySize as string);
                const socDiff = t.start_soc - t.end_soc;
                return { ...t, electricity: (socDiff / 100) * batterySize };
            }
            return t;
        });

        const valid = tripsWithElectricity.filter(t => t.start_timestamp && t.electricity);
        totalKwh = valid.reduce((sum, t) => sum + (t.electricity || 0), 0);

        if (valid.length > 0) {
            const sorted = [...valid].sort((a, b) => (a.start_timestamp || 0) - (b.start_timestamp || 0));
            const first = sorted[0].start_timestamp! * 1000;
            const lastTrip = sorted[sorted.length - 1];
            const last = (lastTrip.end_timestamp || lastTrip.start_timestamp!) * 1000;
            daysActive = Math.max(1, (last - first) / (1000 * 3600 * 24));
        }
    }

    const avgWeekly = (totalKwh / Math.max(1, daysActive)) * 7;
    const targetKwh = avgWeekly * 1.1;

    let chargePower = 3.6;
    if (settings?.homeChargerRating) {
        chargePower = (settings.homeChargerRating * 230) / 1000;
    }

    const requiredHours = targetKwh / chargePower;
    const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const now = new Date();
    const startOfWeek = new Date(now);
    const currentDay = now.getDay();
    const distToMon = (1 + 7 - currentDay) % 7;
    startOfWeek.setDate(now.getDate() + distToMon);
    startOfWeek.setHours(0, 0, 0, 0);

    const isWeekendTariff = (dIndex: number) => dIndex === 0 || dIndex === 6;

    // 2. Discover charging windows using AI
    const candidates: {
        day: string;
        dayIndex: number;
        startMins: number;
        endMins: number;
        duration: number;
        score: number;
    }[] = [];

    for (let d = 0; d < 7; d++) {
        const jsDayIndex = (1 + d) % 7;
        const dayName = days[jsDayIndex];

        for (let h = 0; h < 24; h += 3) {
            const simDate = new Date(startOfWeek);
            simDate.setDate(simDate.getDate() + d);
            simDate.setHours(h, 0, 0, 0);

            const prediction = await tf.predictDeparture(simDate.getTime());
            if (!prediction || prediction.duration < 1.5) continue;

            const naturalStartMins = h * 60;
            const naturalDurationMins = prediction.duration * 60;

            let tStart = 0, tEnd = 8 * 60;
            if (isWeekendTariff(jsDayIndex)) tEnd = 24 * 60;

            const wStart = Math.max(naturalStartMins, tStart);
            const wEnd = Math.min(naturalStartMins + naturalDurationMins, tEnd);

            if (wEnd > wStart + 30) {
                candidates.push({
                    day: dayName,
                    dayIndex: jsDayIndex,
                    startMins: wStart,
                    endMins: wEnd,
                    duration: (wEnd - wStart) / 60,
                    score: (wEnd - wStart) / 60 * (isWeekendTariff(jsDayIndex) ? 2.0 : 0.5)
                });
            }
        }
    }

    // 3. Select best windows
    candidates.sort((a, b) => b.score - a.score);
    const selected: typeof candidates = [];
    let gatheredKwh = 0;

    while (gatheredKwh < targetKwh && candidates.length > 0) {
        const best = candidates.shift();
        if (!best) break;

        const hasOverlap = selected.some(s =>
            s.dayIndex === best.dayIndex &&
            Math.max(s.startMins, best.startMins) < Math.min(s.endMins, best.endMins)
        );
        if (hasOverlap) continue;

        selected.push(best);
        gatheredKwh += best.duration * chargePower;
    }

    // 4. Format output
    const formatTime = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = Math.floor(mins % 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    return {
        windows: selected.map(s => ({
            day: s.day,
            start: formatTime(s.startMins),
            end: formatTime(s.endMins),
            tariffLimit: isWeekendTariff(s.dayIndex) ? '23:59' : '08:00',
            startMins: s.startMins,
            endMins: s.endMins
        })),
        weeklyKwh: targetKwh,
        requiredHours,
        hoursFound: selected.reduce((acc, s) => acc + s.duration, 0)
    };
}

const api = {
    // Data processing (sync, runs in worker)
    processData,

    // AI Methods - delegated to TensorFlow worker
    async trainModel(trips: Trip[]) {
        const tf = await getTfWorker();
        return tf.trainEfficiency(trips);
    },

    async getScenarios(batteryCapacity: number, soh: number) {
        const tf = await getTfWorker();
        return tf.getScenarios(batteryCapacity, soh);
    },

    async trainSoH(charges: Charge[], capacity: number) {
        const tf = await getTfWorker();
        return tf.trainSoH(charges, capacity);
    },

    async getSoH(charges: Charge[], capacity: number) {
        const tf = await getTfWorker();
        return tf.getSoH(charges, capacity);
    },

    async trainParking(trips: Trip[]) {
        const tf = await getTfWorker();
        return tf.trainParking(trips);
    },

    async predictDeparture(startTime: number) {
        const tf = await getTfWorker();
        return tf.predictDeparture(startTime);
    },

    findSmartChargingWindows,

    async dispose() {
        if (tfWorker) {
            await tfWorker.dispose();
        }
    }
};

Comlink.expose(api);

export type DataWorkerApi = typeof api;
```

**Verificacion:**
- [ ] `npm run build` compila sin errores
- [ ] Webpack/Vite genera `tensorflowWorker-[hash].js` como chunk separado
- [ ] El chunk principal NO incluye TensorFlow

---

### Tarea 1.4: Eliminar PredictiveService del Bundle Principal

**Archivo:** `src/services/PredictiveService.ts`

Este archivo ya no se necesita directamente en el main thread. Toda la logica de AI ahora vive en los workers.

**Opcion A (Recomendada): Convertir a wrapper ligero**

Reemplazar el contenido completo con:

```typescript
// PredictiveService - Thin wrapper over Web Worker
// All heavy TensorFlow logic now lives in workers/tensorflowWorker.ts

import * as Comlink from 'comlink';
import type { DataWorkerApi } from '@/workers/dataWorker';

let worker: Comlink.Remote<DataWorkerApi> | null = null;

function getWorker(): Comlink.Remote<DataWorkerApi> {
    if (!worker) {
        const w = new Worker(
            new URL('../workers/dataWorker.ts', import.meta.url),
            { type: 'module' }
        );
        worker = Comlink.wrap<DataWorkerApi>(w);
    }
    return worker;
}

/**
 * PredictiveService - Public API
 * Delegates all work to Web Workers to keep main thread free
 */
export class PredictiveService {
    async train(trips: any[]) {
        return getWorker().trainModel(trips);
    }

    async getScenarios(batteryCapacity: number, soh: number) {
        return getWorker().getScenarios(batteryCapacity, soh);
    }

    async trainSoH(charges: any[], capacity: number) {
        return getWorker().trainSoH(charges, capacity);
    }

    async getSoHDataPoints(charges: any[], capacity: number) {
        // Return data points for visualization
        const soh = await getWorker().getSoH(charges, capacity);
        return {
            points: charges.slice(-20).map((c, i) => ({ x: i, y: c.socEnd || 0 })),
            trend: [{ x: 0, y: soh || 100 }, { x: 1, y: soh || 100 }]
        };
    }

    async trainParking(trips: any[]) {
        return getWorker().trainParking(trips);
    }

    predictDeparture(startTime: number) {
        // Sync wrapper for compatibility - returns promise
        return getWorker().predictDeparture(startTime);
    }
}

// Singleton export for backwards compatibility
export const predictiveService = new PredictiveService();
```

**Verificacion:**
- [ ] El archivo ahora tiene < 60 lineas
- [ ] No importa `@tensorflow/tfjs`
- [ ] `npm run build` - el chunk de PredictiveService es < 5KB

---

## SPRINT 2: Integracion de Web Workers

**Prioridad:** ALTA
**Tiempo estimado:** 2-3 horas
**Impacto esperado:** UI mas fluida, procesamiento en background

### Tarea 2.1: Crear hook useDataWorker

**Crear archivo:** `src/hooks/useDataWorker.ts`

```typescript
import { useRef, useCallback, useEffect } from 'react';
import * as Comlink from 'comlink';
import type { DataWorkerApi } from '@/workers/dataWorker';

let sharedWorker: Comlink.Remote<DataWorkerApi> | null = null;
let workerRefCount = 0;

function getSharedWorker(): Comlink.Remote<DataWorkerApi> {
    if (!sharedWorker) {
        const worker = new Worker(
            new URL('../workers/dataWorker.ts', import.meta.url),
            { type: 'module' }
        );
        sharedWorker = Comlink.wrap<DataWorkerApi>(worker);
    }
    workerRefCount++;
    return sharedWorker;
}

function releaseSharedWorker() {
    workerRefCount--;
    if (workerRefCount === 0 && sharedWorker) {
        sharedWorker.dispose();
        sharedWorker = null;
    }
}

export function useDataWorker() {
    const workerRef = useRef<Comlink.Remote<DataWorkerApi> | null>(null);

    useEffect(() => {
        workerRef.current = getSharedWorker();
        return () => {
            releaseSharedWorker();
        };
    }, []);

    const processData = useCallback(async (trips: any[], settings: any, charges: any[]) => {
        if (!workerRef.current) return null;
        return workerRef.current.processData(trips, settings, charges);
    }, []);

    const trainModel = useCallback(async (trips: any[]) => {
        if (!workerRef.current) return null;
        return workerRef.current.trainModel(trips);
    }, []);

    const getScenarios = useCallback(async (batteryCapacity: number, soh: number) => {
        if (!workerRef.current) return null;
        return workerRef.current.getScenarios(batteryCapacity, soh);
    }, []);

    const trainSoH = useCallback(async (charges: any[], capacity: number) => {
        if (!workerRef.current) return null;
        return workerRef.current.trainSoH(charges, capacity);
    }, []);

    const getSoH = useCallback(async (charges: any[], capacity: number) => {
        if (!workerRef.current) return null;
        return workerRef.current.getSoH(charges, capacity);
    }, []);

    const findSmartChargingWindows = useCallback(async (trips: any[], settings: any) => {
        if (!workerRef.current) return null;
        return workerRef.current.findSmartChargingWindows(trips, settings);
    }, []);

    const predictDeparture = useCallback(async (startTime: number) => {
        if (!workerRef.current) return null;
        return workerRef.current.predictDeparture(startTime);
    }, []);

    return {
        processData,
        trainModel,
        getScenarios,
        trainSoH,
        getSoH,
        findSmartChargingWindows,
        predictDeparture,
        isReady: !!workerRef.current
    };
}
```

**Verificacion:**
- [ ] Hook creado sin errores TypeScript
- [ ] Se puede importar desde cualquier componente

---

### Tarea 2.2: Integrar useDataWorker en TripsProvider

**Archivo:** `src/providers/TripsProvider.tsx`

**Buscar el import de PredictiveService (aproximadamente linea 1-20):**
```typescript
import { PredictiveService } from '@/services/PredictiveService';
```

**Agregar import del hook:**
```typescript
import { useDataWorker } from '@/hooks/useDataWorker';
```

**Buscar donde se instancia PredictiveService:**
```typescript
const predictiveService = useMemo(() => new PredictiveService(), []);
```

**Reemplazar con:**
```typescript
const worker = useDataWorker();
```

**Buscar llamadas a predictiveService y reemplazar:**

| Buscar | Reemplazar con |
|--------|----------------|
| `predictiveService.train(trips)` | `worker.trainModel(trips)` |
| `predictiveService.getScenarios(...)` | `worker.getScenarios(...)` |
| `predictiveService.trainSoH(...)` | `worker.trainSoH(...)` |
| `predictiveService.predictDeparture(...)` | `worker.predictDeparture(...)` |

**Verificacion:**
- [ ] TripsProvider compila sin errores
- [ ] AI features siguen funcionando
- [ ] Console muestra `[TF Worker] TensorFlow loaded` al usar AI

---

## SPRINT 3: Cache y Optimizacion de Red

**Prioridad:** ALTA
**Tiempo estimado:** 2-3 horas
**Impacto esperado:** -80% requests redundantes

### Tarea 3.1: Implementar Cache para Google Drive

**Archivo:** `src/services/googleDrive.ts`

**Agregar al inicio del archivo (despues de imports):**

```typescript
// ============================================
// CACHE SYSTEM
// ============================================
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    etag?: string;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 30000; // 30 seconds
const CACHE_TTL_LONG = 300000; // 5 minutes for infrequently changed data

function getCached<T>(key: string, ttl = CACHE_TTL): T | null {
    const entry = cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > ttl) {
        cache.delete(key);
        return null;
    }

    return entry.data as T;
}

function setCache<T>(key: string, data: T, etag?: string): void {
    cache.set(key, { data, timestamp: Date.now(), etag });
}

function invalidateCache(pattern?: string): void {
    if (!pattern) {
        cache.clear();
        return;
    }

    for (const key of cache.keys()) {
        if (key.includes(pattern)) {
            cache.delete(key);
        }
    }
}

// Export for manual cache control
export { invalidateCache };
```

**Buscar la funcion `listFiles` y modificar:**

```typescript
export async function listFiles(
    folderId?: string,
    options?: { forceRefresh?: boolean }
): Promise<DriveFile[]> {
    const cacheKey = `listFiles:${folderId || 'root'}`;

    // Check cache first (unless force refresh)
    if (!options?.forceRefresh) {
        const cached = getCached<DriveFile[]>(cacheKey);
        if (cached) {
            console.log('[GoogleDrive] Cache hit:', cacheKey);
            return cached;
        }
    }

    // ... resto de la implementacion existente ...

    // Antes de retornar, guardar en cache:
    setCache(cacheKey, files);
    return files;
}
```

**Buscar funciones de escritura y agregar invalidacion:**

En funciones como `uploadFile`, `updateFile`, `deleteFile`, agregar:
```typescript
// Al final de la funcion, antes del return:
invalidateCache('listFiles');
```

**Verificacion:**
- [ ] Abrir sync modal 5 veces seguidas: solo 1 request a Google API (ver Network tab)
- [ ] Despues de subir archivo, la lista se refresca correctamente
- [ ] Esperar 31 segundos, reabrir: nuevo request (cache expirado)

---

### Tarea 3.2: Implementar Batching para localStorage

**Archivo:** `src/hooks/useLocalStorage.ts`

**Agregar al inicio del archivo:**

```typescript
// ============================================
// BATCHED WRITE SYSTEM
// ============================================
type QueuedWrite = {
    value: unknown;
    timeout: ReturnType<typeof setTimeout>;
};

const writeQueue = new Map<string, QueuedWrite>();
const BATCH_DELAY = 150; // ms

function batchedWrite(key: string, value: unknown): void {
    // Cancel pending write for this key
    const pending = writeQueue.get(key);
    if (pending) {
        clearTimeout(pending.timeout);
    }

    // Schedule new write
    const timeout = setTimeout(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            console.log('[LocalStorage] Batched write:', key);
        } catch (e) {
            console.error('[LocalStorage] Write failed:', key, e);
        }
        writeQueue.delete(key);
    }, BATCH_DELAY);

    writeQueue.set(key, { value, timeout });
}

function flushWrites(): void {
    writeQueue.forEach((entry, key) => {
        clearTimeout(entry.timeout);
        try {
            localStorage.setItem(key, JSON.stringify(entry.value));
        } catch (e) {
            console.error('[LocalStorage] Flush failed:', key, e);
        }
    });
    writeQueue.clear();
}

// Flush on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushWrites);
}
```

**Buscar donde se usa `localStorage.setItem` en el hook y reemplazar:**

```typescript
// Antes:
localStorage.setItem(key, JSON.stringify(value));

// Despues:
batchedWrite(key, value);
```

**Verificacion:**
- [ ] Importar 100 trips: localStorage se escribe 1 vez (no 100)
- [ ] DevTools > Application > Local Storage muestra datos correctos
- [ ] Al cerrar pestana, datos persisten (flush funciona)

---

## SPRINT 4: Paginacion Firestore

**Prioridad:** ALTA
**Tiempo estimado:** 3-4 horas
**Impacto esperado:** -90% Firestore reads iniciales

### Tarea 4.1: Crear funcion de paginacion

**Archivo:** `src/services/firebase.ts`

**Agregar imports (si no existen):**
```typescript
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getDocs,
    onSnapshot,
    DocumentSnapshot
} from 'firebase/firestore';
```

**Agregar constantes:**
```typescript
const INITIAL_LIMIT = 50;
const PAGE_SIZE = 50;
```

**Agregar nueva funcion:**
```typescript
/**
 * Fetch trips with pagination
 * Returns trips, cursor for next page, and hasMore flag
 */
export async function fetchTripsPage(
    userId: string,
    lastDoc?: DocumentSnapshot,
    pageSize = PAGE_SIZE
): Promise<{
    trips: Trip[];
    lastDoc: DocumentSnapshot | null;
    hasMore: boolean
}> {
    let q = query(
        collection(db, 'trips'),
        where('userId', '==', userId),
        where('status', '==', 'completed'),
        orderBy('startDate', 'desc'),
        limit(pageSize + 1) // +1 to detect if more pages exist
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

    const newLastDoc = docs.length > 0 ? docs[Math.min(docs.length - 1, pageSize - 1)] : null;

    return { trips, lastDoc: newLastDoc, hasMore };
}
```

**Modificar `subscribeToTrips` (si existe):**

```typescript
export function subscribeToTrips(
    userId: string,
    callback: (trips: Trip[]) => void,
    initialLimit = INITIAL_LIMIT
) {
    const q = query(
        collection(db, 'trips'),
        where('userId', '==', userId),
        where('status', '==', 'completed'),
        orderBy('startDate', 'desc'),
        limit(initialLimit)
    );

    return onSnapshot(q, (snapshot) => {
        const trips = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Trip));
        callback(trips);
    });
}
```

**Verificacion:**
- [ ] Al cargar app, solo 50 trips se descargan (ver Network tab)
- [ ] Firebase Console > Usage muestra menos reads

---

### Tarea 4.2: Crear hook usePaginatedTrips

**Crear archivo:** `src/hooks/usePaginatedTrips.ts`

```typescript
import { useState, useCallback, useRef } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';
import { fetchTripsPage } from '@/services/firebase';
import { Trip } from '@/types';

interface UsePaginatedTripsResult {
    trips: Trip[];
    isLoading: boolean;
    hasMore: boolean;
    loadMore: () => Promise<void>;
    refresh: () => Promise<void>;
    error: Error | null;
}

export function usePaginatedTrips(userId: string | null): UsePaginatedTripsResult {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const lastDocRef = useRef<DocumentSnapshot | null>(null);

    const loadMore = useCallback(async () => {
        if (!userId || isLoading || !hasMore) return;

        setIsLoading(true);
        setError(null);

        try {
            const result = await fetchTripsPage(
                userId,
                lastDocRef.current || undefined
            );

            setTrips(prev => [...prev, ...result.trips]);
            lastDocRef.current = result.lastDoc;
            setHasMore(result.hasMore);
        } catch (e) {
            setError(e as Error);
            console.error('[usePaginatedTrips] Error:', e);
        } finally {
            setIsLoading(false);
        }
    }, [userId, isLoading, hasMore]);

    const refresh = useCallback(async () => {
        if (!userId) return;

        setIsLoading(true);
        setError(null);
        lastDocRef.current = null;

        try {
            const result = await fetchTripsPage(userId);
            setTrips(result.trips);
            lastDocRef.current = result.lastDoc;
            setHasMore(result.hasMore);
        } catch (e) {
            setError(e as Error);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    return { trips, isLoading, hasMore, loadMore, refresh, error };
}
```

**Verificacion:**
- [ ] Hook creado sin errores
- [ ] Se puede usar en componentes de lista

---

### Tarea 4.3: Integrar paginacion en VirtualizedTripList

**Archivo:** `src/components/lists/VirtualizedTripList.tsx`

**Buscar el componente y agregar detector de scroll al final:**

```typescript
// Agregar import
import { useEffect, useRef } from 'react';

// Dentro del componente, agregar:
interface VirtualizedTripListProps {
    // ... props existentes ...
    onLoadMore?: () => void;
    hasMore?: boolean;
    isLoadingMore?: boolean;
}

// Agregar logica de infinite scroll:
const loadMoreRef = useRef<HTMLDivElement>(null);

useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
        (entries) => {
            if (entries[0].isIntersecting) {
                onLoadMore();
            }
        },
        { rootMargin: '200px' }
    );

    if (loadMoreRef.current) {
        observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
}, [onLoadMore, hasMore, isLoadingMore]);

// En el JSX, al final de la lista:
{hasMore && (
    <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
        {isLoadingMore ? (
            <span className="text-sm text-gray-500">Cargando mas...</span>
        ) : null}
    </div>
)}
```

**Verificacion:**
- [ ] Al hacer scroll hasta el final, se cargan mas trips automaticamente
- [ ] Indicador de carga visible mientras carga

---

## SPRINT 5: TypeScript Strictness

**Prioridad:** MEDIA
**Tiempo estimado:** 4-6 horas
**Impacto esperado:** Mejor mantenibilidad, menos bugs

### Tarea 5.1: Crear tipos para Worker API

**Crear archivo:** `src/types/workers.ts`

```typescript
// Worker API Types - Eliminates 'any' in worker communication

export interface TrainResult {
    success: boolean;
    loss?: number;
    error?: string;
}

export interface RangeScenario {
    name: string;
    speed: number;
    efficiency: number;
    range: number;
}

export interface PredictionResult {
    scenarios: RangeScenario[];
    loss: number;
}

export interface DeparturePrediction {
    departureTime: number;
    duration: number;
}

export interface SmartChargingWindow {
    day: string;
    start: string;
    end: string;
    tariffLimit: string;
    startMins: number;
    endMins: number;
}

export interface SmartChargingResult {
    windows: SmartChargingWindow[];
    weeklyKwh: number;
    requiredHours: number;
    hoursFound: number;
    note?: string;
}

export interface SoHStats {
    points: Array<{ x: number; y: number }>;
    trend: Array<{ x: number; y: number }>;
}
```

**Actualizar `src/types/index.ts`:**
```typescript
// Agregar al final:
export * from './workers';
```

**Verificacion:**
- [ ] Tipos exportados correctamente
- [ ] Se pueden importar desde `@/types`

---

### Tarea 5.2: Eliminar `any` en DataProvider

**Archivo:** `src/providers/DataProvider.tsx`

**Buscar y reemplazar estos tipos `any`:**

| Linea aprox | Buscar | Reemplazar con |
|-------------|--------|----------------|
| 23 | `googleSync: any` | `googleSync: GoogleSyncState` |
| 24 | `database: any` | `database: DatabaseState` |
| 28 | `fileHandling: any` | `fileHandling: FileHandlingState` |
| 50 | `aiSoHStats: { points: any[]; trend: any[] }` | `aiSoHStats: SoHStats \| null` |
| 52 | `findSmartChargingWindows: (...) => Promise<any>` | `findSmartChargingWindows: (...) => Promise<SmartChargingResult>` |
| 71 | `confirmModalState: any` | `confirmModalState: ConfirmModalState` |
| 79-82 | Funciones de charges con `any` | Tipos especificos de Charge |

**Crear interfaces faltantes en el mismo archivo o en types:**

```typescript
interface GoogleSyncState {
    isConnected: boolean;
    isSyncing: boolean;
    lastSync: Date | null;
    error: Error | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    sync: () => Promise<void>;
}

interface DatabaseState {
    isLoaded: boolean;
    isLoading: boolean;
    error: Error | null;
}

interface FileHandlingState {
    isProcessing: boolean;
    progress: number;
    error: Error | null;
}

interface ConfirmModalState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
    isDangerous: boolean;
}
```

**Verificacion:**
- [ ] `npx tsc --noEmit` no muestra errores de tipo
- [ ] DataProvider.tsx no tiene ningun `any`

---

### Tarea 5.3: Script para detectar archivos con `any`

**Crear archivo:** `scripts/check-any.sh` (o `.ps1` para Windows)

```bash
#!/bin/bash
# Detectar archivos con tipo 'any'

echo "=== Archivos con tipo 'any' ==="
grep -r ": any" src --include="*.ts" --include="*.tsx" -l | while read file; do
    count=$(grep -c ": any" "$file")
    echo "$file: $count ocurrencias"
done

echo ""
echo "=== Total ==="
grep -r ": any" src --include="*.ts" --include="*.tsx" -c | grep -v ":0$" | wc -l
echo "archivos"
```

**Verificacion:**
- [ ] Script ejecutable
- [ ] Objetivo: reducir de 51 a < 10 archivos

---

## SPRINT 6: Deploy de Indices Firestore

**Prioridad:** MEDIA
**Tiempo estimado:** 30 minutos
**Impacto esperado:** Queries mas rapidas

### Tarea 6.1: Crear/Actualizar firestore.indexes.json

**Archivo:** `firestore.indexes.json` (raiz del proyecto)

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
      "collectionGroup": "trips",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "startDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "chargeSessions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "startTime", "order": "DESCENDING" }
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
  ],
  "fieldOverrides": []
}
```

### Tarea 6.2: Desplegar indices

**Comando:**
```bash
firebase deploy --only firestore:indexes
```

**Verificacion:**
- [ ] Firebase Console > Firestore > Indexes muestra los indices
- [ ] Estado de cada indice es "Enabled"
- [ ] Queries complejas no muestran warning en consola

---

## Metricas de Exito v3

| Metrica | Actual | Objetivo v3 | Verificacion |
|---------|--------|-------------|--------------|
| Bundle size (gzip) | 781KB | < 450KB | `npm run build` |
| Chunk TensorFlow | 222KB (main) | < 5KB (lazy) | Build output |
| Archivos con `any` | 51 | < 10 | `grep -r ": any" src` |
| Lighthouse Performance | ~65 | > 85 | Chrome DevTools |
| TTI | ~4.5s | < 2.5s | Lighthouse |
| Firestore reads inicial | 500 | 50 | Firebase Console |
| Cache hit rate | 0% | > 80% | Console logs |

---

## Comandos Utiles

```bash
# Build y analizar bundle
npm run build
npx vite-bundle-visualizer

# Verificar tipos
npx tsc --noEmit

# Buscar archivos con 'any'
grep -r ": any" src --include="*.ts" --include="*.tsx" -l | wc -l

# Deploy Firestore
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes

# Limpiar cache de build
rm -rf node_modules/.vite dist
```

---

## Orden de Implementacion Recomendado

1. **Sprint 1** - TensorFlow isolation (CRITICO - mayor impacto)
2. **Sprint 2** - Worker integration
3. **Sprint 3** - Cache/Batching
4. **Sprint 4** - Firestore pagination
5. **Sprint 5** - TypeScript cleanup
6. **Sprint 6** - Firestore indexes

---

## Notas para el LLM Implementador

1. **Antes de cada cambio:** Lee el archivo completo para entender el contexto
2. **Despues de cada Sprint:** Ejecuta `npm run build` para verificar
3. **Si hay errores de tipo:** Revisa imports y asegurate de que los tipos estan exportados
4. **Workers en Vite:** Los workers se importan con `new URL('./worker.ts', import.meta.url)`
5. **No eliminar sql.js:** Es critico para la funcionalidad offline de importacion DB

---

## Historial de Cambios

| Fecha | Version | Cambios |
|-------|---------|---------|
| 2026-02-10 | 3.0 | Nueva version basada en auditoria post-v2 |
| 2026-02-10 | 2.0 | Implementacion parcial |
| 2026-02-09 | 1.0 | Version inicial |

---

*Documento autocontenido para continuidad entre sesiones LLM.*
*Optimizado para: Claude, Gemini 2.5 Pro, GPT-4*
*Ultima actualizacion: 2026-02-10*
