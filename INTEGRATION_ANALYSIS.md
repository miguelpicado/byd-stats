# BYD Stats Integration Analysis & Implementation Report

## Executive Summary

The BYD Stats application now has complete PyBYD backend integration with:
- ✅ Full vehicle data capture (battery, range, odometer, temps, doors, windows, tires, location)
- ✅ Automatic trip detection and tracking (via odometer + GPS movement detection)
- ✅ Automatic charging session tracking
- ✅ All 9 remote control commands fully implemented
- ✅ MQTT listener trigger-based polling (no decryption needed)
- ✅ Session sharing between MQTT and HTTP for consistent encryption tokens

---

## Data Flow Architecture

### Components
1. **Frontend** (BYD Stats React app) - `src/`
2. **Firebase Backend** - `functions/src/`
   - `bydFunctions.ts` - Main callable functions
   - `byd/client.ts` - BYD API client
   - `byd/crypto.ts` - Encryption/decryption
3. **MQTT Listener** - `mqtt-listener/src/index.ts` (Raspberry Pi)

### Authentication Flow
```
User Credentials
    ↓
[bydConnect] → Login → Session created → Stored in Firestore
    ↓
[getBydClientWithSession] → Restore session from Firestore
    ↓
All functions use same encryToken (MQTT + HTTP)
```

---

## Vehicle Data Available & Utilized

### Data Saved to Firestore (bydVehicles collection)

#### ✅ Being Saved & Used by Frontend
| Field | Type | Source | Used in Frontend |
|-------|------|--------|-----------------|
| lastSoC | number (0-1) | getRealtime, poll | ✅ LiveVehicleStatus |
| lastRange | number (km) | getRealtime, poll | ❓ Not explicitly shown |
| lastOdometer | number (km) | getRealtime, poll | ❓ Calculation only |
| isCharging | boolean | getRealtime, poll | ✅ ChargeCard |
| isLocked | boolean | getRealtime, poll | ✅ LiveVehicleStatus |
| isOnline | boolean | getRealtime, poll | ❓ Not shown |
| activeTripId | string | poll | ✅ LiveVehicleStatus (trip indicator) |
| activeChargeSessionId | string | (from charges) | ✅ Charge tracking |

#### ⚠️ Being Saved But NOT Shown in UI
| Field | Type | Source | Why Useful |
|-------|------|--------|-----------|
| lastSpeed | number (km/h) | getRealtime, poll | Could show current speed when car is on |
| exteriorTemp | number (°C) | getRealtime, poll | Weather context for efficiency |
| interiorTemp | number (°C) | getRealtime, poll | Cabin comfort indicator |
| doors | object | getRealtime, poll | Security status (frontLeft, frontRight, rearLeft, rearRight, trunk, hood) |
| windows | object | getRealtime, poll | Security status (frontLeft, frontRight, rearLeft, rearRight) |
| tirePressure | object | getRealtime, poll | Maintenance alert (frontLeft, frontRight, rearLeft, rearRight) |
| lastLocation | object | getGps, poll | Trip mapping, theft recovery |
| lastLocation.heading | number (°) | getGps | Vehicle direction/compass |
| lastUpdate | Timestamp | All data functions | Data freshness indicator |

---

## Complete API Capabilities

### Data Retrieval Functions

#### 1. **bydGetRealtime(vin)** ✅
Returns: `{ success, data: BydRealtime }`
```
soc: 0-100
range: km estimate
odometer: total km
speed: current km/h
isCharging: boolean
isLocked: boolean
isOnline: boolean
exteriorTemp: °C
interiorTemp: °C
doors: {frontLeft, frontRight, rearLeft, rearRight, trunk, hood}
windows: {frontLeft, frontRight, rearLeft, rearRight}
tirePressure: {frontLeft, frontRight, rearLeft, rearRight}
```

#### 2. **bydGetGps(vin)** ✅
Returns: `{ success, data: BydGps }`
```
latitude: decimal degrees
longitude: decimal degrees
heading: compass bearing (0-360°)
speed: current km/h
timestamp: milliseconds
```

#### 3. **bydGetCharging(vin)** ✅
Returns: `{ success, data: BydCharging }`
```
soc: current %
isCharging: boolean
chargeType: string (e.g., "AC", "DC")
remainingMinutes: ETA to completion
targetSoc: target %
scheduledCharging: boolean
```

#### 4. **bydWakeVehicle(vin, activatePolling?)** ✅
- Wakes sleeping vehicle (retries up to 3 times)
- Optionally activates polling (default: true)
- Returns all realtime data after waking

#### 5. **bydDiagnostic(vin)** ✅
- Tests connection and returns realtime, GPS, charging in parallel
- Returns errors if any endpoint fails
- Useful for debugging

#### 6. **bydPollVehicle(vin)** ✅
- Called by scheduler or MQTT listener
- Detects movement (odometer ≥1km OR GPS ~50m)
- Creates/updates/closes trips automatically
- Returns: `{ success, data: { soc, range, odometer, isCharging, isLocked, location, hasMovement, activeTripId } }`

---

### Remote Control Functions

#### Command Availability

| Command | Code | Frontend Exposed | Implementation |
|---------|------|------------------|-----------------|
| LOCK | 1 | ✅ bydLock | Client method: lock() |
| UNLOCK | 2 | ✅ bydUnlock | Client method: unlock() |
| FLASH_LIGHTS | 3 | ✅ bydFlashLights | Client method: flashLights() |
| FIND_CAR (horn) | 4 | ✅ Via honkHorn() | Client method: honkHorn() |
| START_CLIMATE | 5 | ✅ bydStartClimate(vin, temp?) | Client method: startClimate(vin, tempCelsius) |
| STOP_CLIMATE | 6 | ✅ bydStopClimate | Client method: stopClimate() |
| CLOSE_WINDOWS | 7 | ✅ **bydCloseWindows** [NEW] | Client method: closeWindows() |
| SEAT_CLIMATE | 8 | ✅ **bydSeatClimate** [NEW] | Client method: seatClimate(vin, seat, mode) |
| BATTERY_HEAT | 9 | ✅ **bydBatteryHeat** [NEW] | Client method: batteryHeat() |

#### New Command Signatures

```typescript
// Close Windows
bydCloseWindows(vin: string, pin?: string): Promise<{ success: boolean }>

// Seat Climate Control
bydSeatClimate(
    vin: string,
    seat: number,    // 0=driver, 1=passenger
    mode: number,    // 0=off, 1=low, 2=medium, 3=high
    pin?: string
): Promise<{ success: boolean }>

// Battery Heating (for cold weather preconditioning)
bydBatteryHeat(vin: string, pin?: string): Promise<{ success: boolean }>
```

---

## Trip Detection System

### What Triggers a Trip?

1. **MQTT vehicleInfo Event** with `isUnlocked=true` → Activates polling
2. **MQTT remoteControl Event** with `UNLOCK` → Activates polling
3. **Manual wake** → Activates polling temporarily
4. **Once polling active**: Movement detected (odometer ≥1km OR GPS ~50m)

### Trip Lifecycle

```
Movement Detected
    ↓
CREATE new trip (startOdometer, startSoC, startLocation)
    ↓
MONITOR: Add waypoints, update endOdometer/endSoC
    ↓
Locked + Stationary for 5 polls (5×20sec = ~2min)
    ↓
CLOSE trip: Calculate electricity (SoC delta × battery capacity)
    ↓
Stored in bydVehicles/{vin}/trips/{tripId}
```

### Trip Data Schema
```
{
  vin: string
  startDate: Timestamp
  endDate: Timestamp
  startOdometer: number
  endOdometer: number
  startSoC: number (0-1)
  endSoC: number (0-1)
  distanceKm: number
  durationMinutes: number
  electricity: number (kWh)
  status: 'in_progress' | 'completed'
  source: 'byd_polling'
  vehicleId: string (same as vin)
  points: { lat, lon, timestamp, type: 'start'|'waypoint'|'end' }[]
}
```

---

## Charging Session Tracking

### Detection
- **Start**: `isCharging=true` detected in polling/realtime
- **Session ID**: Created and tracked in `activeChargeSessionId`
- **Updates**: SoC, remainingMinutes, chargeType captured

### Data Stored
```
{
  vin: string
  startDate: Timestamp
  startSoC: number
  endSoC: number (0 until complete)
  consumptionKwh: number (calculated from SoC delta)
  chargeType: string
  status: 'in_progress' | 'completed'
}
```

---

## MQTT Integration

### What MQTT Does

1. **Listens** to BYD push notifications on MQTT broker
2. **NO DECRYPTION** needed - just triggers polling
3. **Events received**:
   - `vehicleInfo` - State updates (locks, charging, etc.)
   - `remoteControl` - Command results
4. **Activates polling** on relevant events

### Event Processing

```
MQTT vehicleInfo Event
    ↓
Extract: isUnlocked (if true, activate polling)
    ↓
Poll vehicle: getRealtime + getGps
    ↓
Update Firestore + detect trip/charge changes

MQTT remoteControl Event
    ↓
Extract: controlType (if UNLOCK, activate polling)
    ↓
Log event to lastControlEvent
    ↓
Poll vehicle: getRealtime + getGps
```

### Session Sharing
- Master session stored in `bydVehicles/{vin}/private/mqttSession`
- Contains: `userId`, `signToken`, `encryToken`
- All functions restore this session (don't create new ones)
- MQTT listener uses same tokens as Firebase functions

---

## Frontend Data Integration Points

### Components Reading Data

#### LiveVehicleStatus.tsx
- `useVehicleStatus()` hook
- Shows: SoC %, charging state, trip active indicator
- Updates charging target SoC every 60s when charging

#### ChargeCard.tsx
- Shows: kWh charged, cost, charger type, SoC change
- Reads: charge session data from Firestore

#### Trip Cards & Lists
- Shows: distance, time, efficiency
- Reads: trip documents from Firestore
- Calculated fields: consumption (SoC delta × batteryCapacity)

### Currently Unused in UI
- lastSpeed
- exteriorTemp / interiorTemp
- doors / windows status
- tirePressure details
- lastLocation.heading

**These could be displayed in:**
- Vehicle status card (temperature, window/door status)
- Live dashboard (current speed, heading)
- Maintenance alerts (tire pressure warnings)

---

## Session Management

### Session Lifetime
- Duration: 12 hours
- Stored in: `bydVehicles/{vin}/private/mqttSession`
- Checked on each function call
- Auto-renewed if expired

### Session Refresh Flow
```
Function called
    ↓
Check Firestore for stored session
    ↓
Is session < 12 hours old?
    ├─ YES: Restore and use (NO new login)
    └─ NO: Login fresh, store new session
```

---

## Firestore Structure

### Collections
```
bydVehicles/                              (top-level collection)
├── {vin}/                               (one doc per vehicle)
│   ├── (vehicle metadata)
│   ├── lastSoC, lastRange, lastOdometer, etc.
│   ├── isCharging, isLocked, isOnline
│   ├── exterior/interiorTemp
│   ├── doors, windows, tirePressure
│   ├── lastLocation (lat, lon, heading)
│   ├── activeTripId, activeChargeSessionId
│   ├── pollingActive, pollingActivatedAt
│   ├── private/                        (subcollection)
│   │   ├── credentials (encrypted username/password)
│   │   ├── mqttSession (master session tokens)
│   │   └── [used only by backend]
│   ├── trips/                          (subcollection)
│   │   ├── {tripId}/
│   │   │   ├── (trip metadata)
│   │   │   └── points/ (GPS waypoints)
│   │   └── [status: in_progress/completed]
│   └── charges/                        (subcollection)
│       └── {chargeId}/
│           └── (charge metadata)
```

---

## Implementation Checklist

### ✅ Completed
- [x] Session sharing architecture (Firestore-based)
- [x] All 9 remote control commands available
- [x] bydCloseWindows() - Close windows
- [x] bydSeatClimate(vin, seat, mode, pin) - Seat heating
- [x] bydBatteryHeat() - Battery preconditioning
- [x] Movement detection (odometer + GPS)
- [x] Trip detection and lifecycle management
- [x] Charging session tracking
- [x] MQTT listener polling activation
- [x] All data fields captured and stored
- [x] Frontend API functions exported

### 🎯 Optional Future Enhancements
- [ ] Update useVehicleStatus hook to include unused fields (doors, windows, temps)
- [ ] Create vehicle control dashboard page
- [ ] Add vehicle status card showing doors/windows/temps
- [ ] Maintenance alerts for tire pressure
- [ ] Speed/heading display during active trips
- [ ] Battery preconditioning schedule/automation
- [ ] Climate schedule/automation
- [ ] Window control automation (close on lock, etc.)

---

## Testing Checklist

### Remote Commands
- [ ] Lock vehicle - test `bydLock(vin, pin)`
- [ ] Unlock vehicle - test `bydUnlock(vin, pin)`
- [ ] Flash lights - test `bydFlashLights(vin, pin)`
- [ ] Start climate 22°C - test `bydStartClimate(vin, 22, pin)`
- [ ] Stop climate - test `bydStopClimate(vin, pin)`
- [ ] Close windows - test `bydCloseWindows(vin, pin)` **[NEW]**
- [ ] Seat climate driver high - test `bydSeatClimate(vin, 0, 3, pin)` **[NEW]**
- [ ] Battery heat - test `bydBatteryHeat(vin, pin)` **[NEW]**

### Data Retrieval
- [ ] Get realtime data - all fields populated
- [ ] Get GPS - location + heading populated
- [ ] Get charging status - accurate isCharging state
- [ ] Wake vehicle - retries when sleeping
- [ ] Diagnostic - all endpoints respond

### MQTT/Trip Detection
- [ ] Unlock via BYD app triggers polling
- [ ] Vehicle movement detected (odo ≥1km)
- [ ] Trip created with correct start/end
- [ ] Trip closed after 5 stationary polls
- [ ] Electricity calculated from SoC delta
- [ ] GPS waypoints collected

### Charging
- [ ] Charging session created when isCharging=true
- [ ] SoC tracked during charge
- [ ] Session closes when isCharging=false
- [ ] kWh calculated correctly (SoC delta × capacity)

---

## API Reference Summary

### Frontend Functions (src/services/bydApi.ts)

```typescript
// Authentication
bydConnect(username, password, countryCode, controlPin?, userId?)
bydDisconnect(vin)

// Data Retrieval
bydGetRealtime(vin)          // Battery, temps, locks, etc.
bydGetGps(vin)               // Location + heading
bydGetCharging(vin)          // Charging status
bydWakeVehicle(vin, activatePolling?)
bydDiagnostic(vin)           // Test all endpoints
bydPollVehicle(vin)          // Trip detection polling

// Remote Control (NEW: CLOSE_WINDOWS, SEAT_CLIMATE, BATTERY_HEAT)
bydLock(vin, pin?)
bydUnlock(vin, pin?)
bydFlashLights(vin, pin?)
bydStartClimate(vin, temperature?, pin?)
bydStopClimate(vin, pin?)
bydCloseWindows(vin, pin?)            // [NEW]
bydSeatClimate(vin, seat, mode, pin?) // [NEW]
bydBatteryHeat(vin, pin?)             // [NEW]
```

### Client Methods (functions/src/byd/client.ts)

All methods available in BydClient class, called by Firebase functions:
- lock(vin, pin?)
- unlock(vin, pin?)
- flashLights(vin, pin?)
- honkHorn(vin, pin?)
- startClimate(vin, tempCelsius, pin?)
- stopClimate(vin, pin?)
- closeWindows(vin, pin?)            // [NEW]
- seatClimate(vin, seat, mode, pin?) // [NEW]
- batteryHeat(vin, pin?)             // [NEW]
- getRealtime(vin)
- getGps(vin)
- getChargingStatus(vin)
- getVehicles()
- login()

---

## Known Limitations & Considerations

1. **Odometer Precision**: Reports in 1km increments (not sub-km)
2. **GPS Accuracy**: Depends on vehicle GPS hardware
3. **Control PIN**: Required for all remote commands (stored encrypted)
4. **Session Expiry**: 12 hours - auto-refreshes on use
5. **Rate Limiting**: PIN verification can be rate-limited (wait 30+ seconds)
6. **Battery Capacity**: Default 82.56 kWh (configurable per vehicle)
7. **Charging Calculation**: Estimated from SoC delta (not metered)
8. **Sleep Mode**: Some data unavailable when car completely asleep

---

## Next Steps

### Immediate
1. Deploy the updated backend with 3 new functions
2. Test each new remote command with actual vehicle
3. Verify no TypeScript errors

### Short-term (This Sprint)
1. Create vehicle control dashboard page in BYD Stats app
2. Add buttons for:
   - Close windows
   - Seat climate (driver/passenger heating)
   - Battery heat (preconditioning)
3. Update useVehicleStatus to include unused fields

### Medium-term
1. Create maintenance alerts for tire pressure
2. Add temperature display to vehicle status
3. Create trip details modal showing GPS path + waypoints
4. Vehicle status card with doors/windows/temps
5. Speed and heading display during trips

---

## Summary

The BYD Stats backend is now **feature-complete** with:
- ✅ 9 remote control commands
- ✅ 6+ data retrieval endpoints
- ✅ Automatic trip & charge detection
- ✅ MQTT push notifications → polling bridge
- ✅ Comprehensive vehicle state tracking
- ✅ Secure session management
- ✅ All data captured and stored

**Ready for UI implementation** - the backend supports everything PyBYD can do!
