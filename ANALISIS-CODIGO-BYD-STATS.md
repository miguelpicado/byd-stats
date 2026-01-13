# Análisis técnico del repositorio BYD-STATS

**Autor del análisis**: Antigravity (Asistente de Desarrollo)  
**Fecha**: 8 de enero de 2026  
**Versión del proyecto analizada**: v1.1.0

---

## 1. Resumen ejecutivo

- **Estado general**: El proyecto está en una fase de madurez temprana con funcionalidad completa y estable. La versión 1.1.0 marca un hito importante con sincronización en la nube funcional.
- **⚠️ Riesgo crítico de mantenibilidad**: El archivo `App.jsx` contiene **2.884 líneas de código**, concentrando casi toda la lógica de la aplicación. Esto viola principios SOLID y dificulta futuros desarrollos.
- **Arquitectura sólida en componentes periféricos**: Los hooks (`useGoogleSync`, `useDatabase`), servicios (`googleDrive.js`) y contexto (`AppContext`) están bien estructurados y encapsulados.
- **CI/CD optimizado**: Flujos de GitHub Actions bien configurados con filtros de rutas, firma de APKs automatizada y despliegue inteligente.
- **Seguridad razonable**: Uso del scope `drive.appdata` para Google Drive limita el acceso solo a datos propios. Tokens almacenados en `localStorage` (estándar para SPAs).
- **Dependencias modernas**: React 19, Vite 7, Capacitor 8 - stack actualizado y bien elegido.
- **Sin tests automatizados**: No se detectan pruebas unitarias ni de integración en el repositorio.
- **Documentación abundante**: Múltiples archivos `.md` con guías de instalación, troubleshooting, y compilación Android.

---

## 2. Visión general del proyecto

### 2.1 Propósito funcional

BYD Stats es una herramienta de análisis de datos de conducción para vehículos eléctricos BYD. Permite:

1. **Cargar** el archivo `EC_Database.db` exportado del vehículo.
2. **Procesar** los datos localmente usando SQL.js (sin backend).
3. **Visualizar** estadísticas: kilometraje, consumo energético, eficiencia, patrones temporales.
4. **Sincronizar** opcionalmente con Google Drive para acceso multi-dispositivo.
5. **Funcionar offline** completamente - filosofía "local-first".

### 2.2 Casos de uso principales

| Actor | Caso de uso |
|-------|-------------|
| Propietario BYD | Cargar datos desde USB y analizar eficiencia |
| Usuario multi-dispositivo | Sincronizar datos entre teléfono y tablet |
| Usuario del navegador del coche | Usar la web directamente en el vehículo (workaround `.jpg`) |

### 2.3 Stack tecnológico

| Capa | Tecnología | Justificación |
|------|------------|---------------|
| **Frontend** | React 19.2 | Última versión estable, Concurrent Mode |
| **Build** | Vite 7.2 | HMR ultrarrápido, treeshaking óptimo |
| **Estilos** | Tailwind CSS 3.4 | Utility-first, productividad |
| **Gráficos** | Chart.js 4.5 + react-chartjs-2 | Rendimiento superior a Recharts |
| **DB Local** | SQL.js | SQLite compilado a WASM para navegador |
| **Móvil** | Capacitor 8 | Wrapper nativo moderno (reemplazo de Cordova) |
| **Auth (Web)** | @react-oauth/google | OAuth 2.0 popup flow |
| **Auth (Nativo)** | @capgo/capacitor-social-login | Google Sign-In nativo Android |

### 2.4 Diagrama de arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React/Vite)                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                         App.jsx (2884 líneas)                │   │
│  │   ⚠️ MONOLITO - Contiene: UI, lógica, estado, renderizado   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           │                    │                    │               │
│           ▼                    ▼                    ▼               │
│  ┌─────────────┐     ┌─────────────────┐    ┌──────────────────┐   │
│  │  Components │     │     Hooks       │    │    Context       │   │
│  │  (modals,   │     │ useGoogleSync   │    │   AppContext     │   │
│  │  cards, ui) │     │ useDatabase     │    │ (settings,layout)│   │
│  └─────────────┘     │ useLayoutMode   │    └──────────────────┘   │
│                      └────────┬────────┘                           │
│                               │                                     │
│                               ▼                                     │
│                      ┌─────────────────┐                           │
│                      │    Services     │                           │
│                      │  googleDrive.js │                           │
│                      └────────┬────────┘                           │
│                               │                                     │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│                      APIS EXTERNAS                                 │
│  ┌─────────────────┐              ┌────────────────────────────┐  │
│  │  Google OAuth   │              │  Google Drive API v3       │  │
│  │  (auth popup)   │              │  (appDataFolder scope)     │  │
│  └─────────────────┘              └────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                      PLATAFORMAS DE DESPLIEGUE                     │
│  ┌─────────────────┐              ┌────────────────────────────┐  │
│  │  GitHub Pages   │              │  APK Android (Capacitor)   │  │
│  │  bydstats.com   │              │  com.bydstats.app          │  │
│  └─────────────────┘              └────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## 3. Arquitectura y módulos

### 3.1 Estructura de carpetas

```
byd-stats/
├── .github/workflows/          # CI/CD (2 workflows activos)
│   ├── android-build.yml       # Build APK + Release en tags
│   └── deploy.yml              # Deploy web a GitHub Pages
├── android/                    # Proyecto Capacitor Android
│   └── app/build.gradle        # Config de firma y versión
├── public/                     # Assets estáticos
│   ├── legal/                  # Página legal estática
│   ├── privacidad/             # Página privacidad estática
│   └── assets/sql/             # Binarios SQL.js (WASM)
├── src/
│   ├── components/             # Componentes React
│   │   ├── cards/              # StatCard, ChartCard, TripCard
│   │   ├── charts/             # Wrappers de gráficos
│   │   ├── layout/             # Layout components
│   │   ├── modals/             # 7 modales (Settings, Filter, etc.)
│   │   ├── ui/                 # Componentes genéricos
│   │   ├── Icons.jsx           # Librería de iconos SVG (30+)
│   │   └── LegalContent.jsx    # Contenido legal/privacidad
│   ├── context/
│   │   └── AppContext.jsx      # Context API global (145 líneas)
│   ├── hooks/                  # Custom hooks (8 archivos)
│   │   ├── useDatabase.js      # Operaciones SQL.js
│   │   ├── useGoogleSync.js    # Auth + Sync con Drive
│   │   ├── useLayoutMode.js    # Detección de diseño adaptativo
│   │   └── useLocalStorage.js  # Persistencia local
│   ├── pages/
│   │   └── LegalPage.jsx       # Página completa de legal
│   ├── services/
│   │   └── googleDrive.js      # API Google Drive (207 líneas)
│   ├── utils/                  # Utilidades puras
│   │   ├── dataProcessing.js   # Procesamiento de datos (136 líneas)
│   │   ├── constants.js        # Constantes globales
│   │   ├── formatters.js       # Formateadores de datos
│   │   └── dateUtils.js        # Utilidades de fechas
│   ├── App.jsx                 # ⚠️ COMPONENTE MONOLÍTICO (2884 líneas)
│   └── main.jsx                # Entry point
├── capacitor.config.json       # Config Capacitor
├── package.json                # Dependencias npm
└── *.md                        # Documentación extensa
```

### 3.2 Patrones arquitectónicos detectados

| Patrón | Implementación | Estado |
|--------|----------------|--------|
| **Context API** | `AppContext.jsx` | ✅ Bien implementado |
| **Custom Hooks** | `hooks/` | ✅ Buena encapsulación |
| **Service Layer** | `googleDrive.js` | ✅ Separación de API calls |
| **Component Composition** | `components/` | ⚠️ Parcial (lógica en App.jsx) |
| **Lazy Loading** | Modales con `React.lazy()` | ✅ Implementado |
| **Local-First** | SQL.js + localStorage | ✅ Funcional |

### 3.3 Relación entre módulos

```
main.jsx
  └── GoogleOAuthProvider
        └── AppProvider (Context)
              └── App.jsx
                    ├── useDatabase()      → SQL.js operations
                    ├── useGoogleSync()    → googleDriveService
                    ├── useApp()           → Context values
                    ├── Landing Page       → (inline)
                    ├── Dashboard          → (inline, 1500+ líneas)
                    └── Modals (lazy)      → components/modals/*
```

---

## 4. Calidad de código

### 4.1 Estilo y consistencia

| Aspecto | Evaluación | Notas |
|---------|------------|-------|
| Formato | ✅ Consistente | Indentación estándar, comillas simples |
| Naming | ⚠️ Mixto | camelCase en general, algunos nombres muy largos |
| Comentarios | ⚠️ Escasos | Solo en funciones clave, faltan en App.jsx |
| JSDoc | ❌ Ausente | Solo en `useDatabase.js` y `dataProcessing.js` |

### 4.2 Principios SOLID

| Principio | Estado | Observaciones |
|-----------|--------|---------------|
| **S**ingle Responsibility | ❌ Violado | App.jsx hace demasiadas cosas |
| **O**pen/Closed | ⚠️ Parcial | Hooks son extensibles, App.jsx no |
| **L**iskov Substitution | N/A | No hay herencia de clases |
| **I**nterface Segregation | ⚠️ Parcial | Algunos hooks devuelven muchas cosas |
| **D**ependency Inversion | ✅ Cumplido | Hooks abstraen implementaciones |

### 4.3 Archivos de alta complejidad

| Archivo | Líneas | Complejidad | Riesgo |
|---------|--------|-------------|--------|
| `App.jsx` | 2884 | 🔴 Muy Alta | Crítico |
| `useGoogleSync.js` | 246 | 🟡 Media | Bajo |
| `SettingsModal.jsx` | ~400 | 🟡 Media | Bajo |
| `googleDrive.js` | 207 | 🟢 Baja | Bajo |

### 4.4 Manejo de errores

- **Implementado**: Try-catch en operaciones de DB, sync, y API calls.
- **Mejorable**: Falta un boundary de error global (`ErrorBoundary`).
- **Console.log abundantes**: Útiles para debug pero deberían limpiarse para producción.

### 4.5 Tests

> ⚠️ **No se detectan tests automatizados en el repositorio.**

No hay carpeta `__tests__`, archivos `*.test.js`, ni configuración de Jest/Vitest para testing.

---

## 5. Dependencias, build y CI/CD

### 5.1 Dependencias principales

```json
"dependencies": {
  "@capacitor/*": "^8.0.0",           // Wrapper nativo
  "@capgo/capacitor-social-login": "^8.2.11",  // Google Sign-In nativo
  "@react-oauth/google": "^0.13.4",   // OAuth web
  "chart.js": "^4.5.1",               // Gráficos
  "react": "^19.2.0",                 // Framework UI
  "sql.js": "^1.8.0"                  // SQLite en WASM (implícito via CDN)
}
```

### 5.2 Análisis de riesgos de dependencias

| Dependencia | Riesgo | Notas |
|-------------|--------|-------|
| `gapi-script` | 🟡 Medio | Librería legacy, considerar migrar a `google-auth-library` |
| `sql.js` (CDN) | 🟢 Bajo | Cargado dinámicamente desde `/assets/sql/` |
| React 19 | 🟢 Bajo | Versión estable reciente |
| Capacitor 8 | 🟢 Bajo | Versión actual |

### 5.3 Scripts de build

```json
"scripts": {
  "dev": "vite",                     // Desarrollo local
  "build": "vite build",             // Build producción
  "deploy": "gh-pages -d dist",      // Deploy web manual
  "android:build": "...",            // Build APK local
  "android:release": "..."           // Build Release APK
}
```

### 5.4 CI/CD (GitHub Actions)

#### `android-build.yml`
- **Trigger**: Push a main/master/develop, tags `v*`, PRs
- **Optimización**: `paths-ignore` para saltar builds en cambios de docs
- **Firma**: Usa `debug.keystore` compartido para consistencia de SHA-1
- **Artefactos**: `BYD-Stats-debug.apk`, `BYD-Stats-release.apk`
- **Release automático**: Crea GitHub Release al pushear tags `v*`

#### `deploy.yml`
- **Trigger**: Push a main con cambios en `src/`, `public/`, etc.
- **Destino**: GitHub Pages (bydstats.com)

---

## 6. Diseño de datos y APIs

### 6.1 Modelo de datos principal: Trip

```javascript
// Esquema implícito de un viaje (desde EC_Database.db)
{
  id: number,
  trip: number,           // Distancia en km
  electricity: number,    // Consumo en kWh
  duration: number,       // Duración en segundos
  date: string,           // "YYYY-MM-DD"
  start_timestamp: number,// Unix timestamp
  month: string,          // "YYYY-MM"
  is_deleted: number      // 0 = activo
}
```

### 6.2 Almacenamiento

| Tipo | Key | Contenido |
|------|-----|-----------|
| localStorage | `byd_stats_data` | Array de trips |
| localStorage | `byd_settings` | Configuración del usuario |
| localStorage | `google_access_token` | Token OAuth temporal |
| Google Drive | `byd_stats_data.json` | Sync data (trips + settings) |

### 6.3 Integraciones externas

| API | Endpoint | Scope | Uso |
|-----|----------|-------|-----|
| Google OAuth | `accounts.google.com` | `email`, `profile` | Autenticación |
| Google Drive v3 | `www.googleapis.com/drive/v3` | `drive.appdata` | Sync en carpeta oculta |

### 6.4 Evaluación de seguridad

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Tokens en localStorage | ⚠️ Estándar SPA | Vulnerable a XSS (inherente) |
| Client ID hardcoded | ⚠️ Visible | Normal para apps públicas OAuth |
| Scope mínimo | ✅ Correcto | `drive.appdata` no accede a archivos del usuario |
| HTTPS enforced | ✅ | Capacitor usa `androidScheme: "https"` |
| Secrets en repo | ✅ No detectados | Keystores gestionados via env vars |

> **⚠️ Riesgo de seguridad menor**: El Client ID de Google está hardcodeado en `useGoogleSync.js` (línea 189). Aunque esto es normal para OAuth público, debería moverse a una variable de entorno para mayor flexibilidad.

---

## 7. Rendimiento y escalabilidad

### 7.1 Puntos de rendimiento identificados

| Área | Estado | Impacto |
|------|--------|---------|
| Bundle size | ⚠️ A evaluar | `App.jsx` de 2884 líneas impide tree-shaking óptimo |
| SQL.js carga | 🟡 Medio | WASM cargado via CDN (~1MB), asíncrono |
| Re-renders | ⚠️ Posible | Falta `useMemo`/`useCallback` en zonas de App.jsx |
| Lazy loading | ✅ Implementado | Modales cargados bajo demanda |
| Imágenes | ✅ Mínimas | Solo iconos SVG inline |

### 7.2 Recomendaciones de optimización

1. **Dividir `App.jsx`**: Extraer Dashboard, Landing, TabNavigation a componentes separados.
2. **Memoización**: Añadir `useMemo` a cálculos de estadísticas derivadas.
3. **Virtualización**: Si el historial crece mucho, usar `react-window` para listas.
4. **Web Workers**: Mover procesamiento de DB a un Worker para no bloquear UI.

---

## 8. Roadmap técnico recomendado

### 8.1 Corto plazo (1-2 días de trabajo)

| # | Objetivo | Ficheros | Riesgo | Dificultad |
|---|----------|----------|--------|------------|
| 1 | Mover Client ID a `.env` | `useGoogleSync.js`, `.env.example` | Bajo | Baja |
| 2 | Añadir ErrorBoundary global | `main.jsx`, nuevo `ErrorBoundary.jsx` | Bajo | Baja |
| 3 | Limpiar console.logs | Todos los archivos | Bajo | Baja |
| 4 | Añadir README badge de tests (placeholder) | `README.md` | Bajo | Baja |

### 8.2 Medio plazo (1-2 semanas)

| # | Objetivo | Ficheros | Riesgo | Dificultad |
|---|----------|----------|--------|------------|
| 5 | Extraer `Dashboard.jsx` de `App.jsx` | `App.jsx`, nuevo `Dashboard.jsx` | Medio | Media |
| 6 | Extraer `LandingPage.jsx` de `App.jsx` | `App.jsx`, nuevo `LandingPage.jsx` | Bajo | Media |
| 7 | Crear tests unitarios para hooks | `hooks/*.test.js` | Bajo | Media |
| 8 | Migrar `gapi-script` a auth moderna | `googleDrive.js` | Medio | Media |
| 9 | Añadir Prettier + config compartida | `.prettierrc`, `package.json` | Bajo | Baja |

### 8.3 Largo plazo (1-3 meses)

| # | Objetivo | Ficheros | Riesgo | Dificultad |
|---|----------|----------|--------|------------|
| 10 | Migración a TypeScript | Todos | Alto | Alta |
| 11 | Implementar PWA con Service Worker | `vite.config.js`, `sw.js` | Medio | Media |
| 12 | Añadir i18n (español/inglés) | Todos los componentes | Medio | Alta |
| 13 | Refactor completo de App.jsx (< 500 líneas) | Múltiples nuevos archivos | Alto | Alta |
| 14 | Implementar tests E2E con Playwright | `tests/`, GitHub Actions | Medio | Alta |

---

## 9. Anexos

### 9.1 Archivos especialmente relevantes

| Archivo | Razón |
|---------|-------|
| `src/App.jsx` | Núcleo de la aplicación (requiere refactor) |
| `src/hooks/useGoogleSync.js` | Lógica de autenticación multiplataforma |
| `src/services/googleDrive.js` | API de sincronización con Drive |
| `android/app/build.gradle` | Configuración de firma Android |
| `.github/workflows/android-build.yml` | CI/CD completo |

### 9.2 Notas sobre módulos complejos

#### `App.jsx` - Análisis detallado

El archivo contiene:
- **Líneas 1-53**: Imports y lazy loading de modales ✅
- **Líneas 54-179**: `processData()` - Debería estar en `utils/` ⚠️
- **Líneas 181-206**: Helpers de score - Deberían estar en `utils/` ⚠️
- **Líneas 210-2883**: `BYDStatsAnalyzer` - Componente monolítico 🔴

Dentro del componente hay:
- ~30 `useState` hooks
- ~20 `useCallback` hooks
- ~500 líneas de JSX para Landing Page
- ~1000 líneas de JSX para Dashboard
- ~300 líneas de configuración de gráficos

**Recomendación**: Extraer en fases:
1. `LandingPage.jsx` (~500 líneas)
2. `Dashboard.jsx` (~1200 líneas)
3. `ChartConfigs.js` (~300 líneas)
4. Mover `processData` y helpers a `utils/`

### 9.3 Limitaciones del análisis

Este análisis se realizó mediante inspección de código fuente sin:
- Ejecución de la aplicación
- Análisis de bundle size real
- Profiling de rendimiento en runtime
- Auditoría de seguridad exhaustiva

Se recomienda complementar con:
- Lighthouse audit
- `npm audit` para vulnerabilidades
- Pruebas manuales en dispositivos reales

---

## 10. Conclusión

BYD Stats es un proyecto bien concebido con una base sólida en sus módulos periféricos (hooks, servicios, contexto) pero con una deuda técnica significativa concentrada en `App.jsx`. Las prioridades para el próximo ciclo de desarrollo deberían ser:

1. **Inmediato**: Añadir ErrorBoundary y mover Client ID a .env
2. **Crítico**: Dividir `App.jsx` en componentes manejables
3. **Importante**: Establecer cobertura de tests básica

El stack tecnológico elegido (React 19, Vite, Capacitor) es moderno y apropiado para el caso de uso. La decisión de usar `drive.appdata` para sincronización es acertada desde el punto de vista de privacidad.

---

*Documento generado automáticamente por Antigravity Assistant*
