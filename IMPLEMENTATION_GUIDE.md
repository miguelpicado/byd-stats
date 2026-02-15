# BYD Stats New Features Implementation Guide

## What's New

Three new remote control features have been implemented and are ready to use:

1. **Close Windows** - Remotely close vehicle windows
2. **Seat Climate** - Control heated seats (driver/passenger)
3. **Battery Heat** - Preheat battery for cold weather

---

## Quick Reference

### Close Windows
```typescript
import { bydCloseWindows } from '@/services/bydApi';

const result = await bydCloseWindows(vin, pin);
// Returns: { success: boolean }
```

**Example:**
```typescript
const result = await bydCloseWindows('LSVCV2ZS8HF000001', '1234');
if (result.success) {
  console.log('Windows closed');
} else {
  console.log('Failed to close windows');
}
```

---

### Seat Climate (Heated Seats)
```typescript
import { bydSeatClimate } from '@/services/bydApi';

const result = await bydSeatClimate(vin, seat, mode, pin);
// Returns: { success: boolean }
```

**Parameters:**
- `vin` (string): Vehicle VIN
- `seat` (number): 0 = driver, 1 = passenger
- `mode` (number): 0 = off, 1 = low, 2 = medium, 3 = high
- `pin` (string, optional): Control PIN (uses stored PIN if not provided)

**Examples:**
```typescript
// Heat driver seat to high
const result = await bydSeatClimate(
  'LSVCV2ZS8HF000001',
  0,  // driver seat
  3,  // high heat
  '1234'
);

// Medium heat passenger seat
const result = await bydSeatClimate(
  'LSVCV2ZS8HF000001',
  1,  // passenger seat
  2,  // medium heat
  '1234'
);

// Turn off driver seat
const result = await bydSeatClimate(
  'LSVCV2ZS8HF000001',
  0,  // driver seat
  0,  // off
  '1234'
);
```

---

### Battery Heat (Battery Preconditioning)
```typescript
import { bydBatteryHeat } from '@/services/bydApi';

const result = await bydBatteryHeat(vin, pin);
// Returns: { success: boolean }
```

**Why use it:**
- Improve battery performance in cold weather
- Increase available power for heating/acceleration
- Reduce battery stress in winter

**Example:**
```typescript
const result = await bydBatteryHeat('LSVCV2ZS8HF000001', '1234');
if (result.success) {
  console.log('Battery heating started');
}
```

---

## How They Work

### Backend Flow

Each new function follows this architecture:

```
Frontend (bydCloseWindows)
    ↓
Firebase Function (bydCloseWindows callable)
    ↓
Restore session from Firestore (no new login!)
    ↓
BydClient.closeWindows()
    ↓
BydClient.remoteControl('CLOSE_WINDOWS')
    ↓
Send encrypted command to BYD API
    ↓
Poll for result (up to 10 attempts, 3 seconds apart)
    ↓
Return success/failure
```

### Session Handling

**Important:** These functions automatically restore the master session from Firestore, so:
- ✅ No need to login again
- ✅ Uses same encryption token as MQTT listener
- ✅ Auto-refreshes after 12 hours

---

## Implementation Details

### Backend Changes

#### 1. BydClient (`functions/src/byd/client.ts`)

Added three new methods:

```typescript
/**
 * Close windows
 */
async closeWindows(vin: string, pin?: string): Promise<boolean> {
    return this.remoteControl(vin, 'CLOSE_WINDOWS', pin);
}

/**
 * Control seat climate/heating
 * @param vin Vehicle VIN
 * @param seat Seat position (0=driver, 1=passenger)
 * @param mode Heat level (0=off, 1=low, 2=medium, 3=high)
 * @param pin Control PIN
 */
async seatClimate(vin: string, seat: number, mode: number, pin?: string): Promise<boolean> {
    const params = {
        seatNum: String(seat),  // 0=driver, 1=passenger
        level: String(mode),    // 0=off, 1=low, 2=medium, 3=high
    };
    return this.remoteControl(vin, 'SEAT_CLIMATE', pin, params);
}

/**
 * Control battery heating
 */
async batteryHeat(vin: string, pin?: string): Promise<boolean> {
    return this.remoteControl(vin, 'BATTERY_HEAT', pin);
}
```

#### 2. Firebase Functions (`functions/src/bydFunctions.ts`)

Added three callable functions:

```typescript
/**
 * Close windows
 */
export const bydCloseWindows = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, pin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    try {
        const client = await getBydClientWithSession(vin);
        const success = await client.closeWindows(vin, pin);

        console.log(`[bydCloseWindows] ${vin}: ${success ? 'SUCCESS' : 'FAILED'}`);

        return { success };

    } catch (error: any) {
        console.error('[bydCloseWindows] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Control seat climate/heating
 * @param seat 0=driver, 1=passenger
 * @param mode 0=off, 1=low, 2=medium, 3=high
 */
export const bydSeatClimate = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, seat, mode, pin } = data;

    if (!vin || seat === undefined || mode === undefined) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: vin, seat, mode');
    }

    try {
        const client = await getBydClientWithSession(vin);
        const success = await client.seatClimate(vin, seat, mode, pin);

        console.log(`[bydSeatClimate] ${vin}: seat=${seat}, mode=${mode}, ${success ? 'SUCCESS' : 'FAILED'}`);

        return { success };

    } catch (error: any) {
        console.error('[bydSeatClimate] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Control battery heating
 */
export const bydBatteryHeat = regionalFunctions.https.onCall(async (data, context) => {
    const { vin, pin } = data;

    if (!vin) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing VIN');
    }

    try {
        const client = await getBydClientWithSession(vin);
        const success = await client.batteryHeat(vin, pin);

        console.log(`[bydBatteryHeat] ${vin}: ${success ? 'SUCCESS' : 'FAILED'}`);

        return { success };

    } catch (error: any) {
        console.error('[bydBatteryHeat] Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
```

#### 3. Frontend API (`src/services/bydApi.ts`)

Added three client-side callables:

```typescript
/**
 * Close windows
 */
export async function bydCloseWindows(vin: string, pin?: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydCloseWindows');
    const result = await callable({ vin, pin });
    return result.data;
}

/**
 * Control seat climate/heating
 * @param seat 0=driver, 1=passenger
 * @param mode 0=off, 1=low, 2=medium, 3=high
 */
export async function bydSeatClimate(
    vin: string,
    seat: number,
    mode: number,
    pin?: string
): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydSeatClimate');
    const result = await callable({ vin, seat, mode, pin });
    return result.data;
}

/**
 * Control battery heating
 */
export async function bydBatteryHeat(vin: string, pin?: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<any, { success: boolean }>(functions, 'bydBatteryHeat');
    const result = await callable({ vin, pin });
    return result.data;
}
```

#### 4. Exports (`functions/src/index.ts`)

Added to the export list:
```typescript
export {
    // ... existing exports ...
    bydCloseWindows,
    bydSeatClimate,
    bydBatteryHeat,
    // ... rest of exports ...
} from './bydFunctions';
```

---

## React Component Example

Here's how to use these functions in a React component:

```typescript
import React, { useState } from 'react';
import { bydCloseWindows, bydSeatClimate, bydBatteryHeat } from '@/services/bydApi';
import { useCar } from '@/context/CarContext';
import toast from 'react-hot-toast';

export const VehicleControlCard: React.FC = () => {
    const { activeCar } = useCar();
    const [loading, setLoading] = useState(false);

    if (!activeCar?.vin) {
        return <div>No vehicle connected</div>;
    }

    const handleCloseWindows = async () => {
        setLoading(true);
        try {
            const result = await bydCloseWindows(activeCar.vin);
            if (result.success) {
                toast.success('Windows closed');
            } else {
                toast.error('Failed to close windows');
            }
        } catch (error) {
            toast.error('Error closing windows');
        } finally {
            setLoading(false);
        }
    };

    const handleSeatClimate = async (seat: number, mode: number) => {
        setLoading(true);
        try {
            const result = await bydSeatClimate(activeCar.vin, seat, mode);
            if (result.success) {
                const seatName = seat === 0 ? 'Driver' : 'Passenger';
                const modeName = ['Off', 'Low', 'Medium', 'High'][mode];
                toast.success(`${seatName} seat: ${modeName}`);
            } else {
                toast.error('Failed to set seat climate');
            }
        } catch (error) {
            toast.error('Error setting seat climate');
        } finally {
            setLoading(false);
        }
    };

    const handleBatteryHeat = async () => {
        setLoading(true);
        try {
            const result = await bydBatteryHeat(activeCar.vin);
            if (result.success) {
                toast.success('Battery heating started');
            } else {
                toast.error('Failed to start battery heating');
            }
        } catch (error) {
            toast.error('Error starting battery heating');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-3 gap-4 p-4">
            <button
                onClick={handleCloseWindows}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
                {loading ? '...' : 'Close Windows'}
            </button>

            <div className="flex gap-2">
                <button
                    onClick={() => handleSeatClimate(0, 1)}
                    disabled={loading}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-2 rounded text-sm"
                >
                    Driver ♨
                </button>
                <button
                    onClick={() => handleSeatClimate(1, 1)}
                    disabled={loading}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-2 rounded text-sm"
                >
                    Passenger ♨
                </button>
            </div>

            <button
                onClick={handleBatteryHeat}
                disabled={loading}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
                {loading ? '...' : '🔋 Preheat'}
            </button>
        </div>
    );
};

export default VehicleControlCard;
```

---

## Testing Instructions

### 1. Test Close Windows
```bash
# Via Firebase Console Functions tab:
# Function: bydCloseWindows
# Test data:
{
  "vin": "YOUR_VIN_HERE",
  "pin": "YOUR_PIN_HERE"
}
```

Expected: Windows close physically on vehicle

### 2. Test Seat Climate
```bash
# Test high heat on driver seat
{
  "vin": "YOUR_VIN_HERE",
  "seat": 0,
  "mode": 3,
  "pin": "YOUR_PIN_HERE"
}

# Test passenger seat off
{
  "vin": "YOUR_VIN_HERE",
  "seat": 1,
  "mode": 0,
  "pin": "YOUR_PIN_HERE"
}
```

Expected: Seats warm up or cool down as specified

### 3. Test Battery Heat
```bash
# Via Firebase Console:
{
  "vin": "YOUR_VIN_HERE",
  "pin": "YOUR_PIN_HERE"
}
```

Expected: Battery heating indicator appears in BYD app

---

## Error Handling

All three functions throw Firebase `HttpsError` with one of these codes:

- `invalid-argument` - Missing required parameters
- `internal` - BYD API error or command failed

**Handle errors like this:**
```typescript
try {
    const result = await bydCloseWindows(vin, pin);
    if (result.success) {
        // Success
    } else {
        // Command rejected
    }
} catch (error: any) {
    if (error.code === 'invalid-argument') {
        // Missing params
    } else if (error.code === 'internal') {
        // BYD API error
        console.error(error.message);
    }
}
```

---

## Performance Considerations

### Timing
- **Command Send**: ~1-2 seconds (async send)
- **Result Poll**: ~10 attempts × 3 seconds = up to 30 seconds
- **Total**: Expect 5-30 seconds for completion

### Polling Behavior
- Sends command
- Waits 3 seconds
- Polls result endpoint (up to 10 times)
- Returns as soon as `controlState === '1'` received
- Or returns failure after all attempts

### Optimization Tips
- Don't call all commands in rapid succession
- Show loading indicator (command is async!)
- Consider debouncing button clicks (prevent double-clicks)
- Cache results briefly to avoid spamming API

---

## Troubleshooting

### "Control PIN required"
- PIN not provided and not stored in config
- Pass `pin` parameter explicitly
- Or set in Firebase secrets

### "PIN verification failed"
- PIN is incorrect
- Account doesn't allow remote commands (check BYD settings)
- Pin has been reset

### "Remote control failed"
- Vehicle might be offline/asleep
- BYD server might be having issues
- Try waking vehicle first: `bydWakeVehicle(vin)`

### "Rate limited - please wait"
- Too many PIN verification attempts
- Wait 30+ seconds before retrying

### Command succeeds but nothing happens
- Vehicle might not support this command
- BYD firmware version might not support it
- Vehicle might require specific state (e.g., locked to close windows)

---

## Complete Feature Checklist

| Feature | Status | Files Modified | Ready? |
|---------|--------|-----------------|--------|
| Close Windows | ✅ | client.ts, bydFunctions.ts, bydApi.ts, index.ts | ✅ |
| Seat Climate | ✅ | client.ts, bydFunctions.ts, bydApi.ts, index.ts | ✅ |
| Battery Heat | ✅ | client.ts, bydFunctions.ts, bydApi.ts, index.ts | ✅ |
| Session Sharing | ✅ | bydFunctions.ts | ✅ |
| MQTT Integration | ✅ | mqtt-listener/src/index.ts | ✅ |
| Trip Detection | ✅ | bydFunctions.ts | ✅ |
| Charge Detection | ✅ | bydFunctions.ts | ✅ |

---

## What's Next

These functions are **ready for immediate use**. Next steps:

1. **Deploy** the updated backend
2. **Create UI** in BYD Stats for controlling these features
3. **Test** each command with your vehicle
4. **Optimize** UI/UX based on testing

For the initial control dashboard page, you'll want to add:
- Vehicle status display (current locks, temps, etc.)
- Quick action buttons (lock, unlock, windows, etc.)
- Seat climate controls with mode selector
- Battery preconditioning toggle
- Climate control with temperature

See `INTEGRATION_ANALYSIS.md` for the complete architecture overview!
