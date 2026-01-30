# Auditoría Profunda de Código y Arquitectura - BYD Stats (v1.8.1)

## 1. Resumen Ejecutivo

### 1.1. Objetivos
El objetivo de esta auditoría es evaluar el estado actual de la aplicación tras las optimizaciones críticas (M4, M5) y la limpieza del repositorio. Se busca identificar deuda técnica remanente, completar la migración a TypeScript y proponer funcionalidades de valor añadido.

### 1.2. Puntos Fuertes
-   **Rendimiento Crítico Resuelto**: La implementación de **Web Workers (M5)** y **Virtual Tabs con URL Sync (M4)** ha eliminado los bloqueos de UI y renderizados innecesarios. La app es fluida incluso con grandes volúmenes de datos.
-   **Arquitectura de Datos Local**: El uso de SQLite (wasm) y localStorage con estrategias de sincronización offline-first es robusto y privacidad-centrico.
-   **Diseño Visual**: La interfaz es coherente, moderna y adaptada a PWA/Móvil.

### 1.3. Riesgos Principales
-   **Migración TS Incompleta**: La coexistencia de JS y TS (`src/core` vs `src/hooks`) genera fricción en el desarrollo y pérdida de seguridad de tipos.
-   **"God Hooks"**: `useAppData.js` y `useAppOrchestrator.js` acumulan demasiadas responsabilidades (gestión de estado, lógica de negocio, persistencia y UI), lo que dificulta el testeo y mantenimiento.
-   **Duplicidad de Tipos**: Existen definiciones JSDoc en `src/core/types.js` y definiciones TS en `src/types/index.ts`.

---

## 2. Visión General de la Arquitectura

### 2.1. Descripción de la Arquitectura
La aplicación sigue una arquitectura **Modular por Funcionalidades (Feature-based)** sobre React + Vite.
-   **Core**: Utilidades puras (`src/core`) independientes de React.
-   **Estado**: Gestión distribuida mediante React Context (`AppContext`, `CarContext`, `DataProvider`) y Hooks personalizados.
-   **Routing**: Híbrido. `react-router` para páginas legales/principales y un sistema de "Tab Router" virtual para el dashboard (para preservar estado de componentes).

### 2.2. Calidad del Diseño
-   **Acoplamiento**: Medio. Los componentes de UI (`src/features`) están desacoplados, pero los Hooks de lógica (`useAppData`) están muy acoplados a la implementación de almacenamiento y cálculos.
-   **Separación de Responsabilidades**: Mejorable. `DataProvider.jsx` actúa como un "mega-controlador" que inyecta todo a todos. Idealmente, debería haber contextos más granulares (`HistoryContext`, `FilterContext`).

### 2.3. Patrones de Diseño
-   **Provider Pattern**: Ampliamente usado y correcto.
-   **Container/Presenter**: Usado parcialmente (e.g., `OverviewTab` vs `OverviewContent`), lo cual es una buena práctica que debería extenderse.
-   **Worker Pattern**: Correctamente implementado con `comlink` para `dataProcessing`.

### 2.4. Problemas de Arquitectura
-   **Dependencia Circular Potencial**: Entre `useAppOrchestrator` y los contextos que consume/provee.
-   **Falta de Capa de Servicio**: Las llamadas a localStorage/IndexedDB están 'hardcoded' en los hooks. Deberían abstraerse en servicios (`StorageService`).

---

## 3. Calidad del Código

### 3.1. Legibilidad y Estilo
-   Código generalmente limpio y legible.
-   Nombres de variables descriptivos.
-   **Mejora**: Estandarizar el idioma de los comentarios (mezcla de inglés/español) y logs.

### 3.2. Complejidad Ciclomática
-   **Crítico**: `useAppData.js` (>300 líneas) tiene múltiples `useEffect` con dependencias complejas. La lógica de filtrado, persistencia y workers está mezclada.
-   `processData` (ahora en Worker) sigue siendo una función monolítica muy larga.

### 3.3. Duplicidad
-   Definiciones de Tipos: `src/core/types.js` (JSDoc) vs `src/types/index.ts` (TS).
-   Lógica de formateo de fechas: A veces `Intl`, a veces `dateUtils`, a veces `moment` (si hubiera). Se ha unificado bastante en `dateUtils` recientemente.

### 3.4. Manejo de Errores
-   Uso de `logger` centralizado es positivo.
-   Falta manejo visual de errores (Error Boundaries granulares) en componentes individuales como Gráficos.

### 3.5. Uso de Tipos (TypeScript)
-   Estado: **Híbrido (30% TS / 70% JS)**.
-   Los archivos `.jsx` no se benefician del tipado fuerte de los modelos definidos en `core`.

### 3.6. Seguridad
-   Bajo riesgo al ser client-side y no manejar auth propia (Google Auth delegado).
-   Datos sensibles (trayectos) en localStorage sin cifrar. No es crítico para una app personal, pero consideraría opción de cifrado si se guarda en nube.

---

## 4. Rendimiento y Eficiencia

### 4.1. Cuellos de Botella
-   **Renderizado de Listas**: `AllTripsView` o `AllChargesView` con miles de elementos pueden sufrir. Virtualización (`react-window`) es necesaria si crece la data.
-   **Gráficos**: Chart.js es pesado. Si se añaden muchos puntos, el canvas puede ralentizar el scroll.

### 4.2. Algoritmos
-   El procesamiento de datos es O(N) lo cual es correcto.
-   `getTopN` implementado eficientemente.

### 4.3. Estrategias de Caché
-   `useMemo` se usa extensivamente.
-   `browser-image-compression` para imágenes es un acierto.

### 4.4. Code Splitting
-   Vite gestiona bien los chunks, pero `MainLayout` carga todos los tabs.
-   **Recomendación**: Lazy Loading real de los componentes de Tabs (`import('./tabs/OverviewTab')`) dentro del sistema de rutas virtuales.

---

## 5. Organización del Repositorio

### 5.1. Estructura
-   La estructura `src/features` es moderna y escalable.
-   `src/core` es un buen lugar para lógica de dominio, pero debería ser 100% TypeScript.

### 5.2. Tests
-   Cobertura baja/desconocida. Existen carpetas `__tests__` pero no parecen cubrir hooks complejos como `useAppData`.

### 5.3. Build & DX
-   `vite.config.js` limpio.
-   Limpieza reciente de `jsconfig` y logs es positiva.

### 5.4. Documentación
-   `docs/` contiene buena documentación contextual.
-   Falta un `CONTRIBUTING.md` si se planea abrir a más devs.

---

## 6. Lista Priorizada de Mejoras Técnicas

| ID | Mejora | Detalle Técnico | Ganancia | Dificultad | Impacto | Prio |
|:---|:---|:---|:---|:---|:---|:---|
| **M1** | **Migración Total a TS** | Renombrar `.jsx` -> `.tsx` y `.js` -> `.ts` carpeta por carpeta (`hooks`, `components`). Eliminar `types.js` y usar `types.ts`. | Fiabilidad (Alta) | Media | Elimina errores de runtime tipo "undefined property". | **Alta** |
| **M2** | **Desacoplar `useAppData`** | Dividir en `useTrips`, `useHistory`, `useFilter`. Crear `StorageService` para lógica `localStorage`. | Mantenibilidad (Alta) | Media | Facilita testear y entender la lógica de datos. | **Alta** |
| **M3** | **Virtualización de Listas** | Implementar `react-window` o `virtuoso` en `AllTripsView` y modales de historial. | Rendimiento (Media) | Media | Scroll infinito suave con >10k registros. | Media |
| **M4** | **Lazy Loading de Tabs** | Usar `React.lazy` para los componentes de las pestañas (`OverviewTab`, etc.) dentro de `DesktopDashboardView`. | Rendimiento (Baja) | Baja | Reduce el bundle inicial (FCP más rápido). | Media |
| **M5** | **Unit Testing Core** | Tests Jest/Vitest exhaustivos para `dataProcessing.ts` y `batteryCalculations.ts`. | Fiabilidad (Alta) | Baja | Asegura que los cálculos de costes/SOH no fallen. | Alta |
| **M6** | **Validación de Importación** | Usar `zod` para validar el esquema del CSV/JSON al importar. | Seguridad (Media) | Media | Evita corrupción de datos por archivos mal formados. | Baja |

---

## 7. Nuevas Funcionalidades Sugeridas

| ID | Nombre | Ganancia | Dificultad | Módulos Afectados |
|:---|:---|:---|:---|:---|
| **F1** | **Predicción de Autonomía IA** | **Alta**: Valor diferencial. | Alta | `dataWorker`, `OverviewTab` |
| **F2** | **Gestión de Neumáticos** | **Conversión Media**: Útil para mantenimiento. | Baja | `Settings`, `DB` |
| **F3** | **Modo "Viaje en Curso"** | **Alta**: Uso en tiempo real. | Media | `Dashboard`, `GPS` |
| **F4** | **Comparador de Costes** | **Alta**: Muestra ahorro vs Gasolina. | Media | `Stats` |

### Detalle de Funcionalidades
1.  **F1 - Predicción de Autonomía (IA Local)**: Usar *TensorFlow.js* (en worker) para predecir autonomía basada no solo en media, sino en temperatura (clima API) y patrón de conducción reciente.
2.  **F2 - Gestión de Neumáticos**: CRUD simple para registrar cambios de neumáticos y rotaciones. Alerta basada en KM recorridos (usando `totalKm`).
3.  **F3 - Modo "Viaje en Curso"**: Una vista simplificada con botones grandes para registrar manualmente inicio/fin de carga o viaje si no se usa la importación automática.
4.  **F4 - Comparador de Costes**: Input en settings "Precio Gasolina/Diesel de referencia". Mostrar en Overview: "Has ahorrado X€ vs coche combustión".

---

## 8. Plan de Acción Recomendado

### 8.1. Fase 1: Consolidación (Semana 1)
1.  **Ejecutar M1 (TS Core)**: Completar tipado de hooks y componentes base.
2.  **Ejecutar M5 (Tests)**: Asegurar cálculos antes de añadir más features.

### 8.2. Fase 2: Arquitectura (Semana 2)
1.  **Ejecutar M2 (Refactor Hooks)**: Romper `useAppData` en hooks pequeños.
2.  **Ejecutar M3 (Virtualización)**: Preparar la UI para escalar.

### 8.3. Fase 3: Valor Añadido (Semana 3+)
1.  **Implementar F4 (Comparador Costes)**: Feature sencilla pero muy vistosa ("Ganchos de venta").
2.  **Implementar F2 (Neumáticos)**: Añade utilidad de mantenimiento.

### 8.4. Métricas de Éxito
-   **Coverage**: Pasar de desconocido a >80% en Core.
-   **Tipo**: 0 archivos `.js` en `src/`.
-   **Lighthouse**: Mantener score >95 en Performance tras cambios.
