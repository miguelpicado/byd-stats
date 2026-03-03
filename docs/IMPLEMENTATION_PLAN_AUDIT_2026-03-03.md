# Plan de Implementación de Auditoría (PremiumAPK)
**Fecha:** 3 de marzo de 2026
**Objetivo:** Resolver los 11 hallazgos identificados en `AUDIT_PREMIUM_APK_2026-03-03.md`.
**Uso:** Este documento es autocontenido y está diseñado para que cualquier LLM o desarrollador pueda ejecutar las fases directamente, sin necesidad de reanalizar el repositorio.

---

## Fase 1: Remediaciones Críticas de Seguridad y Privacidad (Prioridad 1)
**Objetivo:** Prevenir el *Information Leakage* (Fuga de datos) en los logs de producción y purgar datos criptográficos del servidor.

### 1.1 Limpiar logs masivos en BYD Client
- **Archivo:** `functions/src/byd/client.ts` y `mqtt-listener/src/index.ts`
- **Acción:** Buscar todos los `console.log` que impriman objetos completos (ej. `JSON.stringify(response)` o payloads crudos) y ocultarlos tras una variable de entorno.
- **Código a implementar (Ejemplo generalizado para aplicar en todo el archivo):**
  ```typescript
  // Al inicio del archivo
  const isDebug = process.env.DEBUG === 'true';

  // Donde haya logs masivos como:
  // console.log(`[getVehicles] Full response: ${JSON.stringify(response)}`);
  // Reemplazar por:
  if (isDebug) {
      console.log(`[getVehicles] Full response: ${JSON.stringify(response)}`);
  }
  ```

### 1.2 Purgar logs criptográficos
- **Archivo:** `functions/src/byd/crypto.ts`
- **Acción:** Eliminar o comentar la línea 98 que imprime la longitud de la contraseña y los hashes.
- **Código a implementar (Línea 98):**
  ```typescript
  // ANTES:
  console.log(`[pwdLoginKey] password length: ${password?.length}, firstHash: ${firstHash} (${firstHash.length}), secondHash: ${secondHash} (${secondHash.length})`);
  
  // DESPUÉS:
  // Eliminado por motivos de seguridad (Data Leakage)
  ```

### 1.3 Controlar Silent Failure en Logout Nativo
- **Archivo:** `src/hooks/sync/useGoogleAuth.ts`
- **Acción:** Mejorar el bloque `catch (ignored) { }` en la línea 164.
- **Código a implementar:**
  ```typescript
  // ANTES (Línea 163-165):
  if (Capacitor.isNativePlatform()) {
      try { await SocialLogin.logout({ provider: 'google' }); } catch (ignored) { }
  }

  // DESPUÉS:
  if (Capacitor.isNativePlatform()) {
      try { 
          await SocialLogin.logout({ provider: 'google' }); 
      } catch (err) {
          logger.error('[Auth] Error closing native Google session', err);
          // Forzar limpieza de tokens aunque falle el plugin
      }
  }
  ```

---

## Fase 2: Mejora de Arquitectura y Limpieza del Repo (Prioridad 2)
**Objetivo:** Evitar la contaminación del repositorio con archivos generados dinámicamente y mejorar la estructura nativa.

### 2.1 Actualizar .gitignore
- **Archivo:** `.gitignore` (Raíz)
- **Acción:** Añadir reglas estrictas para los archivos de salida de pruebas y builds.
- **Código a añadir al final del archivo:**
  ```text
  # Test outputs & coverage logs
  *_out.txt
  *_out?.txt
  coverage_final*.txt
  test-results/
  playwright-report/
  build_out.txt
  ```

### 2.2 Desactivar tráfico Cleartext en Android
- **Archivo:** `android/app/src/main/res/xml/network_security_config.xml`
- **Acción:** Desactivar `cleartextTrafficPermitted` para entornos de producción.
- **Código a implementar:**
  Cambiar el bloque actual por un entorno condicional, o directamente deshabilitarlo si el Live Reload ya no es necesario en `PremiumAPK`:
  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <network-security-config>
      <base-config cleartextTrafficPermitted="false" />
      <!-- Eliminar o comentar en build final el <domain-config> -->
  </network-security-config>
  ```

---

## Fase 3: Refactorización y Rendimiento (Prioridad 3)
**Objetivo:** Mejorar la fiabilidad del token parsing, la documentación criptográfica y evitar la saturación del hilo principal.

### 3.1 Refactorizar extracción de Token OAuth
- **Archivo:** `src/hooks/sync/useGoogleAuth.ts`
- **Acción:** Simplificar la lógica anidada de extracción de token (Líneas 120-139).
- **Código a implementar:**
  ```typescript
  // Reemplazar la larga cadena de getTokenString por:
  let accessToken: string | null = null;
  try {
      // Intentar extraer de la estructura conocida del plugin Capacitor Firebase Auth
      const res = result as any;
      accessToken = 
          res?.accessToken?.token || 
          res?.accessToken || 
          res?.result?.accessToken?.token || 
          res?.result?.accessToken || 
          res?.token || 
          null;
  } catch (e) {
      logger.error('[Auth] Failed to parse native auth result', e);
  }
  ```

### 3.2 Documentar Criptografía BYD
- **Archivo:** `functions/src/byd/crypto.ts`
- **Acción:** Añadir JSDoc a `aesEncryptHex` y `pwdLoginKey` explicando el vector de inicialización y la razón del doble MD5.
- **Código a añadir (Ejemplo):**
  ```typescript
  /**
   * Genera el hash de contraseña requerido por la API de BYD.
   * La API espera un hash de la forma: MD5(MD5(password) + "byd_token")
   * Esto previene ataques de diccionario estándar sobre la BD de BYD.
   * @param password - Contraseña en texto plano
   */
  export function pwdLoginKey(password: string): string { ... }

  /**
   * Encripta el payload usando AES-128-ECB (Electronic Codebook).
   * Nota: ECB es inherentemente inseguro, pero es el cifrado requerido por el endpoint
   * legacy de la API de BYD. No modificar a CBC/GCM a menos que la API cambie.
   */
  export function aesEncryptHex(text: string, keyHex: string): string { ... }
  ```

### 3.3 Delegar SyncData al WebWorker
- **Archivo:** `src/services/googleDrive.ts`
- **Acción:** Modificar el flujo de `uploadFile` (Línea ~310) para no serializar el estado bloqueando la UI.
- **Plan para el LLM:**
  1. Identificar dónde se llama a `JSON.stringify(syncData)`.
  2. Si `syncData` es masivo (miles de trips), esto bloquea React.
  3. Crear un caso de uso en `dataWorker.ts` llamado `SERIALIZE_SYNC_DATA`.
  4. Llamar al worker desde `googleDrive.ts` pasándole los objetos crudos y recibiendo el string JSON resultante, permitiendo a la UI respirar.

---

## Fase 4: Deuda Técnica y Almacenamiento Seguro (Prioridad 4 - Largo Plazo)
**Objetivo:** Cambiar el sistema de almacenamiento en Capacitor e iterar sobre los comentarios TODO.

### 4.1 Implementar Capacitor Secure Storage
- **Archivo:** `src/utils/secureStorage.ts`
- **Plan para el LLM:**
  1. Instalar `@capacitor/secure-storage-plugin` si no está.
  2. Modificar `secureSet` y `secureGet` para que, si `Capacitor.isNativePlatform()` es true, use el plugin nativo (Android Keystore / iOS Keychain) en lugar de la ofuscación AES simulada en JS.
  3. Mantener el fallback actual de WebCrypto API para la versión PWA (Web).

### 4.2 Resolver TODOs
- **Archivos múltiples:** `src/hooks/useAutoChargeDetection.ts`, `src/core/batteryCalculations.ts`, etc.
- **Plan para el LLM:**
  1. Ejecutar una búsqueda global de `TODO` o `FIXME`.
  2. Extraerlos, documentarlos en el sistema de tickets/Issues del proyecto, y limpiar los archivos afectados.

---
**Instrucción Final para el LLM Ejecutor:** Sigue este plan fase a fase. Tras cada fase, ejecuta `npm run build` y `npm run test` para asegurar que las regresiones no hayan roto la compilación o las pruebas, prestando especial atención a que los mocks sigan funcionando si modificas `useGoogleAuth` o `crypto.ts`.