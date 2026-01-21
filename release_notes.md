# Release Notes v1.5.0

## 🚀 Mejoras Principales

### 🏗️ Arquitectura y Refactorización (Fase 1 & 2)
- **Sistema de Providers**: Creación de `AppProviders` para gestionar contextos globales (`AuthProvider`, `DataProvider`, `ThemeManager`) de forma centralizada y limpia.
- **Modularización**: 
  - Separación de `App.jsx` en componentes más pequeños (`AppRoutes`, `LandingPage`).
  - Implementación de Hooks personalizados (`useChargeImporter`, `useGoogleSync`, `useDatabase`).
  - Configuración de **Path Aliases** (`@components`, `@hooks`, `@utils`) para importaciones más limpias.
- **Lazy Loading**: Code splitting para `AllTripsView`, `AllChargesView` y `ModalCoordinator`, reduciendo el bundle inicial.

### ⚡ Rendimiento y Optimización (Fase 3 & 4)
- **Data Processing**: Algoritmos estadísticos optimizados (O(N)) para cálculos rápidos.
- **Renderizado Eficiente**: Uso estratégico de `React.memo` en gráficos y listas virtualizadas (`@tanstack/react-virtual` revisado).
- **Bundle Split**: Separación de dependencias grandes (Chart.js, Firebase) en chunks individuales.
- **Compresión**: Implementación de Gzip/Brotli (`vite-plugin-compression`).

### 📱 PWA y Experiencia Móvil (Fase 5)
- **Soporte Offline**: Service Worker funcional con estrategia Cache-First.
- **UX Mejorada**:
  - Corrección de animaciones de gráficos en cambios de pestaña.
  - Gestión de actualizaciones de la App (`PWAManager` y `virtual:pwa-register`).
  - Solución a la superposición del tema claro/oscuro en Android (Barra de estado).

### 🛡️ Calidad y Testing (Fase 6)
- **Infraestructura de Tests**:
  - **Unit**: Configuración de Vitest con cobertura para `DataProvider` y utilidades.
  - **E2E**: Setup de Playwright con Smoke Tests para verificar despliegues.
- **Robustez**: Verificación de conectividad (`navigator.onLine`) en sincronización.
- **CI/CD**: Preparación para pipelines automatizados.

## 🐛 Correcciones y Ajustes
- Solución al problema de carga de SQL.js (`wasm` loading).
- Fix de accesibilidad en botón de carga de archivos.
- Unificación de estilos y constantes.
- Eliminación de código muerto y dependencias obsoletas (`react-window` reemplazado/eliminado).
