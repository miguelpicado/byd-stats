# Auditoría de Seguridad y Calidad (Rama PremiumAPK)
**Fecha:** 3 de marzo de 2026
**Scope:** Rama `PremiumAPK`

---

## 1. 🔐 Seguridad y Vulnerabilidades

### Hallazgo 1.1: Fuga de datos sensibles en logs (Data Leakage)
- **Área:** Seguridad | **Severidad: 🟠 Alto**
- **Archivo/Ubicación:** `functions/src/byd/client.ts` (líneas 378, 441, etc.) y `mqtt-listener/src/index.ts`
- **Descripción:** Uso excesivo de `console.log` en producción que vuelca objetos completos (`JSON.stringify(response)`). Estos objetos pueden contener PII (Identificación Personal), tokens de sesión activos de BYD y el VIN de los vehículos, que terminarían registrados en texto plano en Google Cloud Logging.
- **Impacto:** Fuga de datos sensibles (Data Leakage), violando regulaciones de privacidad (GDPR) y exponiendo sesiones de usuarios a cualquier administrador con acceso a los logs.
- **Solución propuesta:** Reemplazar los `console.log` por una librería de logging estructurado (p.ej., `winston` o el `logger` de Firebase V2) controlada por niveles (`debug`, `info`, `warn`, `error`). Ocultar los logs de payload completo detrás de una bandera de entorno `process.env.DEBUG === 'true'`.
- **Esfuerzo estimado:** Medio

### Hallazgo 1.2: Fuga de información criptográfica en logs
- **Área:** Seguridad | **Severidad: 🟠 Alto**
- **Archivo/Ubicación:** `functions/src/byd/crypto.ts` (línea 98)
- **Descripción:** Imprime la longitud de contraseñas de los usuarios y hashes intermedios: `console.log('[pwdLoginKey] password length: ... firstHash: ...')`.
- **Impacto:** Fuga de información criptográfica en los logs del servidor. Ayuda a vectores de ataque de fuerza bruta.
- **Solución propuesta:** Eliminar inmediatamente el registro en log de cualquier detalle relacionado con contraseñas, longitudes o hashes.
- **Esfuerzo estimado:** Bajo

### Hallazgo 1.3: Almacenamiento inseguro de tokens OAuth
- **Área:** Seguridad | **Severidad: 🟡 Medio**
- **Archivo/Ubicación:** `src/utils/secureStorage.ts` y `src/hooks/sync/useGoogleAuth.ts`
- **Descripción:** Los tokens de OAuth (Drive) se almacenan en `localStorage`. Aunque se intenta ofuscar con `AES-GCM` usando una clave derivada de una "device salt" hardcodeada (`'byd-stats-v2-' + deviceSalt`), esto es *seguridad por oscuridad*. Además, hay fallbacks donde se interactúa directo con `localStorage.setItem('google_access_token', ...)`.
- **Impacto:** Si la PWA sufre un ataque XSS, los tokens pueden ser extraídos fácilmente realizando ingeniería inversa de la ofuscación en JS.
- **Solución propuesta:** Para el entorno Android/Capacitor nativo, usar el plugin `@capacitor/secure-storage` (Keystore de Android). Para la web PWA, mantener la ofuscación pero con `HttpOnly` cookies si fuese posible migrar, o limitar el scope y tiempo de vida del token OAuth.
- **Esfuerzo estimado:** Alto

### Hallazgo 1.4: Configuración de red laxa (Cleartext Traffic)
- **Área:** Seguridad | **Severidad: 🟡 Medio**
- **Archivo/Ubicación:** `android/app/src/main/res/xml/network_security_config.xml` (Líneas 10-12)
- **Descripción:** `cleartextTrafficPermitted="true"` habilitado para `localhost` y `10.0.2.2`.
- **Impacto:** Aunque está acotado a IPs locales (necesario para el Live Reload de Capacitor), en una app de producción esto no debería estar habilitado.
- **Solución propuesta:** Crear un archivo de configuración de seguridad de red separado para la build de release, desactivando totalmente el tráfico en texto plano.
- **Esfuerzo estimado:** Bajo

---

## 2. 🧹 Calidad y Limpieza de Código

### Hallazgo 2.1: Deuda técnica acumulada (TODO/FIXME)
- **Área:** Calidad | **Severidad: 🟡 Medio**
- **Archivo/Ubicación:** Todo el repositorio (más de 60 instancias de TODO/FIXME detectadas).
- **Descripción:** Deuda técnica esparcida, especialmente en cálculos de batería (`batteryCalculations.ts`) y detectores de carga (`useAutoChargeDetection.ts`). También hay TODOs embebidos en el minificado `sql-wasm.min.js`.
- **Impacto:** Reducción de la legibilidad. Lógica base (core) potencialmente incompleta.
- **Solución propuesta:** Migrar estos comentarios a tickets formales (Issues) y limpiar los comentarios del código para evitar confusión.
- **Esfuerzo estimado:** Medio

### Hallazgo 2.2: Lógica de extracción de tokens frágil
- **Área:** Calidad | **Severidad: 🟡 Medio**
- **Archivo/Ubicación:** `src/hooks/sync/useGoogleAuth.ts` (Líneas 120-139)
- **Descripción:** Estructura super-anidada y poco limpia para extraer el token OAuth del plugin nativo (`getTokenString(resultAccessToken) || getTokenString(resultObj?.accessToken) ...`).
- **Impacto:** Código frágil (Violación de KISS/Clean Code). Una actualización del plugin lo romperá fácilmente.
- **Solución propuesta:** Tipar correctamente el objeto `result` devuelto por el plugin `@capacitor-firebase/authentication` usando un DTO o interfaz estricta (Zod Schema), en lugar de encadenar 6 condiciones `OR`.
- **Esfuerzo estimado:** Bajo

---

## 3. 🐛 Bugs y Errores Potenciales

### Hallazgo 3.1: Captura de error vacía (Silent Failure) en Logout
- **Área:** Bugs | **Severidad: 🟠 Alto**
- **Archivo/Ubicación:** `src/hooks/sync/useGoogleAuth.ts` (Línea 164)
- **Descripción:** Captura de error vacía (*silent failure*): `try { await SocialLogin.logout({ provider: 'google' }); } catch (ignored) { }`
- **Impacto:** Si la API nativa de Google Login falla al desloguearse, el estado en React se limpia de todos modos (`setIsAuthenticated(false)`), dejando al estado nativo de Android y al estado de React totalmente desincronizados (sesión zombie).
- **Solución propuesta:** Manejar el error y alertar al usuario si el cierre de sesión nativo falla, o forzar reintentos. Mínimamente registrar en el `@core/logger`.
- **Esfuerzo estimado:** Bajo

---

## 4. ⚡ Optimizaciones de Rendimiento

### Hallazgo 4.1: Sincronización pesada en hilo principal
- **Área:** Rendimiento | **Severidad: 🟡 Medio**
- **Archivo/Ubicación:** `src/services/googleDrive.ts`
- **Descripción:** La función usa un caché en memoria con un TTL básico, pero las subidas (`PATCH`) leen el estado actual del proyecto al completo de manera secuencial, lo que en teléfonos de gama baja o conexiones 3G frenará la UI.
- **Impacto:** Micro-congelaciones (stutters) durante el guardado de datos hacia la nube en Android.
- **Solución propuesta:** Delegar la construcción del `syncData` y la subida de los archivos grandes a un Web Worker (`dataWorker.ts` o uno nuevo dedicado al Sync) para no saturar el hilo principal de React.
- **Esfuerzo estimado:** Medio

---

## 5. 🏗️ Arquitectura y Estructura del Repo

### Hallazgo 5.1: Archivos de testing y build contaminando el repositorio
- **Área:** Arquitectura | **Severidad: 🟡 Medio**
- **Archivo/Ubicación:** Raíz del repositorio / `.gitignore`
- **Descripción:** Se están generando archivos de test ignorados parcialmente u omitidos de git de manera errónea, como `vitest_out.txt`, `coverage_final2.txt`, etc., que ensucian el historial del workspace.
- **Impacto:** Fricción en el desarrollo y posibilidad de comitear por accidente binarios o reportes de 100MB+.
- **Solución propuesta:** Actualizar el `.gitignore` añadiendo `*_out.txt`, `coverage_final*.txt` y consolidar los reportes en una carpeta `/test-reports` explícitamente ignorada.
- **Esfuerzo estimado:** Bajo

---

## 6. 📦 Dependencias y Build

### Hallazgo 6.1: Plugins legacy de Cordova presentes
- **Área:** Dependencias | **Severidad: 🟢 Bajo**
- **Archivo/Ubicación:** `android/app/build.gradle`
- **Descripción:** Inclusión de plugins legacy de cordova (`project(':capacitor-cordova-android-plugins')`).
- **Impacto:** Mayor tiempo de compilación y riesgo de incompatibilidad con Android 14+ (SDK 34).
- **Solución propuesta:** Asegurarse de que no haya plugins de Cordova activos en el `package.json` de frontend; si ya han sido sustituidos por los oficiales de Capacitor, retirar esta línea de Gradle.
- **Esfuerzo estimado:** Bajo

---

## 7. 📋 Documentación y Mantenibilidad

### Hallazgo 7.1: Falta de documentación en lógica criptográfica
- **Área:** Documentación | **Severidad: 🟡 Medio**
- **Archivo/Ubicación:** `functions/src/byd/crypto.ts` y `functions/src/byd/client.ts`
- **Descripción:** Los flujos criptográficos para emular la app oficial (AES-128-ECB, MD5 iterativos) carecen de comentarios JSDoc explicando el *por qué* de ciertas manipulaciones a nivel de buffer y hex strings.
- **Impacto:** Altamente difícil de mantener para ingenieros que se incorporen al proyecto y desconozcan el proceso de ingeniería inversa de la API de BYD.
- **Solución propuesta:** Escribir bloques JSDoc exhaustivos en las firmas de criptografía, referenciando el `BYD_API_Reference.md`.
- **Esfuerzo estimado:** Medio

---

## 📊 Resumen Ejecutivo

### Total de Hallazgos
| Área | 🔴 Crítico | 🟠 Alto | 🟡 Medio | 🟢 Bajo | Total |
|---|:---:|:---:|:---:|:---:|:---:|
| 1. Seguridad | 0 | 2 | 2 | 0 | **4** |
| 2. Calidad de Código | 0 | 0 | 2 | 0 | **2** |
| 3. Bugs y Errores | 0 | 1 | 0 | 0 | **1** |
| 4. Rendimiento | 0 | 0 | 1 | 0 | **1** |
| 5. Arquitectura | 0 | 0 | 1 | 0 | **1** |
| 6. Dependencias | 0 | 0 | 0 | 1 | **1** |
| 7. Documentación | 0 | 0 | 1 | 0 | **1** |
| **TOTALES** | **0** | **3** | **7** | **1** | **11** |

### 🔥 Top 5 Prioridades Inmediatas
1. **Limpiar fugas en logs de Firebase (Alto):** Remover/Ocultar los `console.log(JSON.stringify(response))` del Backend para cumplir con la GDPR/Privacidad.
2. **Purgar Logs Criptográficos (Alto):** Eliminar el registro en consola de la longitud y estructura de las contraseñas en `crypto.ts`.
3. **Controlar el Silent Failure de Logout (Alto):** Agregar manejo de excepciones real en el deslogueo de Google/SocialLogin para evitar sesiones inconsistentes.
4. **Almacenamiento seguro en Capacitor (Medio):** Implementar Keystore Android (`@capacitor/secure-storage`) en lugar de ofuscación local AES con hardcode-salt.
5. **Mejorar el archivo .gitignore (Bajo/Medio):** Es un parche de bajo esfuerzo que garantiza limpieza de entorno, previniendo subidas accidentales de datos de coverage.

### 📈 Estimación Global de Salud: 75/100
El núcleo de la aplicación es sólido, moderno (Vite, React 19, Capacitor 8) y la cobertura de tests (Vitest) está en un lugar aceptable. La deducción de 25 puntos proviene principalmente de riesgos serios de **Information Leakage** en producción por malas prácticas de debugeo en Node/Firebase, y de fallos de arquitectura nativa por depender de implementaciones web (como LocalStorage) sin explotar al 100% la seguridad del SDK nativo en Android. Solucionando el Top 5, el proyecto sube directamente a +88/100, listo para su salida en *Premium*.