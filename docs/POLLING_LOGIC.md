# Resumen de Lógica de Polling y Viajes

Esta tabla resume el comportamiento actual del sistema tras los cambios implementados en `bydFunctions.ts`.

## 1. Frecuencia de Llamadas API

| Tipo de Monitorización | Frecuencia | Condición | API Calls por Hora |
| :--- | :--- | :--- | :--- |
| **Monitor Activo** | Cada 1 min (3 polls/min) | Si hay **Viaje Activo** (`activeTripId`) | ~180 (si viajas 1h) |
| **Monitor Activo** | Cada 1 min (3 polls/min) | Si **Polling Activo** (`pollingActive=true`) | ~180 (si 'bug' lo deja activo) |
| **Heartbeat (Reposo)** | Cada **3 horas** | Si el coche está en reposo (sin viaje) | **0.33** (1 cada 3h) |
| **Apertura App** | Manual (1 vez) | Al abrir la app (`bydWakeVehicle`) | 1 |

> [!NOTE]
> El cambio crítico ha sido pasar el Heartbeat de 2h a **3h** y asegurar que `pollingActive` no se active falsamente.

## 2. Condiciones de Inicio de Viaje

Para que se cree un nuevo viaje (`activeTripId`), se deben cumplir las siguientes condiciones. Si no se cumplen, los datos se guardan pero **NO** se inicia el modo "Monitor Activo".

| Parámetro | Condición Estricta (Nueva) | Descripción |
| :--- | :--- | :--- |
| **Fuente** | `source !== 'wake'` | Abrir la app NUNCA inicia viaje por sí solo. |
| **Marcha (Gear)** | `gear !== 1` (Park) | **NUEVO:** Si está en PARK, NUNCA inicia viaje. |
| **Cambio a DRIVE** | `gear === 3` | **NUEVO:** Si entra en DRIVE, inicia viaje inmediatamente. |
| **Velocidad** | `speed > 0` | Si el coche reporta velocidad, es viaje seguro. |
| **Odómetro** | `odoDelta >= 0.1 km` | Si el odómetro avanza 100m o más. |
| **GPS** | `gpsDelta > 0.005` | Si la posición cambia **>500-600m** (ignora saltos de garaje). |

> [!IMPORTANT]
> **Lógica:** Se requiere (`Velocidad > 0`) **O** (`Odómetro >= 0.1`) **O** (`GPS > 0.005`).
> Anteriormente, cualquier cambio de GPS > 0.002 (200m) iniciaba viaje, lo que causaba los falsos positivos en garajes.

## 3. Condiciones de Fin de Viaje

Si hay un viaje activo, el sistema busca cerrarlo si detecta estacionamiento prolongado.

| Condición | Tiempo de Espera | Acción |
| :--- | :--- | :--- |
| **Puesta en Park (P)** | 6 polls (~2 min) | **NUEVO:** Cierra viaje tras 2 min en Park + Trimeado. |
| **Cargando** | Inmediato | Cierra viaje si se enchufa el cargador. |
| **GPS Estático** | 15 polls (~5 min) | Cierra si GPS no cambia en 5 min. |
| **Climatización OFF** | 9 polls (~3 min) | Cierra si Clima se apaga y coche no se mueve. |
| **Bloqueado (Cerrado)** | 6 polls (~2 min) | Cierra si se bloquea puertas y no se mueve. |
| **Offline (Sueño)** | 10 polls (~3.5 min) | Fuerza cierre si el coche deja de responder (dormido). |

## 4. Casos Especiales (Drift en Garaje)

Escenario: El coche está aparcado en el garaje subterráneo. El GPS salta 300 metros por mala cobertura.

*   **Antes:** `gpsDelta (0.003)` > `0.002`. **Resultado:** INICIO VIAJE -> Polling frenético (180 llamadas/hora) -> Batería agotada.
*   **Ahora:** `gpsDelta (0.003)` < `0.005`. **Resultado:** IGNORADO. Se actualiza la posición en BD pero **NO** se inicia viaje ni polling. Sigue en reposo (1 llamada cada 3h).
