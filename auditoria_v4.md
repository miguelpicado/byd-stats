# 🕵️ Auditoría de Código y Plan de Optimización V4

> **Fecha:** 28 de Enero de 2026
> **Estado:** Fase de Limpieza y Consolidación
> **Objetivo:** Eliminar deuda técnica, reducir tamaño del bundle y unificar lógica de presentación.

---

## 1. 🧹 Limpieza de Archivos (Impacto Inmediato)

Se han detectado múltiples archivos temporales, copias de seguridad antiguas y recursos por defecto de la plantilla que ya no son necesarios. **Acción recomendada: Eliminar.**

### 🗑️ Archivos Temporales (Root)
Estos archivos parecen ser restos de un refactor anterior (probablemente "temp" significa *temporary* durante una migración).
-   `temp_processing_main.js` (13.9 KB)
-   `temp_settings_main.jsx` (26.4 KB)
-   `temp_useAppData_main.js` (7.2 KB)

### 📦 Archivos de Respaldo y Documentación Obsoleta
-   `public/manifest.json.bak`
-   `public/sw.js.bak`
-   `src/auditoria_v3.md` (Este documento reemplazará al v3)

### 🖼️ Recursos No Usados
-   `src/assets/react.svg` (Logo por defecto de Vite/React)
-   `public/vite.svg`

---

## 2. ⚡ Optimizaciones de Código

### A. Refactorización de `OverviewTab.jsx` (DRY - Don't Repeat Yourself)
**Problema:** El componente tiene dos bloques de renderizado masivos (`if (isVertical) ... return` y el return por defecto) que duplican el código de las *StatCards*. Si mañana quieres cambiar un icono o añadir una nueva métrica, tienes que hacerlo en dos sitios.
**Solución:**
Crear un array de configuración para las tarjetas o extraer el grid de tarjetas a un componente `StatsGrid`:

```jsx
// Ejemplo conceptual
const statsConfig = [
  { key: 'distance', icon: MapPin, label: t('stats.distance'), ... },
  { key: 'energy', icon: Zap, label: t('stats.energy'), ... },
  // ...
];

// En el render:
<div className={`grid ...`}>
  {statsConfig.map(stat => (
     <StatCard ... isVerticalMode={isVertical} />
  ))}
</div>
```
**Impacto:** Reduce el tamaño del archivo en ~200 líneas y facilita el mantenimiento.

### B. Centralización de Lógica "Stationary"
**Problema:** Hemos tenido que parchear `TripInsightsModal` para que use la misma lógica que `dataProcessing.js` para los viajes de 0km.
**Solución:**
Exportar la lógica de "es estacionario" a una función utilitaria en `dataProcessing.js` y usarla en ambos sitios.
```javascript
export const isStationaryTrip = (trip) => (trip.trip || 0) < 0.5;
```
**Impacto:** Garantiza consistencia matemática absoluta entre el Dashboard y los Modales.

---

## 3. 🚀 Mejoras de Rendimiento

### A. Gestión de Gráficos (Chart.js)
**Observación:** Los gráficos tienen una `key` dinámica (`key={overview-line-v-${isActive}}`).
**Efecto:** Cada vez que cambias de pestaña y vuelves, el gráfico se **destruye y se vuelve a crear** desde cero.
**Recomendación:** Si el usuario nota "lag" al cambiar de pestañas, se puede quitar la key dinámica para que React preserve la instancia del canvas. Si la animación de entrada es deseada, dejarlo como está es correcto, pero tiene un coste de CPU.

### B. Code Splitting (Lazy Loading)
**Observación:** Importamos `Chart.js` y `Maps` (si los hubiera) en el bundle principal.
**Recomendación:** Usar `React.lazy` para los componentes pesados que no son visibles de inmediato (ej. Modales grandes o pestañas secundarias).
-   `TripInsightsModal` ya se carga bajo demanda (conditional rendering), lo cual es bueno.
-   `OverviewTab` podría cargarse con Lazy si la app crece mucho.

---

## 4. 📦 Análisis de Dependencias

Revisión rápida de `package.json`:
-   `sql.js`: ¿Se está usando? Si la persistencia es `localStorage` + JSON en Google Drive, esta librería (que suele ser pesada porque incluye WASM) podría sobrar.
-   `moment`: **No detectado**. ¡Excelente noticia! El uso de `date-fns` o funciones nativas es mucho más ligero.

---

## 📝 Plan de Ejecución Sugerido

1.  **Ejecutar limpieza**: Borrar los archivos listados en el punto 1.
2.  **Refactorizar Overview**: Unificar el renderizado de `OverviewTab.jsx`.
3.  **Consolidar Utils**: Crear el helper `isStationaryTrip`.
