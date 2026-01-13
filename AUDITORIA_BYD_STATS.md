# Auditoría Completa y Plan de Mejoras - BYD Stats

**Fecha:** Enero 2026
**Versión analizada:** 1.2.1
**Autor:** Auditoría automatizada con Claude

---

## Resumen Ejecutivo

Se identificaron **36 problemas** distribuidos en 4 niveles de severidad:

| Severidad | Cantidad | Descripción |
|-----------|----------|-------------|
| CRÍTICO | 6 | Seguridad, arquitectura fundamental |
| ALTO | 12 | Rendimiento, gestión de estado |
| MEDIO | 14 | Calidad de código, patrones |
| BAJO | 4 | Estilo, optimizaciones menores |

---

## 1. HALLAZGOS DE ARQUITECTURA

### 1.1 App.jsx - Megacomponente (CRÍTICO)

**Ubicación:** `src/App.jsx` (~2000 líneas)

**Problemas identificados:**
- Archivo monolítico que contiene renderizado completo, lógica de estado, gestión de modales y manejo de gestos
- 16+ estados useState manejados en el componente principal (líneas 240-286)
- Prop drilling severo: tabs reciben 12+ props cada uno
- Componente TripCard definido inline (líneas 899-952) en lugar de archivo separado
- Función processData() duplicada (líneas 74-206) cuando ya existe en utils

**Impacto:**
- Difícil de mantener y testear
- Re-renders excesivos en toda la aplicación
- Imposible reutilizar componentes

**Estados afectados:**
```javascript
// Líneas 240-286 - Estados que deberían estar en hooks separados
rawTrips, activeTab, dragOver, showModal, showFilterModal,
showAllTripsModal, showTripDetailModal, showSettingsModal,
showHistoryModal, showHelpModal, showLegalModal, selectedTrip,
filterType, selMonth, dateFrom, dateTo, tripHistory...
```

### 1.2 Contexto Único Mezclado (CRÍTICO)

**Ubicación:** `src/context/AppContext.jsx` (líneas 148-155)

**Problema:** Un único contexto maneja tanto layout (layoutMode, isCompact, isFullscreenBYD) como settings (carModel, batterySize, etc.)

**Impacto:** Cuando settings cambia, toda la app re-renderiza incluyendo componentes que solo necesitan layout.

**Solución recomendada:** Separar en AppContext (settings) y LayoutContext (layout)

### 1.3 Prop Drilling Severo (ALTO)

**Ubicación:** Todos los tabs (`src/components/tabs/*.jsx`)

**Props que se pasan innecesariamente:**
- `isCompact`
- `isLargerCard`
- `isVertical`
- `isFullscreenBYD`
- `smallChartHeight`
- `largeChartHeight`
- `patternsChartHeight`
- Y más...

**Solución:** Obtener estas props desde contexto en cada componente

---

## 2. HALLAZGOS DE SEGURIDAD

### 2.1 Vulnerabilidad XSS - dangerouslySetInnerHTML (CRÍTICO)

**Ubicación:** `src/components/LegalContent.jsx`
- Línea 15
- Línea 20
- Líneas 33-34

**Código vulnerable:**
```jsx
<p dangerouslySetInnerHTML={{ __html: t('legal.privacy.summary') }} />
```

**Riesgo:** Si archivos i18n se comprometen, pueden inyectar código JavaScript malicioso.

**Solución INMEDIATA:**
```jsx
// Reemplazar con:
<p>{t('legal.privacy.summary')}</p>
```

### 2.2 Credenciales Hardcodeadas (CRÍTICO)

**Ubicaciones:**
- `src/main.jsx` línea 11: `WEB_CLIENT_ID` expuesto
- `src/hooks/useGoogleSync.js` línea 55: webClientId hardcodeado

**Solución:**
1. Crear `.env.local`:
```
VITE_GOOGLE_CLIENT_ID=tu_client_id_aqui
```

2. Modificar código:
```javascript
const WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
```

### 2.3 Tokens en localStorage Sin Cifrar (ALTO)

**Ubicación:** `src/hooks/useGoogleSync.js`

**Datos expuestos:**
- `google_access_token` en texto plano
- `insurancePolicy` sin cifrar

**Riesgo:** Robo de sesión mediante XSS o acceso físico

**Recomendación:**
- Usar sessionStorage para tokens (se elimina al cerrar navegador)
- Considerar cifrado para datos sensibles

---

## 3. HALLAZGOS DE RENDIMIENTO

### 3.1 Configuración Chart.js Recreada Cada Render (ALTO)

**Ubicaciones:**
- `src/components/tabs/OverviewTab.jsx` (líneas 120-142, 283-307)
- `src/components/tabs/TrendsTab.jsx` (líneas 124-128)
- `src/components/tabs/EfficiencyTab.jsx` (líneas 91-122)
- `src/components/tabs/PatternsTab.jsx`

**Problema:**
```jsx
// MALO: Se crea nuevo objeto cada render
<LineJS
  options={{
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true, ... } }
  }}
  data={{
    labels: monthly.map(m => m.monthLabel),  // Nuevo array cada render
    datasets: [{ data: monthly.map(m => m.km), ... }]
  }}
/>
```

**Solución:**
```jsx
// BUENO: Memoizado
const chartOptions = useMemo(() => ({
  maintainAspectRatio: false,
  scales: { y: { beginAtZero: true, ... } }
}), []);

const chartData = useMemo(() => ({
  labels: monthly.map(m => m.monthLabel),
  datasets: [{ data: monthly.map(m => m.km), ... }]
}), [monthly]);

<LineJS options={chartOptions} data={chartData} />
```

### 3.2 Cálculos Sin Memoización en HistoryTab (ALTO)

**Ubicación:** `src/components/tabs/HistoryTab.jsx` (líneas 23-54)

**Problema:** 5 operaciones O(n) ejecutadas en cada render:
```javascript
const allTrips = [...filtered].sort(...);     // COPIA + SORT
const validTrips = allTrips.filter(...);       // FILTER
const efficiencies = validTrips.map(...);      // MAP
const minEff = Math.min(...efficiencies);      // ITERAR
const avgDistance = last10.reduce(...);        // REDUCE
```

**Solución:**
```javascript
const historyData = useMemo(() => {
  const allTrips = [...filtered].sort(...);
  const validTrips = allTrips.filter(...);
  // ... resto de cálculos
  return { allTrips, validTrips, minEff, maxEff, avgDistance, ... };
}, [filtered]);
```

### 3.3 useCallback con Dependencias Incorrectas (CRÍTICO)

**Ubicación:** `src/App.jsx`
- Línea 614: `processDB` incluye `googleSync` en dependencies pero `googleSync` es recreado cada render
- Línea 743: `handleTabClick` depende de número mágico `transitionDuration`

**Impacto:** Re-renders innecesarios de componentes memoizados

### 3.4 Múltiples Sort Sin Necesidad (MEDIO)

**Ubicación:** `src/App.jsx` (líneas 161-163)

```javascript
const sortedByKm = [...trips].sort((a, b) => (b.trip || 0) - (a.trip || 0));
const sortedByKwh = [...trips].sort((a, b) => (b.electricity || 0) - (a.electricity || 0));
const sortedByDur = [...trips].sort((a, b) => (b.duration || 0) - (a.duration || 0));
```

**Problema:** 3 copias + 3 sorts = O(3n log n) operaciones

---

## 4. HALLAZGOS DE CALIDAD DE CÓDIGO

### 4.1 Sin Tests (CRÍTICO)

**Hallazgo:** 0 archivos de test en todo el proyecto
**Cobertura:** 0%

**Componentes críticos sin tests:**
- `AppContext.jsx` - Manejo de settings y layout
- `useDatabase.js` - Operaciones de BD (SQL.js)
- `useGoogleSync.js` - Autenticación y sincronización
- `dataProcessing.js` - Transformación de datos
- Todos los tabs

### 4.2 Sin PropTypes/TypeScript (ALTO)

**Hallazgo:** Ningún componente tiene validación de props

**Impacto:**
- Bugs detectados solo en runtime
- Sin documentación automática
- Sin autocomplete en IDE

**Ejemplo de componente sin tipado:**
```jsx
// OverviewTab.jsx - Espera múltiples props sin documentar
const OverviewTab = React.memo(({
  filtered,      // ¿Qué tipo? ¿Array de qué?
  summary,       // ¿Objeto con qué propiedades?
  monthly,       // ???
  settings,      // ???
  isCompact,     // ¿boolean?
  // ... 7 props más
}) => { ... });
```

### 4.3 Errores Silenciados (ALTO)

**Ubicaciones:**
- `src/components/ErrorBoundary.jsx` línea 15: Solo `console.error()`, sin UI feedback
- `src/hooks/useLocalStorage.js` línea 18: Errores silenciados, retorna `initialValue`
- Múltiples `console.error()` sin user feedback en hooks

### 4.4 Logging Excesivo (MEDIO)

**Hallazgo:** 77 ocurrencias de `console.log/warn/error` en el código

**Problemas:**
- Información de debug en producción
- Sin filtro por nivel de log
- Formatos inconsistentes

### 4.5 Textos Hardcodeados Sin i18n (ALTO)

**Ubicaciones:**
- `src/App.jsx` línea 59: "Ver en GitHub"
- `src/components/ErrorBoundary.jsx` líneas 29-31: "Algo salió mal"
- `src/components/ErrorBoundary.jsx` línea 48: "Reiniciar y Borrar Caché"
- `src/utils/dataProcessing.js` línea 24: Weekday names en español

### 4.6 ARIA Labels Mínimos (MEDIO-ALTO)

**Hallazgo:** Solo 6 ocurrencias de `aria-` en 50+ componentes

**Problemas de accesibilidad:**
- Botones sin labels (`SettingsModal.jsx` línea 40, `DatabaseUploadModal.jsx` línea 60)
- Modales sin `role="dialog"` y `aria-modal="true"`
- `ErrorBoundary` sin `role="alert"`
- Inputs sin `aria-label` o `aria-describedby`

---

## 5. PLAN DE IMPLEMENTACIÓN POR FASES

### FASE 1: Seguridad y Correcciones Críticas
**Duración estimada:** 1-2 horas
**Riesgo:** Bajo
**Archivos a modificar:** 4

#### Tareas:

**1.1 Eliminar dangerouslySetInnerHTML**
```
Archivo: src/components/LegalContent.jsx
Acción: Reemplazar dangerouslySetInnerHTML por texto normal con t()
```

**1.2 Mover credenciales a variables de entorno**
```
Archivos:
- Crear: .env.local
- Modificar: src/main.jsx (línea 11)
- Modificar: src/hooks/useGoogleSync.js (línea 55)
```

**1.3 Traducir textos hardcodeados críticos**
```
Archivo: src/components/ErrorBoundary.jsx
Acción: Envolver textos con t() y agregar claves a archivos i18n
```

#### Verificación:
- [ ] Abrir app y navegar a sección Legal
- [ ] Verificar login con Google funciona
- [ ] Provocar error y verificar ErrorBoundary muestra texto traducido

---

### FASE 2: Optimización de Rendimiento
**Duración estimada:** 2-3 horas
**Riesgo:** Bajo-Medio
**Archivos a modificar:** 6 tabs + utils

#### Tareas:

**2.1 Memoizar configuraciones de Chart.js**
```
Archivos:
- src/components/tabs/OverviewTab.jsx
- src/components/tabs/TrendsTab.jsx
- src/components/tabs/EfficiencyTab.jsx
- src/components/tabs/PatternsTab.jsx

Patrón a aplicar:
const chartOptions = useMemo(() => ({...}), []);
const chartData = useMemo(() => ({...}), [dependencias]);
```

**2.2 Memoizar cálculos en HistoryTab**
```
Archivo: src/components/tabs/HistoryTab.jsx
Líneas: 23-54
Acción: Envolver todos los cálculos en un único useMemo
```

**2.3 Crear constantes para configuraciones**
```
Nuevo archivo: src/constants/chartConfigs.js
Contenido: Exportar configuraciones base reutilizables de Chart.js
```

#### Verificación:
- [ ] Abrir React DevTools Profiler
- [ ] Cambiar entre tabs y verificar menos re-renders
- [ ] Verificar gráficos se actualizan correctamente

---

### FASE 3: Refactorización de Arquitectura (Parte 1)
**Duración estimada:** 2-3 horas
**Riesgo:** Medio
**Archivos nuevos:** 4-5

#### Tareas:

**3.1 Extraer TripCard a componente separado**
```
Nuevo archivo: src/components/cards/TripCard.jsx
Origen: src/App.jsx líneas 899-952
```

**3.2 Crear hook useModalState**
```
Nuevo archivo: src/hooks/useModalState.js

Contenido:
const useModalState = () => {
  const [modals, setModals] = useState({
    settings: false,
    filter: false,
    allTrips: false,
    tripDetail: false,
    history: false,
    help: false,
    legal: false
  });

  const openModal = useCallback((name) =>
    setModals(prev => ({...prev, [name]: true})), []);
  const closeModal = useCallback((name) =>
    setModals(prev => ({...prev, [name]: false})), []);
  const toggleModal = useCallback((name) =>
    setModals(prev => ({...prev, [name]: !prev[name]})), []);

  return { modals, openModal, closeModal, toggleModal };
};
```

**3.3 Consolidar processData**
```
Archivo: src/utils/dataProcessing.js
Acción: Asegurar que App.jsx usa la versión de utils, eliminar versión inline
```

#### Verificación:
- [ ] Verificar TripCard se renderiza igual que antes
- [ ] Verificar modales abren/cierran correctamente
- [ ] Verificar datos se procesan igual

---

### FASE 4: Refactorización de Arquitectura (Parte 2)
**Duración estimada:** 3-4 horas
**Riesgo:** Medio-Alto
**Archivos nuevos/modificados:** 4

#### Tareas:

**4.1 Separar LayoutContext de AppContext**
```
Nuevo archivo: src/context/LayoutContext.jsx

Contenido:
export const LayoutContext = createContext();

export const LayoutProvider = ({ children }) => {
  const { layoutMode, isCompact, isFullscreenBYD } = useLayoutMode();

  const value = useMemo(() => ({
    layoutMode,
    isCompact,
    isFullscreenBYD,
    isVertical: layoutMode === 'vertical'
  }), [layoutMode, isCompact, isFullscreenBYD]);

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = () => useContext(LayoutContext);
```

**4.2 Modificar AppContext**
```
Archivo: src/context/AppContext.jsx
Acción: Remover layoutMode, isCompact, isFullscreenBYD (ahora en LayoutContext)
```

**4.3 Crear hook useAppData**
```
Nuevo archivo: src/hooks/useAppData.js

Contenido: Mover lógica de datos de App.jsx
- rawTrips, filtered, data
- processData, months
- filterType, dateFrom, dateTo
```

**4.4 Actualizar tabs para usar contextos**
```
Archivos: Todos los tabs
Cambio: Obtener isCompact, isVertical, etc. de useLayout()
```

#### Verificación:
- [ ] Verificar cambio de orientación funciona
- [ ] Verificar filtros funcionan
- [ ] Verificar settings se guardan correctamente

---

### FASE 5: Testing y Calidad
**Duración estimada:** 4-6 horas
**Riesgo:** Bajo
**Archivos nuevos:** 5-10 tests

#### Tareas:

**5.1 Configurar Vitest**
```
Instalar:
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom

Crear: vitest.config.js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
});

Crear: src/setupTests.js
import '@testing-library/jest-dom';
```

**5.2 Tests para utilidades críticas**
```
Nuevos archivos:
- src/utils/__tests__/dataProcessing.test.js
- src/utils/__tests__/formatters.test.js
- src/utils/__tests__/dateUtils.test.js

Casos a cubrir:
- Datos vacíos
- Datos null/undefined
- Valores edge (0, negativos, muy grandes)
- Formatos de fecha inválidos
```

**5.3 Tests para hooks**
```
Nuevos archivos:
- src/hooks/__tests__/useLocalStorage.test.js
- src/hooks/__tests__/useDatabase.test.js
```

**5.4 Agregar PropTypes a componentes críticos**
```
Archivos: StatCard, ChartCard, TripCard, tabs principales

Ejemplo:
import PropTypes from 'prop-types';

StatCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  unit: PropTypes.string,
  color: PropTypes.string,
  isCompact: PropTypes.bool,
  isLarger: PropTypes.bool,
  isVerticalMode: PropTypes.bool,
};
```

#### Verificación:
- [ ] `npm run test` pasa sin errores
- [ ] Cobertura > 50% en utils y hooks

---

### FASE 6: Accesibilidad y Polish
**Duración estimada:** 2-3 horas
**Riesgo:** Bajo

#### Tareas:

**6.1 Agregar ARIA labels**
```
Cambios necesarios:

// Modales
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">

// Botones de icono
<button aria-label="Cerrar modal">
  <X className="w-5 h-5" />
</button>

// ErrorBoundary
<div role="alert" aria-live="assertive">

// Inputs
<input aria-label="Precio de electricidad" />
```

**6.2 Implementar logger**
```
Nuevo archivo: src/utils/logger.js

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const CURRENT_LEVEL = import.meta.env.PROD ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;

export const logger = {
  debug: (...args) => CURRENT_LEVEL <= LOG_LEVELS.DEBUG && console.log('[DEBUG]', ...args),
  info: (...args) => CURRENT_LEVEL <= LOG_LEVELS.INFO && console.info('[INFO]', ...args),
  warn: (...args) => CURRENT_LEVEL <= LOG_LEVELS.WARN && console.warn('[WARN]', ...args),
  error: (...args) => CURRENT_LEVEL <= LOG_LEVELS.ERROR && console.error('[ERROR]', ...args),
};
```

**6.3 Mejorar manejo de errores**
```
Implementar toast notifications para errores críticos
Agregar try/catch con feedback al usuario en hooks principales
```

---

## 6. ARCHIVOS CRÍTICOS - RESUMEN

| Fase | Archivo | Tipo de Cambio |
|------|---------|----------------|
| 1 | `src/components/LegalContent.jsx` | Seguridad |
| 1 | `src/hooks/useGoogleSync.js` | Seguridad |
| 1 | `src/main.jsx` | Seguridad |
| 1 | `.env.local` (nuevo) | Seguridad |
| 2 | `src/components/tabs/OverviewTab.jsx` | Performance |
| 2 | `src/components/tabs/TrendsTab.jsx` | Performance |
| 2 | `src/components/tabs/HistoryTab.jsx` | Performance |
| 2 | `src/components/tabs/EfficiencyTab.jsx` | Performance |
| 2 | `src/components/tabs/PatternsTab.jsx` | Performance |
| 2 | `src/constants/chartConfigs.js` (nuevo) | Performance |
| 3 | `src/App.jsx` | Arquitectura |
| 3 | `src/components/cards/TripCard.jsx` (nuevo) | Arquitectura |
| 3 | `src/hooks/useModalState.js` (nuevo) | Arquitectura |
| 4 | `src/context/LayoutContext.jsx` (nuevo) | Arquitectura |
| 4 | `src/context/AppContext.jsx` | Arquitectura |
| 4 | `src/hooks/useAppData.js` (nuevo) | Arquitectura |
| 5 | `vitest.config.js` (nuevo) | Testing |
| 5 | `src/setupTests.js` (nuevo) | Testing |
| 5 | `src/utils/__tests__/*.test.js` (nuevos) | Testing |
| 6 | `src/utils/logger.js` (nuevo) | Calidad |

---

## 7. CRONOGRAMA RECOMENDADO

```
Fase 1 (1-2 horas) → Deploy → Verificar seguridad
         ↓
Fase 2 (2-3 horas) → Deploy → Verificar rendimiento
         ↓
Fase 3 (2-3 horas) → Deploy → Verificar funcionalidad
         ↓
Fase 4 (3-4 horas) → Deploy → Verificar completo
         ↓
Fase 5 (4-6 horas) → CI/CD con tests
         ↓
Fase 6 (2-3 horas) → Polish final
```

**Tiempo total estimado:** 14-21 horas de desarrollo

---

## 8. CHECKLIST DE VERIFICACIÓN FINAL

Después de cada fase ejecutar:

- [ ] `npm run build` sin errores ni warnings
- [ ] `npm run dev` y probar navegación completa
- [ ] Probar en móvil (modo vertical)
- [ ] Probar en tablet/pantalla BYD (modo horizontal)
- [ ] Verificar sincronización con Google Drive
- [ ] Verificar persistencia de datos en localStorage
- [ ] Verificar que filtros funcionan correctamente
- [ ] Verificar que modales abren/cierran sin errores

---

## 9. MÉTRICAS DE ÉXITO

| Métrica | Antes | Después (esperado) |
|---------|-------|-------------------|
| Líneas en App.jsx | ~2000 | <800 |
| Re-renders por cambio de tab | Alto | Mínimo |
| Cobertura de tests | 0% | >50% |
| Vulnerabilidades XSS | 3 | 0 |
| Credenciales expuestas | 2 | 0 |
| ARIA labels | 6 | >30 |
| Textos sin traducir | >5 | 0 |

---

*Documento generado automáticamente. Revisar y adaptar según necesidades específicas del proyecto.*
