# 🕵️ Auditoría de Código y Plan de Optimización V5

> **Fecha:** 28 de Enero de 2026
> **Estado:** Post-Release v1.6.3 (Multi-Car Support)
> **Objetivo:** Refactorización pendiente y optimización de rendimiento.

---

## 1. ✅ Tareas Completadas (Recientes)

### A. Funcionalidades Críticas
-   **Soporte Multi-Coche:** Implementado con éxito. Selector en cabecera y aislamiento de datos (`localStorage` con sufijos de ID) funcionan correctamente.
-   **Eliminación de Coches:** Se ha reemplazado la limpieza genérica por una opción robusta de "Borrar Coche" que limpia datos y elimina la entidad.
-   **Portal para Modales:** Solucionado el problema de apilamiento (z-index) usando `createPortal`, permitiendo que los modales cubran toda la pantalla correctamente.
-   **Consolidación de Iconos:** Se han eliminado dependencias rotas (`lucide-react`) y unificado el uso de `src/components/Icons.jsx`.

### B. Limpieza y Utilidades
-   **Lógica "Stationary" Centralizada:** Se ha verificado que `isStationaryTrip` existe en `dataProcessing.js` y es usada correctamente por `TripInsightsModal`.
-   **Limpieza de Archivos:** `src/assets/react.svg` y archivos temporales antiguos parecen haber sido eliminados.

---

## 2. 🚧 Deuda Técnica Pendiente (Prioridad Alta)

### A. Refactorización de `OverviewTab.jsx` (DRY)
**Estado:** ❌ NO RESUELTO
**Análisis:** El archivo tiene **código duplicado masivo**. Las líneas 240-288 (Bloque Vertical) y 294-342 (Bloque Horizontal) son idénticas en estructura y contenido, incluyendo la lógica de los gráficos. Solo cambia (posiblemente) el contenedor padre en base al hook de layout, pero esto debería manejarse con clases CSS condicionales, no duplicando todo el JSX.
**Acción:** Extraer el bloque de contenido a un componente `OverviewContent` o variable renderizble para eliminar ~100 líneas de código duplicado.

### B. Optimización de Gráficos (Rendimiento)
**Estado:** ⚠️ PARCIAL / MEJORABLE
**Análisis:** Los componentes `Line` y `Pie` de `react-chartjs-2` tienen la prop `redraw={true}` activada.
-   **Efecto:** Esto fuerza a Chart.js a destruir y recrear el canvas en cada renderizado, lo que causa parpadeos y alto uso de CPU.
-   **Acción:** Eliminar `redraw={true}` y permitir que la librería maneje las actualizaciones de datos de forma reactiva.

---

## 3. 📦 Análisis de Dependencias

-   **sql.js:** ✅ SE MANTIENE. Se ha verificado que `useDatabase.js` lo utiliza intensivamente para la importación/exportación de archivos `.db` (SQLite) y carga el WASM localmente. Es una dependencia necesaria.
-   **moment:** ✅ NO DETECTADO. Correcto.

---

## 4. 📝 Plan de Acción Recomendado (Siguientes Pasos)

1.  **Refactor OverviewTab:** Unificar los dos bloques `return` en uno solo.
2.  **Optimizar Charts:** Quitar `redraw={true}` y verificar que los gráficos se actualizan correctamente al cambiar pestañas.
3.  **Verificación Final:** Asegurar que no quedan más archivos `temp_` o `.bak` ocultos en subcarpetas.

---

**Conclusión:** El proyecto está estable en v1.6.3. El siguiente ciclo debería centrarse puramente en la **calidad del código** (Puntos 2A y 2B) antes de añadir nuevas funcionalidades.
