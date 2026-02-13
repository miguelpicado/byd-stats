# System Prompt / Instructions for LLM

**Context**: You are fixing a critical bug in a Firebase + React application where vehicle trips are being created incorrectly (one trip per webhook event) and are not visible in the frontend due to ID mismatches.

**Objective**: Fix 5 specific bugs in the Trip Creation logic and ensure real-time tracking works.

**Repository Structure**:
- `functions/src/index.ts`: Firebase Cloud Functions (webhook handler).
- `src/services/firebase.ts`: Frontend Firebase service (queries).
- `src/hooks/useMergedTrips.ts`: React hook for fetching trips.
- `src/providers/TripsProvider.tsx`: React context provider.
- `src/types/index.ts`: TypeScript definitions.

---

## Instructions

### Step 1: Fix Client-Side Visibility (ID Mismatch)

The app currently filters trips by `userId` (internal app ID), but trips are stored with `vehicleId` (Smartcar ID).

1.  **Modify `src/types/index.ts`**:
    - Add `vehicleId?: string;` to the `Trip` interface.

2.  **Modify `src/providers/TripsProvider.tsx`**:
    - Inside `TripsProvider`, get the `smartcarVehicleId` from `activeCar`.
    - Pass `activeCar?.smartcarVehicleId` as the third argument to `useMergedTrips` instead of `activeCarId`.
    ```typescript
    const { activeCar } = useCar();
    // ...
    const { allTrips, ... } = useMergedTrips(localTrips, settings, activeCar?.smartcarVehicleId || null, serverDateRange);
    ```

3.  **Modify `src/hooks/useMergedTrips.ts`**:
    - Rename the third argument from `activeCarId` to `vehicleId`.
    - Update the dependency array in `useEffect`.

4.  **Modify `src/services/firebase.ts`**:
    - In `subscribeToTrips` and `fetchTripsPage`, change the query constraint:
      - FROM: `where('userId', '==', userId)`
      - TO: `where('vehicleId', '==', userId)` (Note: the parameter name in the function might still be `userId`, but it now receives a `vehicleId`. Rename the parameter to `vehicleId` for clarity).

### Step 2: Fix Server-Side Webhook Logic (Mini-Trips Bug)

The webhook creates a new trip for every event because `isLocked=true` closes trips immediately, but movement starts them.

1.  **Modify `functions/src/index.ts` -> `smartcarWebhook`**:
    -   **Refactor the Trip Logic (Steps 3 & 4 in the code)** to implement this state machine:

    ```typescript
    // Define logic:
    // 1. If IS_LOCKED=true AND HAS_MOVEMENT:
    //    - Do NOT start a "live" trip.
    //    - Create a "completed" trip immediately (retroactive).
    //    - Set closedReason: 'locked_movement'.

    // 2. If IS_LOCKED=false AND HAS_MOVEMENT AND !activeTripId:
    //    - Start new active trip (status: 'in_progress').

    // 3. If IS_LOCKED=true AND activeTripId:
    //    - Close the active trip.

    // 4. If activeTripId AND new data:
    //    - Update active trip.
    //    - FIX DISTANCE CALCULATION:
    //      - Do NOT use FieldValue.increment(odoDelta).
    //      - Calculate distance = currentOdometer - trip.startOdometer.
    ```

    - **Fix Location Handling**:
      - The webhook `data` often has `location: null`.
      - If `location` is missing in the webhook but we are starting/closing a trip, try to fetch it explicitly if possible, or gracefully handle nulls (do not crash).

### Step 3: Implement Active Polling (Real-Time Tracking)

Trips only update when the webhook fires (every ~hour). We need real-time updates when the car is moving.

1.  **Modify `functions/src/index.ts`**:
    - Create a new scheduled function `pollActiveVehicles`.
    - Schedule: `every 1 minutes`.
    - Logic:
      - Query `db.collection('vehicles').where('pollingActive', '==', true)`.
      - For each vehicle:
        - Call Smartcar API: `odometer()`, `location()`.
        - Update `vehicles/{id}` with new location/odometer.
        - Run the **same trip logic** as the webhook (Update active trip if exists).
        - **Auto-Stop Polling**: If `odometer` has not changed for > 5 minutes, set `pollingActive = false`.

### Step 4: Database Indexes

-   Notify the user that they must create a new Firestore Composite Index for:
    -   Collection: `trips`
    -   Fields: `vehicleId` (ASC), `status` (ASC), `startDate` (DESC).
