# Auditoría Técnica y Plan de Acción - BYD Stats

## Resumen Ejecutivo

Este documento detalla el estado técnico actual de la aplicación **BYD Stats** tras el análisis detallado de su arquitectura, código y rendimiento. Se proponen una serie de hitos (Milestones) para profesionalizar el codebase, mejorar la mantenibilidad y optimizar la experiencia de usuario.

---

## Estado de Hitos (Fase 1)

### Completados ✅
- [x] **M1: Refactorización de App.jsx** (Completado)
    - Separación de lógica de layouts en componentes especializados.
    - Implementación de `mobileSafePadding` y `LayoutContext`.
- [x] **M2: Optimización de DataProvider** (Completado)
    - División del contexto monolítico en `DataStateContext` y `DataDispatchContext`.
    - Reducción de re-renders innecesarios.
- [x] **M6: Estandarización de Tests** (Completado)
    - Añadir script `test:core` en `package.json`.
    - Asegurar que los tests existentes pasan tras el refactor.
    - Añadir test de integración para el flujo de "Import DB".
    - Configuración de mocks globales y entorno robusto.

### Pendientes ⏳
- [ ] **M3: Migración Gradual a TypeScript** (Pendiente)
    - Definición de interfaces para `Trip`, `Charge`, `Settings`.
- [ ] **M4: Unificar Routing con React Router** (Pendiente)
    - Mover tabs a rutas reales.
- [ ] **M5: Web Workers para Procesamiento** (Pendiente)
    - Procesamiento de datos en segundo plano.

---

## Tabla de Mejoras Técnicas

| ID | Tarea | Descripción | Impacto | Prioridad | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **M1** | **Refactor App.jsx** | Dividir el componente gigante en `DashboardLayout`, `MobileView`, etc. | Mantenibilidad | Alta | **Completado** |
| **M2** | **Optimizar DataProvider** | Separar Context de Datos y Context de Acciones para evitar re-renders masivos. | Rendimiento | Alta | **Completado** |
| **M3** | **Migración Gradual a TypeScript** | Renombrar `dataProcessing.js` a `.ts` y definir interfaces reales para `Trip` y `Charge`. Configurar `tsconfig.json`. | Seguridad/DX | Media | Pendiente |
| **M4** | **Unificar Routing** | Mover la lógica de "Tabs" actual (`DashboardLayout`) a sub-rutas reales de React Router (`/dashboard/overview`, `/dashboard/trips`). | Arquitectura | Alta | Pendiente |
| **M5** | **Worker para Procesamiento** | Mover `processData` a un Web Worker usando `comlink` o API nativa para liberar el main thread durante cargas masivas. | Rendimiento | Alta | Baja |
| **M6** | **Estandarización de Tests** | Crear script `npm run test:core` y asegurar que cada feature tenga su `__tests__` colocalizado. Añadir tests de integración para el flujo de "Importar DB". | Calidad | Baja | **Completado** |
| **M7** | **Virtualización en Gráficos** | Si se muestran muchos puntos en los gráficos de Chart.js, implementar "decimation" (muestreo) para reducir puntos renderizados. | Rendimiento | Media | Baja |

---

## Próximos Pasos Recomendados (Febrero 2025)

1. **Implementar M3 (TypeScript)**: Empezar por el core (`dataProcessing.js`) para ganar seguridad en el manejo de tipos de los viajes.
2. **Implementar F1 (Calculadora de Ahorro)**: Feature de alto impacto para el usuario final.
3. **Optimizar PWA**: Asegurar que el `manifest.json` y el Service Worker estén 100% operativos para instalación offline.
