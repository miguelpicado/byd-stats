# BYD Stats Premium — Especificación de Integración ABRP

> Documento autocontenido para implementación por LLM.
> Objetivo: integrar telemetría en tiempo real con **A Better Route Planner (ABRP)** aprovechando
> el polling de 20 s que ya existe en las Cloud Functions.

---

## 1. Contexto del Proyecto

**Stack:**
- Frontend: React 19 + TypeScript + Vite 7 + Tailwind (app Android vía Capacitor 8)
- Backend: Firebase Cloud Functions v2 (Node 20, Gen 2, región `europe-west1`)
- Base de datos: Firestore (colección `bydVehicles/{vin}`)
- API del coche: BYD API (endpoints propietarios, sin documentación oficial)

**Arquitectura de datos en tiempo real:**

```
BYD API (coche)
    ↓  (cada 20 s durante un viaje activo)
Cloud Function: pollVehicleInternal()
    ↓  escribe
Firestore: bydVehicles/{vin}
    ↓  onSnapshot()
App React: useVehicleStatus() hook
```

**Polling activo:**
- `bydActiveTripMonitorV2` (Cloud Scheduler, cada 20 s) → llama a `pollVehicleInternal()` para vehículos con `activeTripId` en Firestore.
- `cloudProbeAllVehicles` (Cloud Scheduler, cada 1 min) → hace una llamada ligera (`getChargingStatus`) para detectar arranques de viaje y actividad de carga.

---

## 2. Objetivo

Enviar telemetría del vehículo a ABRP:
- **Durante viajes activos**: cada vez que `pollVehicleInternal()` ejecuta (≈20 s).
- **Durante carga**: cada vez que `cloudProbeVehicle()` detecta actividad de carga (≈1 min).

La implementación es **server-side** (Cloud Functions), no en el cliente React, porque:
1. Funciona con la app cerrada.
2. La API key queda en el servidor.
3. No hay riesgo de CORS.

---

## 3. API de ABRP (Iternio)

### Endpoint
```
GET/POST https://api.iternio.com/1/tlm/send
```

### Parámetros de query
| Parámetro | Tipo   | Descripción                              |
|-----------|--------|------------------------------------------|
| `api_key` | string | API key de la aplicación (fija)          |
| `token`   | string | Token del usuario en ABRP (por vehículo) |
| `tlm`     | string | JSON codificado con los campos de telemetría |

### Campos del objeto `tlm`
| Campo        | Tipo    | Unidad | Descripción                                     |
|-------------|---------|--------|-------------------------------------------------|
| `utc`        | integer | s      | Unix timestamp                                  |
| `soc`        | number  | %      | Estado de carga (0–100)                         |
| `speed`      | number  | km/h   | Velocidad actual                                |
| `power`      | number  | kW     | Positivo = consumiendo, negativo = regenerando/cargando |
| `is_charging`| boolean | –      | ¿Está cargando?                                 |
| `is_dcfc`    | boolean | –      | ¿Carga rápida DC? (potencia > 11 kW)            |
| `is_parked`  | boolean | –      | ¿Aparcado? (sin viaje activo y sin velocidad)   |
| `lat`        | number  | °      | Latitud (opcional)                              |
| `lon`        | number  | °      | Longitud (opcional)                             |
| `odometer`   | number  | km     | Odómetro total (opcional)                       |
| `ext_temp`   | number  | °C     | Temperatura exterior (opcional)                 |

### Respuesta esperada
```json
{ "status": "ok" }
```

### API Key de la aplicación
```
b8af8daa-eb2e-4063-bc7e-fc14f473a4f1
```

### Token de usuario
Se obtiene en https://abetterrouteplanner.com → Perfil → "Link car" → copia el token personal.
Este token se almacena por vehículo (el usuario lo introduce en Settings).

---

## 4. Datos disponibles en BYD API

### Tipo `BydRealtime` (lo que devuelve `client.getRealtimeData()`)
```typescript
interface BydRealtime {
    soc: number;           // 0–100 %
    range: number;         // km
    odometer: number;      // km total
    speed: number;         // km/h
    isCharging: boolean;
    isLocked: boolean;
    isOnline: boolean;
    gear?: number;         // 1 = Parking, 2 = Reverse, 3 = Neutral, 4 = Drive
    parkingBrake?: number; // 0 = released, 1 = engaged, -1 = unknown
    interiorTemp?: number; // °C
    airConditioningActive?: boolean;
    doors?: { frontLeft: boolean; frontRight: boolean; rearLeft: boolean; rearRight: boolean; trunk: boolean; hood: boolean };
    windows?: { frontLeft: boolean; frontRight: boolean; rearLeft: boolean; rearRight: boolean };
    tirePressure?: { frontLeft: number; frontRight: number; rearLeft: number; rearRight: number };
    raw?: {
        totalPower?: number;     // kW — potencia actual. 0 = apagado. Positivo = acelerando, negativo = frenando regenerativo
        exteriorTemp?: number;   // °C temperatura exterior (no siempre disponible)
        [key: string]: unknown;
    };
}
```

### Tipo `BydGps` (lo que devuelve `client.getGpsLocation()`)
```typescript
interface BydGps {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    timestamp?: number;
}
```

### Tipo `BydCharging` (lo que devuelve `client.getChargingStatus()`)
```typescript
interface BydCharging {
    soc: number;              // 0–100 %
    isCharging: boolean;
    chargeType?: string | null;         // 'AC' | 'DC' | null
    remainingMinutes?: number | null;
    targetSoc?: number | null;
    scheduledCharging?: boolean;
    raw?: {
        updateTime?: number;  // Unix timestamp — señal de actividad del T-Box
        [key: string]: unknown;
    };
}
```

---

## 5. Estado actual de Firestore (`bydVehicles/{vin}`)

Campos relevantes ya existentes:

| Campo               | Tipo      | Descripción                                  |
|--------------------|-----------|----------------------------------------------|
| `activeTripId`      | string?   | ID del viaje activo. Null = aparcado         |
| `pollingActive`     | boolean   | Polling de 20 s activo                       |
| `lastSoC`           | number    | SoC en decimal (0.0–1.0)                    |
| `lastOdometer`      | number    | km                                           |
| `lastLocation`      | object    | `{ lat, lon, heading? }`                    |
| `isCharging`        | boolean   | Estado de carga                              |
| `chargingActive`    | boolean   | Sinónimo (para la app)                      |
| `lastSpeed`         | number    | km/h (escrito por `processVehicleState`)    |
| `lastGear`          | number    | Marcha actual                               |
| `epbStatus`         | number    | Estado freno de mano                        |
| `interiorTemp`      | number?   | °C                                          |
| `heartbeatEnabled`  | boolean   | Si el heartbeat de localización está activo |

**Campo a añadir:**

| Campo           | Tipo   | Descripción                                |
|----------------|--------|--------------------------------------------|
| `abrpUserToken` | string | Token ABRP del usuario. Vacío = desactivado |
| `lastPower`     | number | kW — potencia actual (de `raw.totalPower`) |

---

## 6. Ficheros a Modificar

```
functions/src/bydFunctions.ts          ← principal (Cloud Functions)
src/components/settings/BydSettings.tsx ← UI para introducir el token ABRP
src/hooks/useVehicleStatus.ts           ← añadir lastPower al tipo (opcional, si se usa en UI)
```

---

## 7. Cambios Detallados

### 7.1 `functions/src/bydFunctions.ts` — Función nueva: `sendAbrpTelemetry`

Añadir esta función justo antes de `pollVehicleInternal`:

```typescript
const ABRP_API_KEY = 'b8af8daa-eb2e-4063-bc7e-fc14f473a4f1';

/**
 * Envía telemetría del vehículo a ABRP (A Better Route Planner).
 * Se llama desde pollVehicleInternal (viajes, cada 20 s)
 * y desde cloudProbeVehicle (carga, cada 1 min).
 *
 * @param vin - VIN del vehículo
 * @param userToken - Token ABRP del usuario (obtenido de Firestore)
 * @param realtime - Datos en tiempo real del vehículo (puede ser parcial durante carga)
 * @param gps - Posición GPS (null si no disponible)
 * @param charging - Estado de carga (puede ser null)
 */
async function sendAbrpTelemetry(
    vin: string,
    userToken: string,
    realtime: Partial<BydRealtime>,
    gps: BydGps | null,
    charging: BydCharging | null,
): Promise<void> {
    try {
        // SoC: BYD devuelve 0-100. Usar charging.soc como fallback si realtime.soc es 0.
        const soc = (realtime.soc && realtime.soc > 0) ? realtime.soc : (charging?.soc || 0);

        // Potencia: positivo = consumiendo, negativo = regenerando/cargando
        // BYD raw.totalPower: verificar si el signo es correcto con datos reales.
        // Durante carga, la convención ABRP es negativo.
        const rawPower = (realtime.raw as any)?.totalPower;
        const isCharging = realtime.isCharging || charging?.isCharging || false;
        let power: number = rawPower || 0;
        // Si está cargando y la potencia es positiva, invertir el signo para ABRP
        if (isCharging && power > 0) power = -power;

        const speed = realtime.speed || 0;
        const isDcfc = isCharging && Math.abs(power) > 11;
        const isParked = (realtime.gear === 1) || (speed === 0 && !isCharging && !(realtime as any).activeTripId);

        const tlm: Record<string, unknown> = {
            utc: Math.floor(Date.now() / 1000),
            soc,
            speed,
            power,
            is_charging: isCharging,
            is_dcfc: isDcfc,
            is_parked: isParked,
            odometer: realtime.odometer || 0,
        };

        if (gps?.latitude && gps?.longitude) {
            tlm.lat = gps.latitude;
            tlm.lon = gps.longitude;
        }

        const exteriorTemp = (realtime.raw as any)?.exteriorTemp;
        if (typeof exteriorTemp === 'number') {
            tlm.ext_temp = exteriorTemp;
        }

        const tlmJson = JSON.stringify(tlm);
        const url = `https://api.iternio.com/1/tlm/send?api_key=${ABRP_API_KEY}&token=${encodeURIComponent(userToken)}&tlm=${encodeURIComponent(tlmJson)}`;

        const response = await fetch(url, { method: 'GET' });
        const result = await response.json() as { status: string; error?: string };

        if (result.status !== 'ok') {
            console.warn(`[ABRP] ${vin}: Error - ${result.error || JSON.stringify(result)}`);
        } else {
            console.log(`[ABRP] ${vin}: Telemetría enviada. SoC=${soc}%, speed=${speed}km/h, power=${power}kW, charging=${isCharging}, dcfc=${isDcfc}`);
        }
    } catch (e: any) {
        // No propagar el error — ABRP es opcional, no debe romper el flujo principal
        console.warn(`[ABRP] ${vin}: Fallo al enviar telemetría: ${e.message}`);
    }
}
```

---

### 7.2 `functions/src/bydFunctions.ts` — Modificar `processVehicleState`

**Buscar** el bloque `const vehicleUpdate: any = {` en `processVehicleState` y añadir `lastPower`:

```typescript
// ANTES (extracto):
const vehicleUpdate: any = {
    lastPollTime: now,
    lastUpdate: now,
    offlinePollCount: 0,
    isCharging: effectiveIsCharging,
    chargingActive: effectiveIsCharging,
    isLocked: realtime.isLocked,
    isOnline: effectiveSoc > 0 || realtime.isOnline,
    lastSpeed: realtime.speed || 0,
    lastGear: ...,
    epbStatus: ...
};

// DESPUÉS — añadir lastPower:
const vehicleUpdate: any = {
    lastPollTime: now,
    lastUpdate: now,
    offlinePollCount: 0,
    isCharging: effectiveIsCharging,
    chargingActive: effectiveIsCharging,
    isLocked: realtime.isLocked,
    isOnline: effectiveSoc > 0 || realtime.isOnline,
    lastSpeed: realtime.speed || 0,
    lastPower: realtime.raw?.totalPower || 0,  // ← AÑADIR
    lastGear: ...,
    epbStatus: ...
};
```

---

### 7.3 `functions/src/bydFunctions.ts` — Modificar `pollVehicleInternal`

Localizar la llamada a `processVehicleState` al final de `pollVehicleInternal`.
Justo después de obtener el resultado de `processVehicleState`, añadir el envío a ABRP:

```typescript
// Código existente (extracto de pollVehicleInternal):
const result = await processVehicleState(vin, realtime, gps, charging, source);

// AÑADIR después de la llamada:
// --- ABRP Telemetry ---
if (!result.isSleeping) {
    const freshVehicleData = (await vehicleRef.get()).data() || {};
    const abrpToken = freshVehicleData.abrpUserToken as string | undefined;
    if (abrpToken && abrpToken.trim()) {
        await sendAbrpTelemetry(vin, abrpToken.trim(), realtime, gps, charging);
    }
}
// --- Fin ABRP ---

return result;
```

**Nota importante:** `vehicleRef` ya está definido en el scope de `pollVehicleInternal`. No es necesario declararlo de nuevo.

---

### 7.4 `functions/src/bydFunctions.ts` — Modificar `cloudProbeVehicle` (telemetría durante carga)

En `cloudProbeVehicle`, el bloque que actualmente solo escribe `chargingDetail`:

```typescript
// ANTES:
if (isCharging && changed) {
    try {
        await vehicleRef.update({
            chargingDetail: {
                soc: currentSoC,
                chargeType: charging.chargeType || null,
                remainingMinutes: charging.remainingMinutes || null,
                targetSoc: charging.targetSoc || null,
                scheduledCharging: charging.scheduledCharging || false,
                lastUpdate: admin.firestore.Timestamp.now(),
            }
        });
    } catch (e: any) {
        console.error(`[cloudProbe] ${vin}: Failed to store charging detail: ${e.message}`);
    }
}

// DESPUÉS — añadir envío ABRP:
if (isCharging && changed) {
    try {
        await vehicleRef.update({
            chargingDetail: {
                soc: currentSoC,
                chargeType: charging.chargeType || null,
                remainingMinutes: charging.remainingMinutes || null,
                targetSoc: charging.targetSoc || null,
                scheduledCharging: charging.scheduledCharging || false,
                lastUpdate: admin.firestore.Timestamp.now(),
            }
        });
    } catch (e: any) {
        console.error(`[cloudProbe] ${vin}: Failed to store charging detail: ${e.message}`);
    }

    // Enviar telemetría ABRP durante la carga (sin despertar el coche)
    const abrpToken = vehicleData.abrpUserToken as string | undefined;
    if (abrpToken && abrpToken.trim()) {
        await sendAbrpTelemetry(vin, abrpToken.trim(), { soc: currentSoC * 100, isCharging: true }, null, charging);
    }
}
```

**Nota sobre `currentSoC`:** En `cloudProbeVehicle`, el SoC se normaliza a decimal (0.0–1.0) como `normalizeSoC(charging.soc)`. Por tanto, hay que multiplicar por 100 para ABRP: `currentSoC * 100`.

---

### 7.5 `src/components/settings/BydSettings.tsx` — Añadir campo de token ABRP

El componente `BydSettings` ya gestiona la conexión BYD y otras opciones (`autoRegisterCharges`, `heartbeatEnabled`). El token ABRP debe aparecer en la sección de "conectado".

**Patrón de referencia:** `heartbeatEnabled` se guarda en Firestore con `updateDoc`. Usar el mismo patrón para `abrpUserToken`.

**Estado a añadir al componente:**

```typescript
// Junto a los otros estados del componente:
const [abrpToken, setAbrpToken] = useState('');
const [abrpSaving, setAbrpSaving] = useState(false);

// En el useEffect que carga datos de Firestore cuando hay connectedVin:
useEffect(() => {
    if (!connectedVin) return;
    getDoc(doc(db, 'bydVehicles', connectedVin)).then((snap) => {
        if (snap.exists()) {
            setHeartbeatEnabled(snap.data().heartbeatEnabled === true);
            setAbrpToken(snap.data().abrpUserToken || '');  // ← AÑADIR
        }
    }).catch(() => {});
}, [connectedVin]);
```

**Handler para guardar el token:**

```typescript
const handleSaveAbrpToken = async () => {
    if (!connectedVin) return;
    setAbrpSaving(true);
    try {
        await updateDoc(doc(db, 'bydVehicles', connectedVin), {
            abrpUserToken: abrpToken.trim(),
        });
        toast.success(abrpToken.trim() ? 'Token ABRP guardado' : 'Token ABRP eliminado');
    } catch (err: any) {
        console.error('Error saving ABRP token:', err);
        toast.error('Error al guardar el token');
    } finally {
        setAbrpSaving(false);
    }
};
```

**JSX a añadir** (justo después del bloque de `heartbeatEnabled`, dentro del `{isConnected && connectedVin && (...)}`:

```tsx
{/* ABRP Integration */}
<div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
    <div className="font-medium text-slate-700 dark:text-slate-200 mb-1">
        ABRP — A Better Route Planner
    </div>
    <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Introduce tu token de ABRP para enviar telemetría en tiempo real.
        Encuéntralo en ABRP → Perfil → «Link car».
    </div>
    <div className="flex gap-2">
        <input
            type="text"
            value={abrpToken}
            onChange={(e) => setAbrpToken(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />
        <button
            onClick={handleSaveAbrpToken}
            disabled={abrpSaving}
            className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
            {abrpSaving ? '...' : 'Guardar'}
        </button>
    </div>
    {abrpToken && (
        <div className="mt-2 text-xs text-green-600 dark:text-green-400">
            ✓ Telemetría ABRP activa
        </div>
    )}
</div>
```

---

### 7.6 `src/hooks/useVehicleStatus.ts` — Añadir `lastPower` al tipo (opcional)

Si se quiere mostrar la potencia en la UI en el futuro:

```typescript
// Añadir a la interfaz VehicleStatus:
export interface VehicleStatus {
    // ... campos existentes ...
    lastSpeed?: number;       // km/h — ya escrito por la Cloud Function
    lastPower?: number;       // kW — nuevo campo
    lastGear?: number;        // marcha actual
    epbStatus?: number;       // estado freno de mano
}
```

---

## 8. Resumen de Cambios

| Fichero | Cambio |
|---------|--------|
| `functions/src/bydFunctions.ts` | Nueva función `sendAbrpTelemetry()` |
| `functions/src/bydFunctions.ts` | `processVehicleState`: escribir `lastPower` a Firestore |
| `functions/src/bydFunctions.ts` | `pollVehicleInternal`: llamar a `sendAbrpTelemetry` tras cada poll activo |
| `functions/src/bydFunctions.ts` | `cloudProbeVehicle`: llamar a `sendAbrpTelemetry` durante carga |
| `src/components/settings/BydSettings.tsx` | Campo de texto + botón para token ABRP, guardado en Firestore |
| `src/hooks/useVehicleStatus.ts` | (Opcional) Añadir `lastSpeed`, `lastPower`, `lastGear` al tipo |

---

## 9. Flujo Completo

```
Usuario introduce token ABRP en Settings
    ↓ updateDoc (Firestore: bydVehicles/{vin}.abrpUserToken)

Durante viaje activo (cada 20 s):
bydActiveTripMonitorV2 → pollVehicleInternal()
    → getRealtimeData + getGpsLocation + getChargingStatus
    → processVehicleState() [registra/actualiza viaje]
    → sendAbrpTelemetry() [si abrpUserToken existe]
        → POST https://api.iternio.com/1/tlm/send

Durante carga (cada 1 min):
cloudProbeAllVehicles → cloudProbeVehicle()
    → getChargingStatus() [detecta isCharging=true, SoC cambió]
    → escribe chargingDetail en Firestore
    → sendAbrpTelemetry() [si abrpUserToken existe]
        → POST https://api.iternio.com/1/tlm/send
```

---

## 10. Verificación Post-Deploy

1. **En Firebase Logs** (`bydActiveTripMonitorV2`):
   - Durante un viaje: `[ABRP] {VIN}: Telemetría enviada. SoC=X%, speed=Xkm/h, power=XkW, charging=false`
   - Durante carga: `[ABRP] {VIN}: Telemetría enviada. SoC=X%, speed=0km/h, power=-XkW, charging=true`
   - Si token no configurado: silencio (no hay log)
   - Si error: `[ABRP] {VIN}: Error - ...`

2. **En ABRP** (web o app):
   - Abrir «Live Data» en ABRP → debe mostrar el vehículo con datos en tiempo real
   - Durante conducción: SoC, velocidad y posición deben actualizarse cada ≈20 s

3. **Casos de error conocidos:**
   - Token incorrecto → ABRP devuelve `{ "status": "error", "error": "..." }`
   - Coche dormido → `pollVehicleInternal` devuelve `isSleeping=true`, no se llama ABRP (correcto)
   - Sin GPS (coche en interior) → `tlm` se envía sin `lat`/`lon` (ABRP lo acepta)

---

## 11. Notas Importantes

### Signo de `power`
El campo `raw.totalPower` de BYD tiene signo positivo durante aceleración. Durante frenada regenerativa puede ser negativo. Durante carga, BYD puede devolver 0 o positivo. **Verificar con datos reales** y ajustar la lógica de inversión de signo si es necesario.

### SoC en `cloudProbeVehicle`
Dentro de `cloudProbeVehicle`, el SoC se normaliza a decimal (0.0–1.0) mediante `normalizeSoC()`. Al llamar a `sendAbrpTelemetry` desde ese contexto, pasar `currentSoC * 100` para convertir de vuelta a porcentaje. Desde `pollVehicleInternal`, el SoC ya viene en porcentaje directamente de la API.

### Rate limiting
ABRP acepta hasta 1 llamada cada 10 s por token. Con el intervalo actual de 20 s en viajes y 60 s en carga, estamos bien por debajo del límite.

### Deploy
```bash
cd byd-stats-premium
npx firebase deploy --only functions
```
