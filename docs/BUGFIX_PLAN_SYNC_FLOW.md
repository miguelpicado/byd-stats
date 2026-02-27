# Plan de Correcciones - Flujo de Sincronización y Copias de Seguridad

## Resumen de Bugs

Se han identificado **3 bugs** en el flujo de login + sincronización + restauración de copias:

---

## BUG 1: El modal RegistryRestoreModal muestra coches que no aparecen en CloudBackupsModal

### Descripción
Al iniciar sesión, el modal "Coches encontrados" (RegistryRestoreModal) muestra coches que luego no se ven en "Copias en la Nube" (CloudBackupsModal). Parece que consultan fuentes de datos distintas.

### Causa Raíz
Efectivamente consultan **dos fuentes de datos diferentes**:

- **RegistryRestoreModal** obtiene coches de `byd_stats_registry.json` (archivo de registro). Además, si el registry está vacío, tiene un **FALLBACK** en `useCloudRegistry.ts:24-77` que escanea TODOS los archivos `byd_stats_data*` y reconstruye coches ficticios a partir de los nombres de archivo. Este fallback persiste el registry reconstruido, pudiendo añadir entradas "fantasma" que ya no existen como archivos reales.

- **CloudBackupsModal** obtiene archivos de `googleDriveService.listAllDatabaseFiles()` que hace una query directa a Google Drive: `name contains 'byd_stats_data'`. Esto devuelve solo archivos que **realmente existen**.

**El problema concreto**: El registry (`byd_stats_registry.json`) puede contener entradas de coches cuyos archivos de datos ya fueron eliminados. Nunca se hace limpieza del registry cuando se elimina un archivo. Además, el registry se cachea 5 minutos (`CACHE_TTL_LONG`), por lo que puede estar desactualizado.

### Solución

**Archivo**: `src/hooks/sync/useCloudRegistry.ts`

En la función `checkAndPromptRegistry`, **después** de obtener el registry y **antes** de mostrar el modal, validar que cada coche del registry tiene un archivo real asociado:

```typescript
// DESPUÉS de obtener registry (línea ~78), ANTES de ordenar y mostrar modal:

// Validate registry cars against actual Drive files
const actualFiles = await googleDriveService.listAllDatabaseFiles({ forceRefresh: true });
const actualFileNames = new Set(actualFiles.map(f => f.name));

// Filter registry to only include cars with actual backup files
const validCars = registry!.cars.filter(car => {
    const expectedFile = car.id === 'legacy'
        ? 'byd_stats_data.json'
        : `byd_stats_data_${car.id}.json`;
    return actualFileNames.has(expectedFile);
});

if (validCars.length === 0) {
    logger.info("[Sync] Registry had entries but no matching files found. Cleaning up.");
    // Clean up stale registry
    await googleDriveService.updateRegistry({ cars: [], lastUpdated: new Date().toISOString() });
    return false;
}

// Update registry with only valid cars (cleanup stale entries)
if (validCars.length !== registry!.cars.length) {
    logger.info(`[Sync] Cleaned registry: ${registry!.cars.length} → ${validCars.length} cars`);
    registry!.cars = validCars;
    try {
        await googleDriveService.updateRegistry(registry!);
    } catch (e) {
        logger.warn("[Sync] Failed to persist cleaned registry", e);
    }
}
```

Insertar este bloque en `useCloudRegistry.ts` justo **antes** de la línea 79 (`const isKnown = ...`), reemplazando `registry!.cars` por `validCars` en las operaciones posteriores.

---

## BUG 2: Tras login, vuelve a la Landing en lugar de mostrar el modal de copias

### Descripción
Al pinchar "Iniciar sesión con Google" y seleccionar cuenta, la app vuelve a la Landing Page y no muestra automáticamente el modal de selección de coche. Solo aparece al pulsar manualmente "Sincronizar".

### Causa Raíz
El flujo de login en web usa `@react-oauth/google` que abre un popup/redirect. El problema es una **condición de carrera** entre:

1. `handleLoginSuccess` en `useGoogleAuth.ts:44` → llama a `onLoginSuccessCallback.current(accessToken)`
2. `handleLoginLink` en `useGoogleSync.ts:110-121` → llama a `checkAndPromptRegistry(isFreshInstall)`
3. El callback `onLoginSuccessCallback.current` se asigna en un `useEffect` (línea 124-126) que depende de `localTrips.length`, `localCharges.length`, etc.

**El problema específico**: En `useGoogleAuth.ts:44-56`, `handleLoginSuccess` hace:
```typescript
setIsAuthenticated(true);           // Trigger re-render
await fetchUserProfile(accessToken); // Async - may trigger another render
if (onLoginSuccessCallback.current) {
    onLoginSuccessCallback.current(accessToken);  // Calls handleLoginLink
}
```

Pero `handleLoginLink` en `useGoogleSync.ts:110` captura `localTrips` y `localCharges` del closure del render actual. Como `setIsAuthenticated(true)` puede provocar un re-render que redefina `handleLoginLink`, pero el ref `onLoginSuccessCallback.current` aún apunta a la versión **antigua** que puede tener un estado desactualizado.

Además, el `useEffect` que asigna el callback (línea 124-126) tiene `handleLoginLink` como una función que se recrea en cada render, pero el `useEffect` depende de valores primitivos (`localTrips.length`) que **no cambian** durante el login, por lo que no se re-ejecuta.

**Sin embargo, el problema más probable es otro**: En plataformas web, `useGoogleLogin` de `@react-oauth/google` puede hacer un redirect completo que recarga la página. Tras el redirect, el token se procesa pero la callback no se re-registra a tiempo. En el `useEffect` inicial (línea 60-86 de `useGoogleAuth.ts`), cuando se detecta un token válido al montar, **NO se llama a `onLoginSuccessCallback`** - solo se llama `setIsAuthenticated(true)` y `fetchUserProfile(token)`. Esto significa que tras un redirect/recarga, el `handleLoginLink` **nunca se ejecuta**.

### Solución

**Archivo**: `src/hooks/useGoogleSync.ts`

Añadir un `useEffect` que detecte cuando `isAuthenticated` cambia de `false` a `true` con datos locales vacíos, y dispare el check del registry:

```typescript
// Nuevo useEffect después de la línea 126
const prevAuthRef = useRef(isAuthenticated);

useEffect(() => {
    const wasNotAuthenticated = !prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    if (wasNotAuthenticated && isAuthenticated) {
        // User just became authenticated (login or page reload with valid token)
        const isFreshInstall = localTrips.length === 0 && localCharges.length === 0;
        if (isFreshInstall) {
            logger.info("[Sync] Detected fresh authentication with empty local data. Checking registry...");
            // Small delay to ensure Drive service has the token set
            setTimeout(async () => {
                const modalOpened = await checkAndPromptRegistry(true);
                if (!modalOpened) {
                    performSync();
                }
            }, 500);
        }
    }
}, [isAuthenticated, localTrips.length, localCharges.length, checkAndPromptRegistry, performSync]);
```

Esto cubre tanto el caso del login directo como el caso de recarga de página con token válido y datos locales vacíos.

**Nota**: Importar `useRef` si no está ya importado (ya está en la línea 1).

---

## BUG 3: Tras restaurar copia en RegistryRestoreModal, el modal no se cierra

### Descripción
Al seleccionar un coche en el RegistryRestoreModal y pulsar "Restaurar", el proceso se completa pero el modal permanece abierto sin forma de cerrarlo.

### Causa Raíz
En `ModalContainer.tsx:70-76`:
```tsx
{modals.registryRestore && (
    <RegistryRestoreModalLazy
        registryCars={modals.registryCars}
        onRestore={async (car) => { await googleSync.restoreFromRegistry(car); }}
        onSkip={googleSync.skipRegistryRestore}
    />
)}
```

La función `onRestore` llama a `googleSync.restoreFromRegistry(car)`, que en `useCloudRegistry.ts:138-176`:
1. Actualiza localStorage con el coche restaurado
2. Llama a `setActiveCarId(car.id)`
3. Llama a `syncFromCloud(null, { forcePull: true })` que hace un `performSync`

**Pero en ningún momento se cierra el modal `registryRestore`.**

Igualmente, `onSkip` llama a `skipRegistryRestore` en `useGoogleSync.ts:165-169`:
```typescript
const skipRegistryRestore = async () => {
    logger.info("[Sync] User chose new car/skip restore. Proceeding with sync.");
    await performSync();
    return true;
};
```
**Tampoco cierra el modal.**

La función `closeRegistryModal` existe en `useModalState.ts:200-202` pero **nunca se llama** después de restore/skip.

### Solución

**Archivo**: `src/components/common/ModalContainer.tsx`

Modificar las callbacks de `onRestore` y `onSkip` para cerrar el modal después de ejecutar:

```tsx
// Se necesita acceso a closeRegistryModal. Obtenerlo del contexto.
// En ModalContainer.tsx, el useData() ya provee closeModal.
// Pero closeRegistryModal es una función específica del modalState.

// Opción A (más limpia): Usar closeModal('registryRestore') que ya existe
{modals.registryRestore && (
    <RegistryRestoreModalLazy
        registryCars={modals.registryCars}
        onRestore={async (car) => {
            await googleSync.restoreFromRegistry(car);
            closeModal('registryRestore');
        }}
        onSkip={() => {
            googleSync.skipRegistryRestore();
            closeModal('registryRestore');
        }}
    />
)}
```

**Nota**: `closeModal` ya está disponible en el destructuring de `useData()` en la línea 41 del ModalContainer.

**Verificar**: Que `closeModal('registryRestore')` efectivamente resetea también `registryCars`. Mirando `useModalState.ts:132-141`, `closeModal` hace:
```typescript
setModals(prev => ({ ...prev, [name]: false }));
```
Esto pone `registryRestore: false` pero **NO limpia `registryCars`**. Debería usarse `closeRegistryModal` en su lugar o añadir la limpieza.

**Solución mejorada**: Exponer `closeRegistryModal` a través del contexto o limpiar registryCars en el closeModal:

**Archivo**: `src/hooks/useModalState.ts`

Modificar `closeModal` para limpiar `registryCars` cuando se cierra `registryRestore`:

```typescript
const closeModal = useCallback((name: keyof ModalsState) => {
    // History handling for specific modals
    if ((name === 'allTrips' && window.location.hash === '#all-trips') ||
        (name === 'allCharges' && window.location.hash === '#all-charges')) {
        window.history.back();
    }

    setModals(prev => {
        const update: Partial<ModalsState> = { [name]: false };
        // Clean up associated data when closing registry modal
        if (name === 'registryRestore') {
            update.registryCars = [];
        }
        return { ...prev, ...update };
    });
}, []);
```

O alternativamente (más sencillo), en `ModalContainer.tsx` importar/usar `closeRegistryModal` del contexto. Pero como `ModalContainer` usa `useData()` y no directamente `useModalContext`, la opción más práctica es:

**Archivo**: `src/components/common/ModalContainer.tsx` - Cambiar las líneas 70-76:

```tsx
{modals.registryRestore && (
    <RegistryRestoreModalLazy
        registryCars={modals.registryCars}
        onRestore={async (car) => {
            try {
                await googleSync.restoreFromRegistry(car);
            } finally {
                closeModal('registryRestore');
            }
        }}
        onSkip={() => {
            closeModal('registryRestore');
            googleSync.skipRegistryRestore();
        }}
    />
)}
```

Y aplicar el fix en `useModalState.ts` para que `closeModal('registryRestore')` también limpie `registryCars`.

---

## Resumen de Cambios por Archivo

| Archivo | Cambio | Bug |
|---------|--------|-----|
| `src/hooks/sync/useCloudRegistry.ts` | Validar coches del registry contra archivos reales en Drive antes de mostrar modal | Bug 1 |
| `src/hooks/useGoogleSync.ts` | Añadir useEffect que detecte transición de auth y dispare registry check | Bug 2 |
| `src/components/common/ModalContainer.tsx` | Cerrar modal registryRestore tras restore/skip | Bug 3 |
| `src/hooks/useModalState.ts` | Limpiar registryCars al cerrar registryRestore | Bug 3 |

---

## Orden de Implementación Recomendado

1. **Bug 3** (más sencillo, fix de UI puro)
2. **Bug 1** (lógica de validación de datos)
3. **Bug 2** (lógica de flujo asíncrono, requiere más testing)

---

## Instrucciones para Sonnet

Ejecuta los siguientes cambios en orden. Lee cada archivo antes de editarlo para confirmar que las líneas coinciden.

### Paso 1: Fix Bug 3 - Cerrar modal tras restaurar

**1a. Editar `src/hooks/useModalState.ts`**

Buscar la función `closeModal` (aprox. línea 132) y reemplazar:

```typescript
// BUSCAR:
const closeModal = useCallback((name: keyof ModalsState) => {
    // History handling for specific modals
    if ((name === 'allTrips' && window.location.hash === '#all-trips') ||
        (name === 'allCharges' && window.location.hash === '#all-charges')) {
        window.history.back();
        // State update happens in popstate listener
    }

    setModals(prev => ({ ...prev, [name]: false }));
}, []);

// REEMPLAZAR CON:
const closeModal = useCallback((name: keyof ModalsState) => {
    // History handling for specific modals
    if ((name === 'allTrips' && window.location.hash === '#all-trips') ||
        (name === 'allCharges' && window.location.hash === '#all-charges')) {
        window.history.back();
    }

    setModals(prev => {
        const update: Partial<ModalsState> = { [name]: false };
        if (name === 'registryRestore') {
            update.registryCars = [];
        }
        return { ...prev, ...update };
    });
}, []);
```

**1b. Editar `src/components/common/ModalContainer.tsx`**

Buscar el bloque del RegistryRestoreModal (aprox. línea 70) y reemplazar:

```tsx
// BUSCAR:
{modals.registryRestore && (
    <RegistryRestoreModalLazy
        registryCars={modals.registryCars}
        onRestore={async (car) => { await googleSync.restoreFromRegistry(car); }}
        onSkip={googleSync.skipRegistryRestore}
    />
)}

// REEMPLAZAR CON:
{modals.registryRestore && (
    <RegistryRestoreModalLazy
        registryCars={modals.registryCars}
        onRestore={async (car) => {
            try {
                await googleSync.restoreFromRegistry(car);
            } finally {
                closeModal('registryRestore');
            }
        }}
        onSkip={() => {
            closeModal('registryRestore');
            googleSync.skipRegistryRestore();
        }}
    />
)}
```

### Paso 2: Fix Bug 1 - Validar coches contra archivos reales

**Editar `src/hooks/sync/useCloudRegistry.ts`**

Buscar la línea `const isKnown = registry!.cars.some(c => c.id === activeCarId);` (aprox. línea 79) e insertar ANTES de ella:

```typescript
// Validate registry cars against actual Drive files to remove stale entries
try {
    const actualFiles = await googleDriveService.listAllDatabaseFiles({ forceRefresh: true });
    const actualFileNames = new Set(actualFiles.map(f => f.name));

    const validCars = registry!.cars.filter(car => {
        const expectedFile = car.id === 'legacy'
            ? 'byd_stats_data.json'
            : `byd_stats_data_${car.id}.json`;
        return actualFileNames.has(expectedFile);
    });

    if (validCars.length === 0) {
        logger.info("[Sync] Registry had entries but no matching files found. Cleaning up.");
        await googleDriveService.updateRegistry({ cars: [], lastUpdated: new Date().toISOString() });
        return false;
    }

    if (validCars.length !== registry!.cars.length) {
        logger.info(`[Sync] Cleaned registry: ${registry!.cars.length} → ${validCars.length} cars`);
        registry!.cars = validCars;
        try {
            await googleDriveService.updateRegistry(registry!);
        } catch (persistErr) {
            logger.warn("[Sync] Failed to persist cleaned registry", persistErr);
        }
    }
} catch (validationErr) {
    logger.warn("[Sync] Registry validation failed, proceeding with unvalidated registry", validationErr);
}
```

### Paso 3: Fix Bug 2 - Mostrar modal tras login automáticamente

**Editar `src/hooks/useGoogleSync.ts`**

Añadir después del useEffect que asigna `onLoginSuccessCallback` (después de la línea 126):

```typescript
// Detect auth state transitions to trigger registry check after login/page reload
const prevAuthRef = useRef(isAuthenticated);

useEffect(() => {
    const wasNotAuthenticated = !prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    if (wasNotAuthenticated && isAuthenticated) {
        const isFreshInstall = localTrips.length === 0 && localCharges.length === 0;
        if (isFreshInstall) {
            logger.info("[Sync] Detected fresh authentication with empty data. Checking registry...");
            const timer = setTimeout(async () => {
                try {
                    const modalOpened = await checkAndPromptRegistry(true);
                    if (!modalOpened) {
                        performSync();
                    }
                } catch (err) {
                    logger.error("[Sync] Post-auth registry check failed", err);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }
}, [isAuthenticated, localTrips.length, localCharges.length, checkAndPromptRegistry, performSync]);
```

**Nota**: `useRef` ya está importado en la línea 1 del archivo.

---

## Testing

Después de aplicar los cambios, verificar estos escenarios:

1. **Bug 3**: Login → Seleccionar coche → "Restaurar" → El modal se cierra y se cargan los datos
2. **Bug 3**: Login → "Crear NUEVO Coche" → El modal se cierra
3. **Bug 1**: Los coches mostrados en RegistryRestoreModal coinciden con los archivos en CloudBackupsModal
4. **Bug 2**: Login desde Landing → Seleccionar cuenta Google → Aparece el modal de coches automáticamente
5. **Bug 2**: Recargar página con sesión activa y datos vacíos → Aparece el modal de coches
6. **Regresión**: Login con datos locales existentes → No aparece el modal de coches, se sincroniza directamente
7. **Regresión**: Sync manual desde Settings cuando ya hay datos → Funciona normalmente
