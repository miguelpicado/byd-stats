# BYD Stats - Plan de Optimizacion v4

> **INSTRUCCIONES PARA LLM:** Este documento es autocontenido. Contiene todo el contexto necesario para implementar las optimizaciones sin necesidad de explorar el codigo previamente. Cada tarea incluye: archivo exacto, problema detectado, solucion propuesta con codigo, y criterios de verificacion. Sigue las tareas en orden de sprint y prioridad.

> **IMPORTANTE - VALORES DE CALIBRACION AI:** Los siguientes valores fueron calibrados empiricamente para vehiculos BYD y NO DEBEN MODIFICARSE sin evidencia empirica:
> - EfficiencyModel: City=14.5, Mixed=17.5, Highway=23.5 kWh/100km
> - SoHModel: Blending hibrido con mediana estadistica
> - ParkingModel: Deteccion de patrones weekend, filtros 15min-14dias

---

## Contexto del Proyecto

**Nombre:** BYD Stats
**Tipo:** Aplicacion web React/TypeScript para estadisticas de vehiculos electricos BYD
**Plataformas:** PWA (web) + Android (Capacitor)

**Stack tecnologico:**
- Frontend: React 18 + TypeScript + Vite
- Estado: React Context API (5 providers especializados)
- Backend: Firebase Firestore + Cloud Functions
- Sincronizacion: Google Drive API
- UI: Tailwind CSS + Headless UI
- Listas: @tanstack/react-virtual (virtualizacion)
- Validacion: Zod schemas
- Workers: Comlink (dataWorker + tensorflowWorker)
- AI/ML: TensorFlow.js (aislado en worker)

**Estructura de carpetas:**
```
src/
├── components/          (66 archivos)
│   ├── cards/          # TripCard, ChargeCard, StatCard (memoizados)
│   ├── modals/         # 27 modales (lazy loaded)
│   ├── lists/          # VirtualizedTripList, VirtualizedChargeList
│   ├── settings/       # SmartcarSettings, ChargingSettings, etc.
│   ├── layout/         # MainLayout, BottomNavigation, DesktopSidebar
│   └── common/         # ModalContainer, ErrorBoundary, ModalCoordinator
├── context/
│   ├── AppContext.tsx  # Settings globales (memoizado)
│   ├── CarContext.tsx  # Gestion multi-vehiculo (memoizado)
│   └── LayoutContext.tsx # Responsive layout detection
├── providers/
│   ├── DataProvider.tsx    # Compositor de providers
│   ├── TripsProvider.tsx   # Trips + AI predictions
│   ├── ChargesProvider.tsx # Cargas electricas/combustible
│   ├── FilterProvider.tsx  # Filtros de datos
│   ├── ModalProvider.tsx   # Estado de 25+ modales
│   └── SyncProvider.tsx    # Google Drive sync
├── hooks/
│   ├── useAppData.ts       # Facade hook (40+ propiedades)
│   ├── useProcessedData.ts # AI processing + worker management
│   ├── useModalState.ts    # 25+ modal flags
│   ├── useDatabase.ts      # SQL.js operations
│   ├── useLocalStorage.ts  # Batched localStorage (150ms)
│   └── sync/
│       ├── useGoogleAuth.ts
│       ├── useCloudRegistry.ts
│       └── useDriveSync.ts
├── services/
│   ├── firebase.ts
│   ├── googleDrive.ts      # Drive API + merge logic
│   ├── PredictiveService.ts # Thin wrapper to workers
│   └── ai/
│       ├── EfficiencyModel.ts
│       ├── SoHModel.ts
│       └── ParkingModel.ts
├── workers/
│   ├── dataWorker.ts       # Data processing + smart charging
│   └── tensorflowWorker.ts # TensorFlow.js isolated (3 models)
├── core/
│   ├── dataProcessing.ts   # Pure data transformations
│   ├── batteryCalculations.ts
│   ├── formatters.ts
│   ├── dateUtils.ts
│   └── logger.ts           # Centralized logging
└── types/
    └── index.ts            # Trip, Charge, Car, Settings interfaces
```

**Fecha de auditoria:** 2025-02-11
**Version anterior:** v3 (parcialmente implementada)
**Auditor:** Claude Opus 4.5

---

## Resumen del Estado Actual

### Metricas Actuales vs Objetivos

| Metrica | v3 Objetivo | Estado Actual | v4 Objetivo | Mejora Esperada |
|---------|-------------|---------------|-------------|-----------------|
| Bundle size (gzip) | < 450KB | **~450KB** | < 400KB | -10% |
| Archivos con `any`/ts-ignore | < 10 | **~15** | 0 | -100% |
| Test coverage | - | **~4%** | > 60% | +1400% |
| Lighthouse Performance | > 85 | **~75** | > 90 | +20% |
| TTI | < 2.5s | **~3s** | < 2s | -33% |
| console.log en produccion | - | **41** | 0 | -100% |
| Componentes >400 lineas | - | **7** | 0 | -100% |
| Codigo duplicado | - | **~600 lineas** | < 100 | -83% |

### Tareas v3 Completadas
- [x] TensorFlow.js aislado en tensorflowWorker
- [x] dataWorker integrado con Comlink
- [x] 61+ componentes lazy loaded
- [x] Listas virtualizadas (TanStack Virtual)
- [x] Bundle splitting manual (react-vendor, chart-vendor, utils-vendor)
- [x] localStorage batching (150ms debounce)
- [x] Caching de modelos AI en localStorage
- [x] PWA con 74 entries precacheadas

### Tareas v3 NO Completadas (Migradas a v4)
- [ ] Type safety incompleto (15 archivos con escapes)
- [ ] Test coverage critico (4%)
- [ ] Error handling inconsistente
- [ ] Codigo duplicado (~600 lineas)
- [ ] Componentes demasiado grandes (7 >400 lineas)
- [ ] 41 console.log en produccion

---

## Sprints de Optimizacion v4

### Sprint 1: Testing Foundation (Prioridad CRITICA)
**Estimacion:** 3-4 dias
**Mejora esperada:** +50% test coverage, -80% riesgo de regresiones

### Sprint 2: Type Safety Cleanup
**Estimacion:** 2-3 dias
**Mejora esperada:** 0 escapes de tipos, mejor DX

### Sprint 3: Code Quality & DRY
**Estimacion:** 3-4 dias
**Mejora esperada:** -500 lineas duplicadas, mejor mantenibilidad

### Sprint 4: Component Refactoring
**Estimacion:** 2-3 dias
**Mejora esperada:** 0 componentes >400 lineas

### Sprint 5: Error Handling & Logging
**Estimacion:** 2 dias
**Mejora esperada:** 0 console.log, retry logic, errores tipados

### Sprint 6: Performance Fine-tuning
**Estimacion:** 2 dias
**Mejora esperada:** -10% bundle, +15 Lighthouse score

---

## Sprint 1: Testing Foundation

> **Objetivo:** Establecer base de tests para prevenir regresiones y aumentar confianza en deploys.

### Tarea 1.1: Tests para batteryCalculations.ts (EXISTENTE - AMPLIAR)

**Archivo:** `src/core/__tests__/batteryCalculations.test.ts`

**Estado actual:** Tests basicos existen, ampliar cobertura.

**Tests a agregar:**
```typescript
// src/core/__tests__/batteryCalculations.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateConsumption,
  calculateSoH,
  estimateSoCFromKwh,
  calculateDegradation,
  getEfficiencyRating
} from '../batteryCalculations';

describe('batteryCalculations', () => {
  describe('calculateConsumption', () => {
    it('returns 0 for zero distance', () => {
      expect(calculateConsumption(10, 0)).toBe(0);
    });

    it('calculates kWh/100km correctly', () => {
      // 15 kWh for 100km = 15 kWh/100km
      expect(calculateConsumption(15, 100)).toBe(15);
    });

    it('handles decimal values', () => {
      // 7.5 kWh for 50km = 15 kWh/100km
      expect(calculateConsumption(7.5, 50)).toBe(15);
    });

    it('handles negative values gracefully', () => {
      expect(calculateConsumption(-5, 100)).toBe(0);
      expect(calculateConsumption(5, -100)).toBe(0);
    });
  });

  describe('calculateSoH', () => {
    it('returns 100% for new battery', () => {
      expect(calculateSoH(82.56, 82.56)).toBe(100);
    });

    it('calculates degradation correctly', () => {
      // 80 kWh actual vs 82.56 nominal = ~96.9%
      expect(calculateSoH(80, 82.56)).toBeCloseTo(96.9, 1);
    });

    it('caps at 100% for overperforming batteries', () => {
      expect(calculateSoH(85, 82.56)).toBe(100);
    });

    it('handles zero nominal capacity', () => {
      expect(calculateSoH(80, 0)).toBe(0);
    });
  });

  describe('estimateSoCFromKwh', () => {
    it('estimates SoC percentage from kWh charged', () => {
      // 41.28 kWh = 50% of 82.56 kWh battery
      expect(estimateSoCFromKwh(41.28, 82.56)).toBe(50);
    });

    it('caps at 100%', () => {
      expect(estimateSoCFromKwh(100, 82.56)).toBe(100);
    });

    it('handles zero battery size', () => {
      expect(estimateSoCFromKwh(10, 0)).toBe(0);
    });
  });

  describe('getEfficiencyRating', () => {
    it('returns "excellent" for < 14 kWh/100km', () => {
      expect(getEfficiencyRating(13)).toBe('excellent');
    });

    it('returns "good" for 14-17 kWh/100km', () => {
      expect(getEfficiencyRating(15)).toBe('good');
    });

    it('returns "average" for 17-20 kWh/100km', () => {
      expect(getEfficiencyRating(18)).toBe('average');
    });

    it('returns "poor" for > 20 kWh/100km', () => {
      expect(getEfficiencyRating(22)).toBe('poor');
    });
  });
});
```

**Verificacion:**
```bash
npm run test -- src/core/__tests__/batteryCalculations.test.ts
# Debe pasar todos los tests
```

---

### Tarea 1.2: Tests para formatters.ts

**Archivo a crear:** `src/core/__tests__/formatters.test.ts` (ampliar si existe)

**Codigo:**
```typescript
// src/core/__tests__/formatters.test.ts
import { describe, it, expect } from 'vitest';
import {
  formatDistance,
  formatDuration,
  formatEnergy,
  formatEfficiency,
  formatCurrency,
  formatPercentage,
  formatDate,
  formatTime
} from '../formatters';

describe('formatters', () => {
  describe('formatDistance', () => {
    it('formats km with 1 decimal', () => {
      expect(formatDistance(123.456)).toBe('123.5 km');
    });

    it('handles zero', () => {
      expect(formatDistance(0)).toBe('0.0 km');
    });

    it('handles undefined/null', () => {
      expect(formatDistance(undefined)).toBe('-- km');
      expect(formatDistance(null)).toBe('-- km');
    });
  });

  describe('formatDuration', () => {
    it('formats minutes only', () => {
      expect(formatDuration(45)).toBe('45 min');
    });

    it('formats hours and minutes', () => {
      expect(formatDuration(90)).toBe('1h 30min');
    });

    it('formats days for long durations', () => {
      expect(formatDuration(1500)).toBe('1d 1h');
    });

    it('handles zero', () => {
      expect(formatDuration(0)).toBe('0 min');
    });
  });

  describe('formatEnergy', () => {
    it('formats kWh with 2 decimals', () => {
      expect(formatEnergy(15.567)).toBe('15.57 kWh');
    });

    it('handles small values', () => {
      expect(formatEnergy(0.5)).toBe('0.50 kWh');
    });
  });

  describe('formatEfficiency', () => {
    it('formats kWh/100km', () => {
      expect(formatEfficiency(17.5)).toBe('17.5 kWh/100km');
    });
  });

  describe('formatCurrency', () => {
    it('formats EUR by default', () => {
      expect(formatCurrency(10.5)).toMatch(/10[.,]50/);
    });

    it('handles different currencies', () => {
      expect(formatCurrency(10.5, 'USD')).toContain('$');
    });
  });

  describe('formatPercentage', () => {
    it('formats with % symbol', () => {
      expect(formatPercentage(85.5)).toBe('85.5%');
    });

    it('handles 100%', () => {
      expect(formatPercentage(100)).toBe('100%');
    });

    it('handles 0%', () => {
      expect(formatPercentage(0)).toBe('0%');
    });
  });
});
```

**Verificacion:**
```bash
npm run test -- src/core/__tests__/formatters.test.ts
```

---

### Tarea 1.3: Tests para dataProcessing.ts

**Archivo:** `src/core/__tests__/dataProcessing.test.ts` (ampliar)

**Codigo:**
```typescript
// src/core/__tests__/dataProcessing.test.ts
import { describe, it, expect } from 'vitest';
import {
  processTrips,
  calculateStats,
  getTopN,
  isStationaryTrip,
  mergeTrips,
  deduplicateByKey
} from '../dataProcessing';

// Mock data
const mockTrips = [
  { date: '2025-01-01', trip: 50, kwh: 8, start_timestamp: 1704067200 },
  { date: '2025-01-02', trip: 100, kwh: 16, start_timestamp: 1704153600 },
  { date: '2025-01-03', trip: 0.3, kwh: 0.1, start_timestamp: 1704240000 }, // stationary
];

describe('dataProcessing', () => {
  describe('isStationaryTrip', () => {
    it('returns true for trips < 0.5 km', () => {
      expect(isStationaryTrip({ trip: 0.3 })).toBe(true);
      expect(isStationaryTrip({ trip: 0.49 })).toBe(true);
    });

    it('returns false for trips >= 0.5 km', () => {
      expect(isStationaryTrip({ trip: 0.5 })).toBe(false);
      expect(isStationaryTrip({ trip: 10 })).toBe(false);
    });

    it('handles undefined trip', () => {
      expect(isStationaryTrip({})).toBe(true);
    });
  });

  describe('getTopN', () => {
    const items = [
      { value: 5 },
      { value: 2 },
      { value: 8 },
      { value: 1 },
      { value: 9 },
    ];

    it('returns top N items', () => {
      const top3 = getTopN(items, (a, b) => b.value - a.value, 3);
      expect(top3.map(i => i.value)).toEqual([9, 8, 5]);
    });

    it('handles N > array length', () => {
      const top10 = getTopN(items, (a, b) => b.value - a.value, 10);
      expect(top10.length).toBe(5);
    });

    it('handles empty array', () => {
      expect(getTopN([], (a, b) => b - a, 3)).toEqual([]);
    });
  });

  describe('deduplicateByKey', () => {
    const items = [
      { id: 1, name: 'first' },
      { id: 2, name: 'second' },
      { id: 1, name: 'duplicate' },
    ];

    it('removes duplicates keeping first occurrence', () => {
      const result = deduplicateByKey(items, item => item.id);
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('first');
    });

    it('handles empty array', () => {
      expect(deduplicateByKey([], i => i)).toEqual([]);
    });
  });

  describe('calculateStats', () => {
    it('calculates total distance', () => {
      const stats = calculateStats(mockTrips);
      expect(stats.totalDistance).toBe(150.3);
    });

    it('calculates total energy', () => {
      const stats = calculateStats(mockTrips);
      expect(stats.totalEnergy).toBe(24.1);
    });

    it('calculates average efficiency', () => {
      const stats = calculateStats(mockTrips);
      // (8+16+0.1) / (50+100+0.3) * 100 = ~16.04
      expect(stats.avgEfficiency).toBeCloseTo(16.04, 1);
    });

    it('excludes stationary trips from efficiency', () => {
      const stats = calculateStats(mockTrips, { excludeStationary: true });
      // (8+16) / (50+100) * 100 = 16
      expect(stats.avgEfficiency).toBe(16);
    });

    it('handles empty array', () => {
      const stats = calculateStats([]);
      expect(stats.totalDistance).toBe(0);
      expect(stats.totalEnergy).toBe(0);
      expect(stats.avgEfficiency).toBe(0);
    });
  });

  describe('mergeTrips', () => {
    const localTrips = [
      { date: '2025-01-01', trip: 50, start_timestamp: 1000, source: 'local' },
    ];
    const remoteTrips = [
      { date: '2025-01-01', trip: 50, start_timestamp: 1000, source: 'remote' },
      { date: '2025-01-02', trip: 100, start_timestamp: 2000, source: 'remote' },
    ];

    it('merges without duplicates', () => {
      const merged = mergeTrips(localTrips, remoteTrips);
      expect(merged.length).toBe(2);
    });

    it('prefers remote over local for same key', () => {
      const merged = mergeTrips(localTrips, remoteTrips);
      const jan1 = merged.find(t => t.date === '2025-01-01');
      expect(jan1.source).toBe('remote');
    });
  });
});
```

**Verificacion:**
```bash
npm run test -- src/core/__tests__/dataProcessing.test.ts
```

---

### Tarea 1.4: Tests para useLocalStorage hook

**Archivo a crear:** `src/hooks/__tests__/useLocalStorage.test.ts`

**Codigo:**
```typescript
// src/hooks/__tests__/useLocalStorage.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('returns stored value when localStorage has data', () => {
    localStorage.setItem('test-key', JSON.stringify('stored-value'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('stored-value');
  });

  it('updates localStorage when setValue is called', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[1]('new-value');
    });

    // Advance timers to trigger batched write (150ms)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(JSON.parse(localStorage.getItem('test-key')!)).toBe('new-value');
  });

  it('batches multiple writes within 150ms', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 0));
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    act(() => {
      result.current[1](1);
      result.current[1](2);
      result.current[1](3);
    });

    // Before batch delay, no writes should happen
    expect(setItemSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Only one write after batch
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('test-key')!)).toBe(3);

    setItemSpy.mockRestore();
  });

  it('removeValue clears the key', () => {
    localStorage.setItem('test-key', JSON.stringify('value'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    act(() => {
      result.current[2](); // removeValue
    });

    expect(localStorage.getItem('test-key')).toBeNull();
    expect(result.current[0]).toBe('default');
  });

  it('handles JSON parse errors gracefully', () => {
    localStorage.setItem('test-key', 'invalid-json');
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('handles objects correctly', () => {
    const initialObj = { name: 'test', value: 42 };
    const { result } = renderHook(() => useLocalStorage('test-obj', initialObj));

    act(() => {
      result.current[1]({ name: 'updated', value: 100 });
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const stored = JSON.parse(localStorage.getItem('test-obj')!);
    expect(stored.name).toBe('updated');
    expect(stored.value).toBe(100);
  });
});
```

**Verificacion:**
```bash
npm run test -- src/hooks/__tests__/useLocalStorage.test.ts
```

---

### Tarea 1.5: Tests para logger.ts

**Archivo:** `src/core/__tests__/logger.test.ts` (ampliar si existe)

**Codigo:**
```typescript
// src/core/__tests__/logger.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, LogLevel, setLogLevel } from '../logger';

describe('logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
    setLogLevel(LogLevel.DEBUG); // Enable all logs for testing
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  describe('log levels', () => {
    it('logger.debug calls console.debug', () => {
      logger.debug('debug message');
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]'),
        'debug message'
      );
    });

    it('logger.info calls console.log', () => {
      logger.info('info message');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        'info message'
      );
    });

    it('logger.warn calls console.warn', () => {
      logger.warn('warning message');
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]'),
        'warning message'
      );
    });

    it('logger.error calls console.error', () => {
      logger.error('error message');
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        'error message'
      );
    });
  });

  describe('log level filtering', () => {
    it('respects log level setting', () => {
      setLogLevel(LogLevel.WARN);

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('LogLevel.NONE suppresses all logs', () => {
      setLogLevel(LogLevel.NONE);

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });
  });

  describe('additional arguments', () => {
    it('passes additional arguments to console', () => {
      const error = new Error('test error');
      logger.error('Something failed', error);

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.any(String),
        'Something failed',
        error
      );
    });
  });
});
```

**Verificacion:**
```bash
npm run test -- src/core/__tests__/logger.test.ts
```

---

### Tarea 1.6: Configurar coverage reporting

**Archivo a modificar:** `package.json`

**Agregar script:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch"
  }
}
```

**Archivo a crear:** `vitest.config.ts` (si no existe, o modificar)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        'src/i18n/',
        'src/locales/',
      ],
      thresholds: {
        global: {
          statements: 60,
          branches: 50,
          functions: 60,
          lines: 60,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@core': path.resolve(__dirname, './src/core'),
      '@services': path.resolve(__dirname, './src/services'),
      '@features': path.resolve(__dirname, './src/features'),
    },
  },
});
```

**Verificacion:**
```bash
npm run test:coverage
# Debe mostrar reporte de cobertura y generar carpeta coverage/
```

---

## Sprint 2: Type Safety Cleanup

> **Objetivo:** Eliminar todos los escapes de tipos (@ts-ignore, as any) para mejorar la seguridad del codigo.

### Tarea 2.1: Crear Type Guards para Settings

**Archivo a crear:** `src/utils/typeGuards.ts`

**Problema:** En multiples archivos se usa `as unknown` y `as any` para manejar Settings que pueden tener tipos inconsistentes.

**Codigo:**
```typescript
// src/utils/typeGuards.ts

import type { Settings, Trip, Charge, Car } from '@/types';

/**
 * Type guard para verificar si un valor es un numero valido
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Type guard para verificar si un valor es un string no vacio
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Parsea un valor que puede ser string o number a number
 * Util para Settings donde batterySize puede venir como string de forms
 */
export function parseNumericSetting(value: unknown, defaultValue: number): number {
  if (isValidNumber(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (isValidNumber(parsed)) {
      return parsed;
    }
  }
  return defaultValue;
}

/**
 * Type guard para Trip
 */
export function isTrip(obj: unknown): obj is Trip {
  if (typeof obj !== 'object' || obj === null) return false;
  const trip = obj as Record<string, unknown>;
  return (
    typeof trip.date === 'string' &&
    (typeof trip.trip === 'number' || typeof trip.trip === 'undefined')
  );
}

/**
 * Type guard para Charge
 */
export function isCharge(obj: unknown): obj is Charge {
  if (typeof obj !== 'object' || obj === null) return false;
  const charge = obj as Record<string, unknown>;
  return (
    typeof charge.date === 'string' &&
    (typeof charge.kwh === 'number' || typeof charge.kwhCharged === 'number')
  );
}

/**
 * Type guard para array de Trips
 */
export function isTripsArray(arr: unknown): arr is Trip[] {
  return Array.isArray(arr) && arr.every(isTrip);
}

/**
 * Type guard para array de Charges
 */
export function isChargesArray(arr: unknown): arr is Charge[] {
  return Array.isArray(arr) && arr.every(isCharge);
}

/**
 * Filtra un array eliminando valores null/undefined con tipo correcto
 */
export function filterNonNull<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter((item): item is T => item != null);
}

/**
 * Safe access para propiedades opcionales con default
 */
export function getSettingValue<T>(
  settings: Partial<Settings> | undefined,
  key: keyof Settings,
  defaultValue: T
): T {
  if (!settings || !(key in settings)) {
    return defaultValue;
  }
  const value = settings[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return value as T;
}
```

**Verificacion:**
```bash
npx tsc --noEmit
# No debe haber errores de tipo
```

---

### Tarea 2.2: Refactorizar useAppData.ts

**Archivo:** `src/hooks/useAppData.ts`

**Problema actual (lineas ~101-104):**
```typescript
// ANTES - Type escape
const val = settings?.batterySize as unknown;
const batterySize = typeof val === 'string'
    ? parseFloat(val)
    : (typeof val === 'number' ? val : 82.56);
```

**Codigo propuesto:**
```typescript
// DESPUES - Con type guard
import { parseNumericSetting } from '@/utils/typeGuards';

const batterySize = parseNumericSetting(settings?.batterySize, 82.56);
```

**Buscar y reemplazar en el archivo:**
1. Todas las ocurrencias de `as unknown`
2. Todas las ocurrencias de `as any`
3. Usar `parseNumericSetting` para valores numericos de settings

**Verificacion:**
```bash
grep -n "as unknown\|as any" src/hooks/useAppData.ts
# Debe retornar 0 resultados
```

---

### Tarea 2.3: Eliminar @ts-ignore en dataProcessing.ts

**Archivo:** `src/core/dataProcessing.ts`

**Problema actual (lineas 4-5):**
```typescript
// @ts-ignore
import { formatMonth, formatDate } from './dateUtils';
```

**Solucion:** Verificar que `dateUtils.ts` exporta correctamente estas funciones.

**Pasos:**
1. Abrir `src/core/dateUtils.ts`
2. Verificar exports:
```typescript
// src/core/dateUtils.ts
export function formatMonth(date: Date | string): string {
  // implementacion
}

export function formatDate(date: Date | string): string {
  // implementacion
}
```

3. Si las funciones existen, eliminar el `@ts-ignore`
4. Si faltan, agregar los exports necesarios

**Verificacion:**
```bash
grep -n "@ts-ignore" src/core/dataProcessing.ts
# Debe retornar 0 resultados
```

---

### Tarea 2.4: Eliminar @ts-ignore en TripDetailModal.tsx

**Archivo:** `src/components/modals/TripDetailModal.tsx`

**Problema actual (lineas ~45-58):**
```typescript
// @ts-ignore
const validCoords = trip.gps_points?.filter(p => /* ... */)
```

**Solucion:** Definir tipos correctos para gps_points.

**Codigo propuesto:**
```typescript
// En src/types/index.ts agregar:
export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp?: number;
  speed?: number;
}

export interface Trip {
  // ... otros campos
  gps_points?: GpsPoint[];
}

// En TripDetailModal.tsx:
const validCoords = trip.gps_points?.filter(
  (p): p is GpsPoint =>
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    !isNaN(p.lat) &&
    !isNaN(p.lng)
) ?? [];
```

**Verificacion:**
```bash
grep -n "@ts-ignore" src/components/modals/TripDetailModal.tsx
# Debe retornar 0 resultados
npx tsc --noEmit
# Sin errores
```

---

### Tarea 2.5: Eliminar `as any` en App.tsx

**Archivo:** `src/App.tsx`

**Problema actual (lineas ~148-149):**
```typescript
openModal={openModal as any}
closeModal={closeModal as any}
```

**Solucion:** Definir tipos correctos para modal props.

**Pasos:**
1. Verificar tipo de `openModal` en `useModalState`
2. Crear tipo compatible para el componente que lo recibe

**Codigo propuesto en useModalState.ts:**
```typescript
export type ModalName = keyof ModalsState;

export type OpenModalFn = (modal: ModalName) => void;
export type CloseModalFn = (modal: ModalName) => void;

export interface UseModalStateReturn {
  modals: ModalsState;
  openModal: OpenModalFn;
  closeModal: CloseModalFn;
  // ... otros
}
```

**En App.tsx:**
```typescript
// ANTES
openModal={openModal as any}

// DESPUES
openModal={openModal}
```

**Verificacion:**
```bash
grep -n "as any" src/App.tsx
# Debe retornar 0 resultados
```

---

### Tarea 2.6: Auditar archivos restantes

**Comando para encontrar todos los escapes:**
```bash
grep -rn "as any\|@ts-ignore\|as unknown" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test."
```

**Objetivo:** 0 resultados.

**Para cada resultado:**
1. Identificar por que se necesita el escape
2. Crear type guard o ajustar tipos
3. Eliminar el escape

---

## Sprint 3: Code Quality & DRY

> **Objetivo:** Eliminar codigo duplicado y mejorar la mantenibilidad.

### Tarea 3.1: Crear hook useMergeData

**Problema:** Logica de merge Map-based duplicada en 3 lugares.

**Archivo a crear:** `src/hooks/useMergeData.ts`

**Codigo:**
```typescript
// src/hooks/useMergeData.ts
import { useMemo, useCallback } from 'react';

interface MergeableItem {
  date: string;
  start_timestamp?: number;
  [key: string]: unknown;
}

interface UseMergeDataOptions<T extends MergeableItem> {
  /** Key generator function. Default uses date-timestamp */
  keyFn?: (item: T) => string;
  /** Strategy when duplicate found: 'first' | 'last' | 'merge' */
  duplicateStrategy?: 'first' | 'last' | 'merge';
  /** Custom merge function when strategy is 'merge' */
  mergeFn?: (existing: T, incoming: T) => T;
}

/**
 * Hook for merging arrays with deduplication
 * Replaces duplicated Map-based merge logic across codebase
 */
export function useMergeData<T extends MergeableItem>(
  options: UseMergeDataOptions<T> = {}
) {
  const {
    keyFn = (item: T) => `${item.date}-${item.start_timestamp ?? ''}`,
    duplicateStrategy = 'last',
    mergeFn,
  } = options;

  const merge = useCallback(
    (local: T[], remote: T[]): T[] => {
      const map = new Map<string, T>();

      // Add local items first
      local.forEach(item => {
        const key = keyFn(item);
        map.set(key, item);
      });

      // Process remote items based on strategy
      remote.forEach(item => {
        const key = keyFn(item);
        const existing = map.get(key);

        if (!existing) {
          map.set(key, item);
        } else {
          switch (duplicateStrategy) {
            case 'first':
              // Keep existing (local), do nothing
              break;
            case 'last':
              // Overwrite with remote
              map.set(key, item);
              break;
            case 'merge':
              // Custom merge
              if (mergeFn) {
                map.set(key, mergeFn(existing, item));
              } else {
                map.set(key, { ...existing, ...item });
              }
              break;
          }
        }
      });

      return Array.from(map.values());
    },
    [keyFn, duplicateStrategy, mergeFn]
  );

  const deduplicate = useCallback(
    (items: T[]): T[] => {
      const map = new Map<string, T>();
      items.forEach(item => {
        const key = keyFn(item);
        if (!map.has(key)) {
          map.set(key, item);
        }
      });
      return Array.from(map.values());
    },
    [keyFn]
  );

  return { merge, deduplicate };
}

/**
 * Non-hook version for use in services/workers
 */
export function mergeArrays<T extends MergeableItem>(
  local: T[],
  remote: T[],
  keyFn: (item: T) => string = (item) => `${item.date}-${item.start_timestamp ?? ''}`
): T[] {
  const map = new Map<string, T>();
  local.forEach(item => map.set(keyFn(item), item));
  remote.forEach(item => map.set(keyFn(item), item));
  return Array.from(map.values());
}

export function deduplicateArray<T extends MergeableItem>(
  items: T[],
  keyFn: (item: T) => string = (item) => `${item.date}-${item.start_timestamp ?? ''}`
): T[] {
  const map = new Map<string, T>();
  items.forEach(item => {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
}
```

**Uso en useAppData.ts:**
```typescript
// ANTES
const tripMap = new Map<string, Trip>();
rawTrips.forEach(t => {
    const key = `${t.start_timestamp || t.date}-${t.trip}`;
    tripMap.set(key, withConsumption({ ...t, source: 'local' }));
});
firebaseTrips.forEach(t => {
    const key = `${t.start_timestamp || t.date}-${t.trip}`;
    tripMap.set(key, withConsumption(t));
});
const merged = Array.from(tripMap.values());

// DESPUES
import { mergeArrays } from './useMergeData';

const merged = mergeArrays(
  rawTrips.map(t => withConsumption({ ...t, source: 'local' })),
  firebaseTrips.map(withConsumption),
  (t) => `${t.start_timestamp || t.date}-${t.trip}`
);
```

**Verificacion:**
```bash
# Buscar patrones de merge manual
grep -rn "new Map.*Trip\|new Map.*Charge" src/hooks/ src/services/
# Debe reducirse significativamente
```

---

### Tarea 3.2: Crear FormField component reutilizable

**Problema:** Clases Tailwind de inputs repetidas en 5+ modals.

**Archivo a crear:** `src/components/ui/FormField.tsx`

**Codigo:**
```typescript
// src/components/ui/FormField.tsx
import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  /** Suffix text (e.g., "kWh", "%") */
  suffix?: string;
  /** Prefix text (e.g., "$", "€") */
  prefix?: string;
  /** Field ID for accessibility */
  fieldId?: string;
}

const inputBaseClass =
  "w-full bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 " +
  "rounded-lg px-3 py-2 text-slate-900 dark:text-white " +
  "focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "placeholder:text-slate-400 dark:placeholder:text-slate-500 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const labelClass =
  "block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1";

const errorClass =
  "text-xs text-red-500 dark:text-red-400 mt-1";

const hintClass =
  "text-xs text-slate-500 dark:text-slate-500 mt-1";

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, hint, suffix, prefix, fieldId, className, ...props }, ref) => {
    const id = fieldId || `field-${label.toLowerCase().replace(/\s+/g, '-')}`;

    return (
      <div className="space-y-1">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>

        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              {prefix}
            </span>
          )}

          <input
            ref={ref}
            id={id}
            className={`${inputBaseClass} ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-12' : ''} ${className || ''}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            {...props}
          />

          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
              {suffix}
            </span>
          )}
        </div>

        {error && (
          <p id={`${id}-error`} className={errorClass} role="alert">
            {error}
          </p>
        )}

        {hint && !error && (
          <p id={`${id}-hint`} className={hintClass}>
            {hint}
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

// Select variant
interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: Array<{ value: string | number; label: string }>;
  fieldId?: string;
}

const selectClass =
  "w-full bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 " +
  "rounded-lg px-3 py-2 text-slate-900 dark:text-white " +
  "focus:ring-2 focus:ring-blue-500 focus:border-transparent";

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, error, options, fieldId, className, ...props }, ref) => {
    const id = fieldId || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;

    return (
      <div className="space-y-1">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>

        <select
          ref={ref}
          id={id}
          className={`${selectClass} ${className || ''}`}
          aria-invalid={!!error}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {error && (
          <p className={errorClass} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

FormSelect.displayName = 'FormSelect';

export default FormField;
```

**Uso en AddChargeModal.tsx:**
```typescript
// ANTES
<label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
  {t('charges.energy')}
</label>
<input
  type="number"
  value={kwh}
  onChange={(e) => setKwh(e.target.value)}
  className="w-full bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2..."
/>

// DESPUES
<FormField
  label={t('charges.energy')}
  type="number"
  value={kwh}
  onChange={(e) => setKwh(e.target.value)}
  suffix="kWh"
/>
```

**Verificacion:**
```bash
# Contar lineas de codigo en modals de forms
wc -l src/components/modals/AddChargeModal.tsx
# Debe reducirse ~30%
```

---

### Tarea 3.3: Crear ModalBase component

**Problema:** 27 modals sin estructura compartida.

**Archivo a crear:** `src/components/ui/ModalBase.tsx`

**Codigo:**
```typescript
// src/components/ui/ModalBase.tsx
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Show close button */
  showCloseButton?: boolean;
  /** Close on backdrop click */
  closeOnBackdrop?: boolean;
  /** Close on Escape key */
  closeOnEscape?: boolean;
  /** Custom footer content */
  footer?: React.ReactNode;
  /** Children content */
  children: React.ReactNode;
  /** Additional modal classes */
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
};

export function ModalBase({
  isOpen,
  onClose,
  title,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  footer,
  children,
  className,
}: ModalBaseProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={`
          relative w-full ${sizeClasses[size]}
          bg-white dark:bg-slate-800
          rounded-xl shadow-2xl
          max-h-[90vh] flex flex-col
          ${className || ''}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2
            id="modal-title"
            className="text-lg font-semibold text-slate-900 dark:text-white"
          >
            {title}
          </h2>

          {showCloseButton && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default ModalBase;
```

**Verificacion:**
```bash
# Verificar que se puede importar
grep -l "ModalBase" src/components/modals/*.tsx
# Debe aparecer en modals refactorizados
```

---

### Tarea 3.4: Consolidar Dashboard Views

**Problema:** MobileDashboardView y DesktopDashboardView comparten ~70% de logica.

**Archivo a crear:** `src/features/dashboard/useDashboardTabs.ts`

**Codigo:**
```typescript
// src/features/dashboard/useDashboardTabs.ts
import { useState, useCallback, useMemo, lazy, Suspense } from 'react';

// Lazy load tabs
const OverviewTab = lazy(() => import('./tabs/OverviewTab'));
const EfficiencyTab = lazy(() => import('./tabs/EfficiencyTab'));
const HistoryTab = lazy(() => import('./tabs/HistoryTab'));
const ChargesTab = lazy(() => import('./tabs/ChargesTab'));
const CalendarTab = lazy(() => import('./tabs/CalendarTab'));
const PatternsTab = lazy(() => import('./tabs/PatternsTab'));
const TrendsTab = lazy(() => import('./tabs/TrendsTab'));
const RecordsTab = lazy(() => import('./tabs/RecordsTab'));

export type TabId =
  | 'overview'
  | 'efficiency'
  | 'history'
  | 'charges'
  | 'calendar'
  | 'patterns'
  | 'trends'
  | 'records';

export interface TabDefinition {
  id: TabId;
  labelKey: string;
  icon: string;
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  premium?: boolean;
}

export const TAB_DEFINITIONS: TabDefinition[] = [
  { id: 'overview', labelKey: 'tabs.overview', icon: 'home', component: OverviewTab },
  { id: 'efficiency', labelKey: 'tabs.efficiency', icon: 'bolt', component: EfficiencyTab },
  { id: 'history', labelKey: 'tabs.history', icon: 'history', component: HistoryTab },
  { id: 'charges', labelKey: 'tabs.charges', icon: 'battery', component: ChargesTab },
  { id: 'calendar', labelKey: 'tabs.calendar', icon: 'calendar', component: CalendarTab },
  { id: 'patterns', labelKey: 'tabs.patterns', icon: 'chart', component: PatternsTab },
  { id: 'trends', labelKey: 'tabs.trends', icon: 'trending', component: TrendsTab },
  { id: 'records', labelKey: 'tabs.records', icon: 'trophy', component: RecordsTab },
];

interface UseDashboardTabsOptions {
  defaultTab?: TabId;
  persistKey?: string;
}

export function useDashboardTabs(options: UseDashboardTabsOptions = {}) {
  const { defaultTab = 'overview', persistKey } = options;

  // Restore from localStorage if persistKey provided
  const getInitialTab = (): TabId => {
    if (persistKey) {
      const saved = localStorage.getItem(persistKey);
      if (saved && TAB_DEFINITIONS.some(t => t.id === saved)) {
        return saved as TabId;
      }
    }
    return defaultTab;
  };

  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);

  const changeTab = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
    if (persistKey) {
      localStorage.setItem(persistKey, tabId);
    }
  }, [persistKey]);

  const activeTabDef = useMemo(
    () => TAB_DEFINITIONS.find(t => t.id === activeTab) || TAB_DEFINITIONS[0],
    [activeTab]
  );

  const tabIndex = useMemo(
    () => TAB_DEFINITIONS.findIndex(t => t.id === activeTab),
    [activeTab]
  );

  const goToNextTab = useCallback(() => {
    const nextIndex = (tabIndex + 1) % TAB_DEFINITIONS.length;
    changeTab(TAB_DEFINITIONS[nextIndex].id);
  }, [tabIndex, changeTab]);

  const goToPrevTab = useCallback(() => {
    const prevIndex = (tabIndex - 1 + TAB_DEFINITIONS.length) % TAB_DEFINITIONS.length;
    changeTab(TAB_DEFINITIONS[prevIndex].id);
  }, [tabIndex, changeTab]);

  return {
    activeTab,
    activeTabDef,
    tabIndex,
    tabs: TAB_DEFINITIONS,
    changeTab,
    goToNextTab,
    goToPrevTab,
  };
}
```

**Verificacion:**
```bash
wc -l src/features/dashboard/MobileDashboardView.tsx src/features/dashboard/DesktopDashboardView.tsx
# Debe reducirse combinado en ~40%
```

---

### Tarea 3.5: Reemplazar console.log por logger

**Comando para encontrar todas las ocurrencias:**
```bash
grep -rn "console\.\(log\|error\|warn\|debug\)" src/ --include="*.ts" --include="*.tsx" | grep -v logger.ts | grep -v ".test."
```

**Script de migracion (ejecutar manualmente):**

Para cada archivo encontrado:
1. Agregar import: `import { logger } from '@/core/logger';`
2. Reemplazar:
   - `console.log(...)` → `logger.debug(...)`
   - `console.error(...)` → `logger.error(...)`
   - `console.warn(...)` → `logger.warn(...)`

**Archivos prioritarios (41 ocurrencias):**
- `src/features/navigation/Header.tsx`
- `src/components/settings/SmartcarSettings.tsx`
- `src/hooks/useChargeImporter.ts`
- `src/hooks/useAppVersion.ts`
- `src/components/modals/ChargeNotificationModal.tsx`
- `src/hooks/sync/useDriveSync.ts`
- `src/components/modals/CloudBackupsModal.tsx`
- `src/components/modals/HealthReportModal.tsx`
- `src/components/modals/RegistryRestoreModal.tsx`
- `src/components/modals/TripDetailModal.tsx`

**Verificacion:**
```bash
grep -rn "console\." src/ --include="*.ts" --include="*.tsx" | grep -v logger.ts | grep -v ".test." | wc -l
# Debe ser 0
```

---

## Sprint 4: Component Refactoring

> **Objetivo:** Reducir componentes >400 lineas a <200 lineas cada uno.

### Tarea 4.1: Refactorizar AddChargeModal

**Archivo:** `src/components/modals/AddChargeModal.tsx` (475 lineas)

**Estructura propuesta:**

```
src/components/modals/
├── AddChargeModal.tsx          (~150 lineas - orquestador)
├── charge-form/
│   ├── ElectricChargeForm.tsx  (~120 lineas)
│   ├── FuelChargeForm.tsx      (~100 lineas)
│   ├── useChargeEstimation.ts  (~80 lineas - logica de estimacion)
│   └── chargeValidation.ts     (~50 lineas - validacion)
```

**Archivo principal refactorizado:**
```typescript
// src/components/modals/AddChargeModal.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalBase } from '@/components/ui/ModalBase';
import { ElectricChargeForm } from './charge-form/ElectricChargeForm';
import { FuelChargeForm } from './charge-form/FuelChargeForm';
import type { Charge } from '@/types';

interface AddChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (charge: Charge) => void;
  editingCharge?: Charge | null;
  isHybrid?: boolean;
}

export function AddChargeModal({
  isOpen,
  onClose,
  onSave,
  editingCharge,
  isHybrid = false,
}: AddChargeModalProps) {
  const { t } = useTranslation();
  const [chargeType, setChargeType] = useState<'electric' | 'fuel'>(
    editingCharge?.chargerTypeId === 'fuel' ? 'fuel' : 'electric'
  );

  const handleSave = (charge: Omit<Charge, 'id'>) => {
    onSave({
      ...charge,
      id: editingCharge?.id || crypto.randomUUID(),
    });
    onClose();
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={editingCharge ? t('charges.edit') : t('charges.add')}
      size="md"
    >
      {/* Type selector for hybrid vehicles */}
      {isHybrid && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setChargeType('electric')}
            className={`flex-1 py-2 rounded-lg ${
              chargeType === 'electric'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-200 dark:bg-slate-700'
            }`}
          >
            {t('charges.electric')}
          </button>
          <button
            onClick={() => setChargeType('fuel')}
            className={`flex-1 py-2 rounded-lg ${
              chargeType === 'fuel'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-200 dark:bg-slate-700'
            }`}
          >
            {t('charges.fuel')}
          </button>
        </div>
      )}

      {chargeType === 'electric' ? (
        <ElectricChargeForm
          initialData={editingCharge}
          onSave={handleSave}
          onCancel={onClose}
        />
      ) : (
        <FuelChargeForm
          initialData={editingCharge}
          onSave={handleSave}
          onCancel={onClose}
        />
      )}
    </ModalBase>
  );
}

export default AddChargeModal;
```

**Verificacion:**
```bash
wc -l src/components/modals/AddChargeModal.tsx
# Debe ser < 200 lineas
```

---

### Tarea 4.2: Refactorizar TripInsightsModal

**Archivo:** `src/components/modals/TripInsightsModal.tsx` (675 lineas)

**Estructura propuesta:**
```
src/components/modals/
├── TripInsightsModal.tsx           (~150 lineas - orquestador)
├── trip-insights/
│   ├── InsightsSummaryCard.tsx     (~100 lineas)
│   ├── EfficiencyBreakdown.tsx     (~120 lineas)
│   ├── ComparisonChart.tsx         (~100 lineas)
│   ├── useTripInsightsData.ts      (~150 lineas - data fetching/calc)
│   └── tripInsightsUtils.ts        (~80 lineas - pure functions)
```

**Hook de datos:**
```typescript
// src/components/modals/trip-insights/useTripInsightsData.ts
import { useMemo } from 'react';
import type { Trip } from '@/types';

interface TripInsightsData {
  avgEfficiency: number;
  bestTrip: Trip | null;
  worstTrip: Trip | null;
  totalDistance: number;
  totalEnergy: number;
  efficiencyTrend: 'improving' | 'stable' | 'declining';
  comparisonData: {
    label: string;
    value: number;
    benchmark: number;
  }[];
}

export function useTripInsightsData(trips: Trip[]): TripInsightsData {
  return useMemo(() => {
    if (trips.length === 0) {
      return {
        avgEfficiency: 0,
        bestTrip: null,
        worstTrip: null,
        totalDistance: 0,
        totalEnergy: 0,
        efficiencyTrend: 'stable',
        comparisonData: [],
      };
    }

    const validTrips = trips.filter(t => (t.trip || 0) > 0.5);

    const totalDistance = validTrips.reduce((sum, t) => sum + (t.trip || 0), 0);
    const totalEnergy = validTrips.reduce((sum, t) => sum + (t.kwh || 0), 0);
    const avgEfficiency = totalDistance > 0 ? (totalEnergy / totalDistance) * 100 : 0;

    // Find best/worst by efficiency (kWh/100km, lower is better)
    const sortedByEfficiency = [...validTrips].sort((a, b) => {
      const effA = ((a.kwh || 0) / (a.trip || 1)) * 100;
      const effB = ((b.kwh || 0) / (b.trip || 1)) * 100;
      return effA - effB;
    });

    const bestTrip = sortedByEfficiency[0] || null;
    const worstTrip = sortedByEfficiency[sortedByEfficiency.length - 1] || null;

    // Calculate trend (compare last 10 vs previous 10)
    const recentTrips = validTrips.slice(0, 10);
    const olderTrips = validTrips.slice(10, 20);

    const recentAvg = recentTrips.length > 0
      ? recentTrips.reduce((s, t) => s + ((t.kwh || 0) / (t.trip || 1)) * 100, 0) / recentTrips.length
      : 0;
    const olderAvg = olderTrips.length > 0
      ? olderTrips.reduce((s, t) => s + ((t.kwh || 0) / (t.trip || 1)) * 100, 0) / olderTrips.length
      : recentAvg;

    const trendDiff = olderAvg - recentAvg;
    const efficiencyTrend: 'improving' | 'stable' | 'declining' =
      trendDiff > 1 ? 'improving' : trendDiff < -1 ? 'declining' : 'stable';

    // Comparison data
    const comparisonData = [
      { label: 'city', value: avgEfficiency, benchmark: 14.5 },
      { label: 'mixed', value: avgEfficiency, benchmark: 17.5 },
      { label: 'highway', value: avgEfficiency, benchmark: 23.5 },
    ];

    return {
      avgEfficiency,
      bestTrip,
      worstTrip,
      totalDistance,
      totalEnergy,
      efficiencyTrend,
      comparisonData,
    };
  }, [trips]);
}
```

**Verificacion:**
```bash
wc -l src/components/modals/TripInsightsModal.tsx
# Debe ser < 200 lineas
```

---

### Tarea 4.3: Extraer swipe logic completo

**Archivo:** `src/hooks/useSwipeGesture.ts` (ya existe, verificar completitud)

**Verificar que incluye:**
```typescript
// src/hooks/useSwipeGesture.ts
import { useRef, useCallback, useEffect, useState } from 'react';

interface SwipeConfig {
  /** Minimum distance to trigger swipe (px) */
  threshold?: number;
  /** Maximum time for swipe gesture (ms) */
  maxTime?: number;
  /** Prevent vertical scroll during horizontal swipe */
  preventScroll?: boolean;
  /** Callback on swipe left */
  onSwipeLeft?: () => void;
  /** Callback on swipe right */
  onSwipeRight?: () => void;
  /** Callback on swipe up */
  onSwipeUp?: () => void;
  /** Callback on swipe down */
  onSwipeDown?: () => void;
  /** Callback with current drag position */
  onDrag?: (deltaX: number, deltaY: number) => void;
  /** Callback when drag ends */
  onDragEnd?: () => void;
  /** Enabled state */
  enabled?: boolean;
}

interface SwipeState {
  isSwiping: boolean;
  direction: 'left' | 'right' | 'up' | 'down' | null;
  deltaX: number;
  deltaY: number;
}

export function useSwipeGesture<T extends HTMLElement = HTMLDivElement>(
  config: SwipeConfig = {}
) {
  const {
    threshold = 50,
    maxTime = 300,
    preventScroll = true,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onDrag,
    onDragEnd,
    enabled = true,
  } = config;

  const ref = useRef<T>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);

  const [state, setState] = useState<SwipeState>({
    isSwiping: false,
    direction: null,
    deltaX: 0,
    deltaY: 0,
  });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    startTime.current = Date.now();
    setState(s => ({ ...s, isSwiping: true }));
  }, [enabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || !state.isSwiping) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - startX.current;
    const deltaY = touch.clientY - startY.current;

    // Prevent scroll if moving horizontally
    if (preventScroll && Math.abs(deltaX) > Math.abs(deltaY)) {
      e.preventDefault();
    }

    setState(s => ({ ...s, deltaX, deltaY }));
    onDrag?.(deltaX, deltaY);
  }, [enabled, state.isSwiping, preventScroll, onDrag]);

  const handleTouchEnd = useCallback(() => {
    if (!enabled || !state.isSwiping) return;

    const { deltaX, deltaY } = state;
    const duration = Date.now() - startTime.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    let direction: SwipeState['direction'] = null;

    if (duration <= maxTime) {
      if (absDeltaX > threshold && absDeltaX > absDeltaY) {
        direction = deltaX > 0 ? 'right' : 'left';
        if (direction === 'left') onSwipeLeft?.();
        if (direction === 'right') onSwipeRight?.();
      } else if (absDeltaY > threshold && absDeltaY > absDeltaX) {
        direction = deltaY > 0 ? 'down' : 'up';
        if (direction === 'up') onSwipeUp?.();
        if (direction === 'down') onSwipeDown?.();
      }
    }

    setState({ isSwiping: false, direction, deltaX: 0, deltaY: 0 });
    onDragEnd?.();
  }, [enabled, state, maxTime, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onDragEnd]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    ref,
    ...state,
  };
}
```

---

## Sprint 5: Error Handling & Logging

> **Objetivo:** Manejo de errores consistente y logging apropiado para produccion.

### Tarea 5.1: Crear Error classes tipadas

**Archivo a crear:** `src/core/errors.ts`

**Codigo:**
```typescript
// src/core/errors.ts

/**
 * Base error class for BYD Stats
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
    };
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends AppError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'NETWORK_ERROR', { ...context, statusCode });
    this.name = 'NetworkError';
  }

  static fromResponse(response: Response, context?: Record<string, unknown>) {
    return new NetworkError(
      `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      { ...context, url: response.url }
    );
  }
}

/**
 * Google Drive API errors
 */
export class DriveError extends AppError {
  constructor(
    message: string,
    public readonly operation: 'read' | 'write' | 'list' | 'delete' | 'auth',
    context?: Record<string, unknown>
  ) {
    super(message, 'DRIVE_ERROR', { ...context, operation });
    this.name = 'DriveError';
  }
}

/**
 * Firebase/Firestore errors
 */
export class FirebaseError extends AppError {
  constructor(
    message: string,
    public readonly operation: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'FIREBASE_ERROR', { ...context, operation });
    this.name = 'FirebaseError';
  }
}

/**
 * Data validation errors
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly field?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', { ...context, field });
    this.name = 'ValidationError';
  }
}

/**
 * Worker communication errors
 */
export class WorkerError extends AppError {
  constructor(
    message: string,
    public readonly workerName: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'WORKER_ERROR', { ...context, workerName });
    this.name = 'WorkerError';
  }
}

/**
 * Type guard to check if error is AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Wrap unknown errors in AppError
 */
export function wrapError(error: unknown, defaultCode = 'UNKNOWN_ERROR'): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, defaultCode, { originalError: error.name });
  }

  return new AppError(String(error), defaultCode);
}
```

---

### Tarea 5.2: Implementar retry logic

**Archivo a crear:** `src/utils/retry.ts`

**Codigo:**
```typescript
// src/utils/retry.ts
import { logger } from '@/core/logger';

interface RetryConfig {
  /** Maximum number of attempts */
  maxAttempts?: number;
  /** Initial delay in ms */
  initialDelay?: number;
  /** Maximum delay in ms */
  maxDelay?: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** Function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback on each retry */
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  isRetryable: () => true,
  onRetry: () => {},
};

/**
 * Retry an async operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxAttempts,
    initialDelay,
    maxDelay,
    backoffMultiplier,
    isRetryable,
    onRetry,
  } = { ...DEFAULT_CONFIG, ...config };

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !isRetryable(error)) {
        throw error;
      }

      logger.warn(`Retry attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`, {
        error,
        delay,
      });

      onRetry(attempt, error, delay);

      await sleep(delay);
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is a network error (retryable)
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnreset')
    );
  }
  return false;
}

/**
 * Check if HTTP status is retryable (5xx or specific 4xx)
 */
export function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429 || status === 408;
}
```

**Uso en googleDrive.ts:**
```typescript
// ANTES
const response = await fetch(url, options);

// DESPUES
import { withRetry, isNetworkError, isRetryableStatus } from '@/utils/retry';

const response = await withRetry(
  () => fetch(url, options),
  {
    maxAttempts: 3,
    isRetryable: isNetworkError,
    onRetry: (attempt, error) => {
      logger.warn(`Drive request retry ${attempt}`, { error });
    },
  }
);
```

---

### Tarea 5.3: Mejorar error handling en useProcessedData

**Archivo:** `src/hooks/useProcessedData.ts`

**Problema:** Chains de promesas sin propagacion de errores adecuada.

**Codigo propuesto (refactorizar lineas ~214-280):**
```typescript
// src/hooks/useProcessedData.ts

// ANTES - nested promises
workerRef.current.trainModel(allTrips).then(({ loss }) => {
    workerRef.current?.getRangeScenarios(...).then(scenarios => {
        // ...
    }).catch(err => { ... });
}).catch(err => { ... });

// DESPUES - async/await con try-catch
const processAIModels = useCallback(async () => {
  if (!workerRef.current || allTrips.length < 5) return;

  try {
    // Train efficiency model
    const { loss } = await workerRef.current.trainModel(allTrips);
    logger.debug('Efficiency model trained', { loss });

    // Get range scenarios
    const scenarios = await workerRef.current.getRangeScenarios(
      filteredTrips,
      settings?.batterySize || 82.56,
      settings?.minSoC || 20
    );

    const newHash = `v2-${allTrips.length}-${filteredTrips.length}`;
    setAiCache({ hash: newHash, scenarios, loss });
    logger.debug('AI cache updated', { scenarios: scenarios.length });

    // Train SoH model if enough charges
    if (charges.length >= 3) {
      const sohStats = await workerRef.current.getSoHStats(charges, allTrips);
      const sohHash = `v2-${charges.length}-${allTrips.length}`;
      setSohCache({ hash: sohHash, ...sohStats });
      logger.debug('SoH model updated', { currentSoH: sohStats.currentSoH });
    }

    // Train parking model
    const parkingPredictions = await workerRef.current.trainParkingModel(allTrips);
    setParkingCache({
      hash: `v2-${allTrips.length}`,
      predictions: parkingPredictions,
      weights: await workerRef.current.exportParkingModel(),
    });
    logger.debug('Parking model updated', { predictions: parkingPredictions.length });

  } catch (error) {
    logger.error('AI processing failed', error);
    // Don't throw - AI failure shouldn't break the app
    // Keep using cached values if available
  }
}, [allTrips, filteredTrips, charges, settings]);

// Trigger processing
useEffect(() => {
  processAIModels();
}, [processAIModels, recalcTrigger]);
```

---

## Sprint 6: Performance Fine-tuning

> **Objetivo:** Optimizaciones finales para alcanzar Lighthouse >90.

### Tarea 6.1: Analizar y reducir bundle

**Herramienta:** Instalar vite-plugin-visualizer

**Modificar vite.config.ts:**
```typescript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    // ... otros plugins
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
    }),
  ],
});
```

**Verificacion:**
```bash
npm run build
# Abrir dist/stats.html para analizar dependencias
```

**Objetivos de reduccion:**
- chart.js: Considerar importar solo modulos usados
- i18next: Verificar que no se cargan locales no usados
- TensorFlow: Ya aislado, verificar que no hay imports en main bundle

---

### Tarea 6.2: Implementar preload de chunks criticos

**Archivo a modificar:** `index.html`

**Agregar preloads:**
```html
<!-- index.html -->
<head>
  <!-- Preload critical chunks -->
  <link rel="modulepreload" href="/assets/react-vendor-[hash].js">
  <link rel="preload" href="/locales/es.json" as="fetch" crossorigin>

  <!-- DNS prefetch for external services -->
  <link rel="dns-prefetch" href="https://www.googleapis.com">
  <link rel="dns-prefetch" href="https://firestore.googleapis.com">
</head>
```

**Nota:** Los hashes cambian en cada build, considerar script de post-build para actualizar.

---

### Tarea 6.3: Optimizar imagenes

**Verificar formato WebP:**
```bash
# Listar imagenes en public/
ls -la public/*.png public/*.jpg 2>/dev/null
```

**Convertir a WebP si no existe:**
- Usar herramienta como `cwebp` o servicio online
- Mantener PNG como fallback
- Agregar picture elements:

```html
<picture>
  <source srcset="/app_icon_v2.webp" type="image/webp">
  <img src="/app_icon_v2.png" alt="BYD Stats">
</picture>
```

---

### Tarea 6.4: Lighthouse audit final

**Ejecutar audit:**
1. `npm run build && npm run preview`
2. Abrir Chrome DevTools > Lighthouse
3. Ejecutar audit de Performance, Accessibility, Best Practices, SEO

**Objetivos:**
- Performance: >90
- Accessibility: >95
- Best Practices: >95
- SEO: >90

**Metricas clave:**
- LCP (Largest Contentful Paint): <2.5s
- FID (First Input Delay): <100ms
- CLS (Cumulative Layout Shift): <0.1
- TTI (Time to Interactive): <2s

---

## Metricas de Exito v4

| Metrica | Actual | Objetivo v4 | Verificacion |
|---------|--------|-------------|--------------|
| Test coverage | 4% | >60% | `npm run test:coverage` |
| Type escapes | 15 | 0 | `grep "as any\|@ts-ignore"` |
| console.log | 41 | 0 | `grep "console\."` |
| Componentes >400 lineas | 7 | 0 | `wc -l` |
| Codigo duplicado | ~600 | <100 | Code review |
| Lighthouse Performance | ~75 | >90 | Chrome DevTools |
| Bundle principal (gzip) | 251KB | <220KB | `npm run build` |
| TTI | ~3s | <2s | Lighthouse |

---

## Compatibilidad con LLMs

| Sprint | Claude Opus/Sonnet | GPT-4 | Gemini Pro | Gemini Flash |
|--------|-------------------|-------|------------|--------------|
| Sprint 1 (Testing) | OK | OK | OK | OK |
| Sprint 2 (Types) | OK | OK | OK | OK |
| Sprint 3 (DRY) | OK | OK | CUIDADO | NO |
| Sprint 4 (Refactor) | OK | CUIDADO | CUIDADO | NO |
| Sprint 5 (Errors) | OK | OK | OK | OK |
| Sprint 6 (Performance) | OK | OK | OK | OK |

**Notas:**
- Gemini Flash: Solo tareas simples sin refactoring de componentes
- GPT-4: Puede tener problemas con refactoring de archivos grandes
- Para Sprint 3 y 4: Preferir Claude Opus o Sonnet

---

## Orden de Implementacion Recomendado

1. **Sprint 1** - Testing (CRITICO - base para todo lo demas)
2. **Sprint 2** - Type Safety (mejora DX y detecta bugs)
3. **Sprint 5** - Error Handling (mejora robustez)
4. **Sprint 3** - DRY (reduce mantenimiento)
5. **Sprint 4** - Refactoring (mejora legibilidad)
6. **Sprint 6** - Performance (optimizacion final)

**Tiempo total estimado:** 14-18 dias

---

## Checklist de Verificacion Final

- [ ] `npm run test:coverage` muestra >60%
- [ ] `grep -rn "as any\|@ts-ignore" src/` retorna 0 resultados
- [ ] `grep -rn "console\." src/ | grep -v logger` retorna 0 resultados
- [ ] Ningun componente en `src/components/` tiene >400 lineas
- [ ] `npm run build` completa sin warnings
- [ ] Lighthouse Performance >90
- [ ] Todos los tests pasan: `npm run test`
- [ ] TypeScript compila sin errores: `npx tsc --noEmit`

---

**Documento creado:** 2025-02-11
**Ultima actualizacion:** 2025-02-11
**Version:** 4.0.0
