# Auditoría de Calidad y Pulido Final (Rama PremiumAPK)
**Fecha:** 3 de marzo de 2026
**Scope:** Rama `PremiumAPK`

---

## 1. 🔐 Seguridad y Vulnerabilidades

### Hallazgo 1.1: Vulnerabilidades transitivas en dependencias
- **Área:** Seguridad | **Severidad: 🟡 Medio**
- **Archivo/Ubicación:** `package.json` (frontend / monorepo)
- **Descripción:** Múltiples vulnerabilidades (12 Altas, 2 Moderadas) detectadas vía `npm audit` en el árbol de dependencias, principalmente en `tar`, `@rollup/plugin-terser`, `serialize-javascript` y `minimatch` que se introducen a través de `@capacitor/cli` y `vite-plugin-pwa`.
- **Impacto:** Riesgo en el pipeline de CI/CD (Path Traversal, ReDoS y RCE), aunque el riesgo en la app de producción final es casi nulo (son herramientas de compilación).
- **Solución propuesta:** Forzar la resolución de dependencias añadiendo un bloque `"overrides"` en el `package.json` para parchear las dependencias transitivas.
- **Esfuerzo estimado:** Medio

### Hallazgo 1.2: Intent Filters no estrictos en Android
- **Área:** Seguridad | **Severidad: 🟢 Bajo**
- **Archivo/Ubicación:** `android/app/src/main/AndroidManifest.xml` (Línea 21)
- **Descripción:** Existen Intent Filters genéricos para esquemas de visualización y de compartir (`VIEW`, `SEND`) que confían únicamente en el MIME Type.
- **Impacto:** Aplicaciones maliciosas podrían intentar envenenar los datos de la app pasándole bases de datos SQLite malformadas o payloads JSON maliciosos.
- **Solución propuesta:** Asegurar una capa de validación estricta (Zod Schema) en la lógica JS que procesa los "Deep Links / File intents".
- **Esfuerzo estimado:** Bajo

---

## 2. 🧹 Calidad y Limpieza de Código

### Hallazgo 2.1: Inicialización síncrona de estado en Efectos (Cascading Renders)
- **Área:** Calidad | **Severidad: 🟡 Medio**
- **Archivo/Ubicación:** `src/hooks/useChargesData.ts`, `src/hooks/useTrips.ts`, `src/hooks/useVehicleStatus.ts`, `src/hooks/useTabNavigation.ts`
- **Descripción:** Se llama a `setState([])` o a valores por defecto sincrónicamente dentro de `useEffect`, provocando violaciones de `react-hooks/set-state-in-effect`.
- **Impacto:** Degradación de rendimiento. React se ve forzado a repintar dos veces (Cascading Render).
- **Solución propuesta:** Usar *Lazy Initialization* en `useState(() => inicializacion())` o derivar los valores de forma directa durante el primer ciclo de renderizado.
- **Esfuerzo estimado:** Medio

### Hallazgo 2.2: Riesgos de Closures y Refs mutables
- **Área:** Calidad | **Severidad: 🟡 Medio**
- **Archivo/Ubicación:** `src/hooks/useAppData.ts`, `src/hooks/useGoogleSync.ts`
- **Descripción:** Hooks con arrays de dependencias incompletos (violaciones de `exhaustive-deps`) e intentos de rastrear mutaciones en referencias mutables (`ref.current` añadido erróneamente en el array de un `useEffect`).
- **Impacto:** Componentes que no reaccionarán correctamente ante cambios o bucles de render en casos borde.
- **Solución propuesta:** Reestructurar los arrays de dependencias para cumplir con las directivas del Linter.
- **Esfuerzo estimado:** Medio

---

## 3. 🐛 Bugs y Errores Potenciales

### Hallazgo 3.1: Efectos estancados (Stale Effects)
- **Área:** Bugs | **Severidad: 🟠 Alto**
- **Archivo/Ubicación:** `src/hooks/useMergedTrips.ts`, `src/hooks/useProcessedData.ts`
- **Descripción:** `useEffect` en lógica *core* carece de dependencias críticas como `serverDateRange` o métodos de recálculo en su array de dependencias.
- **Impacto:** Si la fecha del servidor cambia tras la primera carga, los cálculos del viaje no se refrescarán (datos "estancados").
- **Solución propuesta:** Identificar todas las dependencias reclamadas por el compilador, envolver los manejadores en `useCallback` e incluirlas en los arrays pertinentes.
- **Esfuerzo estimado:** Alto

---

## 4. ⚡ Optimizaciones de Rendimiento

### Hallazgo 4.1: Bundle JS gigante ralentizando Webview
- **Área:** Rendimiento | **Severidad: 🟡 Medio**
- **Archivo/Ubicación:** `vite.config.ts` (Build system)
- **Descripción:** El chunk de JS compilado pesa **945.67 kB**, lo cual provoca lentitud en el *parse and compile* del navegador móvil en frío.
- **Impacto:** Alto "Time To Interactive" (TTI). La UI puede tardar en responder unos segundos en un Android de gama baja.
- **Solución propuesta:** Implementar Code Splitting manual (`manualChunks`) en Vite para dividir vendor libs grandes (Firebase, Chart.js, React).
- **Esfuerzo estimado:** Bajo

---

## 5. 🏗️ Arquitectura y Estructura del Repo

### Hallazgo 5.1: Desajuste de Typescript vs JavaScript puro
- **Área:** Arquitectura | **Severidad: 🟢 Bajo**
- **Archivo/Ubicación:** `playwright.config.js` y configuraciones raíz.
- **Descripción:** Ficheros `.js` lanzando falsos positivos en el linter porque `'process' is not defined`.
- **Impacto:** Molestia visual y posible inconsistencia.
- **Solución propuesta:** Añadir `env: { node: true }` a la config de ESLint o migrar `playwright.config` a TS.
- **Esfuerzo estimado:** Bajo

---

## 6. 📦 Dependencias y Build

### Hallazgo 6.1: Código nativo de Cordova legacy
- **Área:** Dependencias | **Severidad: 🟢 Bajo**
- **Archivo/Ubicación:** `android/app/capacitor.build.gradle`
- **Descripción:** Sigue existiendo la referencia `apply from: "../capacitor-cordova-android-plugins/cordova.variables.gradle"`.
- **Impacto:** Tiempo de build ligeramente incrementado.
- **Solución propuesta:** Eliminar si el ecosistema está ya 100% basado en Capacitor V8 y no existen plugins nativos de Cordova en el paquete.
- **Esfuerzo estimado:** Bajo

---

## 7. 📋 Documentación y Mantenibilidad

### Hallazgo 7.1: Flujo de datos oculto o implícito
- **Área:** Documentación | **Severidad: 🟡 Medio**
- **Archivo/Ubicación:** `src/hooks/useAppData.ts`
- **Descripción:** Este fichero es el "cerebro" orquestador de datos pero carece de un bloque de arquitectura explicando el flujo de caché (Firestore -> LocalStorage -> RAM -> Context).
- **Impacto:** Onboarding complejo para nuevos desarrolladores que toquen el núcleo de la App.
- **Solución propuesta:** Añadir un Diagrama o JSDoc generoso en la cabecera.
- **Esfuerzo estimado:** Medio

---

## 📊 Resumen Ejecutivo

### Total de Hallazgos

| Área | 🔴 Crítico | 🟠 Alto | 🟡 Medio | 🟢 Bajo | Total |
|---|:---:|:---:|:---:|:---:|:---:|
| 1. Seguridad | 0 | 0 | 1 | 1 | **2** |
| 2. Calidad de Código | 0 | 0 | 2 | 0 | **2** |
| 3. Bugs y Errores | 0 | 1 | 0 | 0 | **1** |
| 4. Rendimiento | 0 | 0 | 1 | 0 | **1** |
| 5. Arquitectura | 0 | 0 | 0 | 1 | **1** |
| 6. Dependencias | 0 | 0 | 0 | 1 | **1** |
| 7. Documentación | 0 | 0 | 1 | 0 | **1** |
| **TOTALES** | **0** | **1** | **5** | **3** | **9** |

### 📈 Estimación Global de Salud: 88/100
El core está sólido tras eliminar las vulnerabilidades críticas de la sesión de trabajo previa. Este reporte subraya únicamente la "deuda técnica" centrada en React Hooks y optimizaciones avanzadas de bundler (Vite chunks), lo que empuja el proyecto a una fase madura y robusta, lista para QA.