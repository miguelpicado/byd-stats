# Plan de Implementación Final (PremiumAPK - Fase de Pulido)
**Fecha:** 3 de marzo de 2026
**Objetivo:** Resolver los hallazgos de la última auditoría centrados en rendimiento (renders, build chunks) y advertencias estrictas de Linting (React Hooks).
**Uso:** Este documento es autocontenido. Cualquier LLM puede aplicar estas soluciones secuencialmente.

---

## Fase 1: Optimización de Rendimiento (Cascading Renders) (Prioridad 1)
**Objetivo:** Eliminar los antipatrones `setState-in-effect` que degradan el rendimiento por repintados innecesarios en la PWA y la App nativa.

### 1.1 Eliminar SetState sincrónico en Inicializadores
- **Archivos Afectados:** 
  1. `src/hooks/useChargesData.ts` (Línea ~67)
  2. `src/hooks/useTrips.ts` (Línea ~27 y ~36)
  3. `src/hooks/useVehicleStatus.ts` (Línea ~116)
  4. `src/hooks/useTabNavigation.ts` (Línea ~135)
- **Acción:** Mover las condiciones iniciales del `useEffect` directo al estado base (`useState(initialValue)`), o usar un retorno anticipado (return early) sin mutar estado inútilmente.
- **Código a implementar (Ejemplo generalizado para `useChargesData` y `useTrips`):**
  ```typescript
  // ANTES:
  const [charges, setCharges] = useState<Charge[]>([]);
  useEffect(() => {
      if (!storageKey) {
          setCharges([]);
          return;
      }
      // ... load data
  }, [storageKey]);

  // DESPUÉS: Inicialización Perezosa (Lazy Initialization)
  const [charges, setCharges] = useState<Charge[]>(() => {
      if (!storageKey) return [];
      return StorageService.get<Charge[]>(storageKey, []);
  });

  useEffect(() => {
      if (!storageKey) return; // Ya está inicializado vacío
      const loaded = StorageService.get<Charge[]>(storageKey, []);
      setCharges(loaded);
  }, [storageKey]);
  ```

### 1.2 Tabs Fallback (useTabNavigation)
- **Archivo:** `src/hooks/useTabNavigation.ts`
- **Acción:** Evitar actualizar `activeTab` si el valor es falso dentro del effect. Si no es válido, devolver el "fallback" directamente en la lectura, o en la validación inicial.

---

## Fase 2: Robustez en los React Hooks y Closures (Prioridad 2)
**Objetivo:** Corregir todos los *exhaustive-deps* para asegurar que la app reacciona correctamente a cambios en filtros, cachés de AI y fechas.

### 2.1 Arrays de Dependencias Críticos
- **Archivos Afectados:**
  1. `src/hooks/useMergedTrips.ts`
  2. `src/hooks/useProcessedData.ts`
  3. `src/hooks/useAppData.ts`
- **Acción:**
  El linter indicó que faltaban variables.
  En `useMergedTrips.ts`, añadir al final del Array del `useEffect`: `latestTrips.length, loadMore, recalculateAutonomy, serverDateRange`.
  Si alguna de estas (como `recalculateAutonomy`) es una función, debe ser envuelta previamente en `useCallback` en el nivel superior para evitar bucles infinitos.

### 2.2 Mutación Inmutable en Refs
- **Archivo:** `src/hooks/useGoogleSync.ts` (Línea ~129)
- **Problema:** `onLoginSuccessCallback.current = handleLoginLink;` es detectado como mutación insegura del valor de retorno.
- **Acción:** El hook probablemente devuelve la referencia entera `onLoginSuccessCallback`. No se debe mutar el `.current` dentro del array de dependencias. 
- **Código a implementar:**
  ```typescript
  // Simplemente remover onLoginSuccessCallback del array de dependencias de ese useEffect,
  // ya que los Refs de React no necesitan rastrearse (su identidad nunca cambia).
  useEffect(() => {
      onLoginSuccessCallback.current = handleLoginLink;
  }, [checkAndPromptRegistry, performSync, localTrips.length, localCharges.length]); // Quitado el ref
  ```

---

## Fase 3: Optimización del Empaquetado (Vite Chunks) (Prioridad 3)
**Objetivo:** Dividir el "bundle" mastodóntico de Vite (> 945 kB) para acelerar el parseo del dispositivo Android y reducir el Time To Interactive.

### 3.1 Vite Manual Chunks
- **Archivo:** `vite.config.ts`
- **Acción:** Añadir lógicas de división en el apartado de build dentro de `vite.config.ts`.
- **Código a implementar:**
  ```typescript
  export default defineConfig({
    // ...resto de la configuración
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Empaquetar React y su ecosistema
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            // Empaquetar Firebase (Suele pesar 200-300kb)
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'vendor-firebase';
            }
            // Empaquetar Chart.js (Muy pesado)
            if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) {
              return 'vendor-charts';
            }
            // Empaquetar las utilidades de SQL local
            if (id.includes('node_modules/sql.js')) {
              return 'vendor-sqlite';
            }
          }
        }
      }
    }
  });
  ```

---

## Fase 4: Vulnerabilidades Transitivas y Deep Links (Prioridad 4)
**Objetivo:** Eliminar alertas de seguridad en los pipelines de npm y securizar la entrada de datos por intenciones.

### 4.1 Sobreescribir Dependencias en NPM (Overrides)
- **Archivo:** `package.json`
- **Acción:** Forzar resoluciones seguras añadiendo `overrides` (ya que estamos en npm) para mitigar las 12 vulnerabilidades altas (Tar, Rollup, etc.).
- **Código a añadir a la raíz de `package.json`:**
  ```json
  "overrides": {
    "tar": ">=7.5.8",
    "rollup": ">=4.59.0",
    "serialize-javascript": ">=7.0.3",
    "ajv": ">=8.18.0",
    "minimatch": ">=10.2.3"
  }
  ```
  *Nota: Tras añadir esto, el agente debe ejecutar `npm install` (y limpiar el cache si es necesario).*

### 4.2 Sanitización Zod en Archivos (Checklist Visual)
- **Archivo:** Lógica responsable del DeepLinking o File Picking (Ej: `useFileHandling.tsx` o `DatabaseUploadModal`).
- **Acción:** Asegurarse de que el parseo de CSV o JSON externo se lance SIEMPRE contra un esquema rígido (`z.object({...}).safeParse()`) antes de actualizar estados globales para prevenir envenenamiento de los almacenes por un *Share Intent* malicioso.

---
**Instrucción Final para el LLM Ejecutor:** Inicia resolviendo la **Fase 1**, modificando los estados para hacer *Lazy Initialization*. Acto seguido, repara los `exhaustive-deps` de la **Fase 2**. Finaliza el trabajo modificando el `vite.config.ts` (**Fase 3**) e inyectando los overrides en el `package.json` (**Fase 4**). Ejecuta `npm run build` y `npm run test` tras el cambio de Vite para asegurar que el Chunking es exitoso.