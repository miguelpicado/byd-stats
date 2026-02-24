# Solución: Reparación de la Lógica de Viajes y Consumos Estimados

Este documento contiene los cambios exactos que deben aplicarse en el archivo `functions/src/bydFunctions.ts` para solucionar los problemas con los viajes cortos y los fallos de precisión con los porcentajes de batería.

Al tratarse de cambios en el backend (Firebase Functions), debes aplicarlos cuando estés en el entorno adecuado y luego hacer el deploy (`npm run deploy` o `firebase deploy --only functions`).

## 1. Proteger el cálculo de la Eficiencia Media de "Glitches"

Buscar la función `calculateMovingAverageEfficiency` (aprox. línea 1685) y modificar el bucle `forEach` para ignorar consumos absurdos:

**Cambiar:**
```typescript
        tripsSnap.docs.forEach(doc => {
            const data = doc.data();
            // Only use trips with significant distance and electricity to avoid biasing average
            if (data.distanceKm > 0.5 && data.electricity > 0) {
                totalKwh += data.electricity;
                totalKm += data.distanceKm;
            }
        });
```

**Por:**
```typescript
        tripsSnap.docs.forEach(doc => {
            const data = doc.data();
            // Only use trips with significant distance and electricity to avoid biasing average
            if (data.distanceKm > 0.5 && data.electricity > 0) {
                // Filtro de cordura: ignorar viajes con eficiencia < 10 o > 40 kWh/100km
                // para evitar que los glitches de BYD rompan la media
                const tripEfficiency = (data.electricity / data.distanceKm) * 100;
                if (tripEfficiency >= 10 && tripEfficiency <= 40) {
                    totalKwh += data.electricity;
                    totalKm += data.distanceKm;
                }
            }
        });
```

## 2. Flexibilizar el inicio del viaje y el polling agresivo

Buscar la función `processVehicleState`. Hay que redefinir cuándo consideramos que el coche está listo para moverse y cambiar la condición del `if (!activeTripId && hasMovement)`.

**Buscar (aprox. línea 1373):**
```typescript
    // SPEED-based detection (The most reliable indicator if available)
    const hasSpeedMovement = (realtime.speed || 0) > 0;

    const hasMovement = hasOdoMovement || hasGpsMovement || hasSpeedMovement;
    const isStationary = !hasMovement;
```

**Añadir debajo:**
```typescript
    // Detect intent to drive even before physical movement
    const gearNotPark = realtime.gear !== undefined && realtime.gear !== 1 && realtime.gear !== 0;
    const epbReleased = realtime.parkingBrake !== undefined && realtime.parkingBrake === 0;
    const isReadyToDrive = gearNotPark || epbReleased || hasSpeedMovement;
```

**Buscar (aprox. línea 1465):**
```typescript
    // =========================================================================
    // TRIP LOGIC
    // =========================================================================

    if (!activeTripId && hasMovement) {
```

**Cambiar por:**
```typescript
    // =========================================================================
    // TRIP LOGIC
    // =========================================================================

    // Iniciamos el flujo de viaje si hay movimiento O si el usuario muestra intención de conducir
    if (!activeTripId && (hasMovement || isReadyToDrive)) {
```

*(Nota: En el bloque interior de `strictStart` ya tienes validado `gearNotPark` y `epbReleased`, así que ahora entrará correctamente).*

## 3. Blindar el cálculo del `socDelta` (Precisión de decimales)

Buscar la función `closeTrip` (aprox. línea 1747) y cambiar la evaluación por porcentaje entero.

**Cambiar:**
```typescript
    let electricityKwh = 0;

    if (socDelta >= 0.01) {
        // Normal SoC-based calculation
        electricityKwh = Math.round(Math.max(0, socDelta * batteryCapacity) * 100) / 100;
```

**Por:**
```typescript
    let electricityKwh = 0;
    
    // Multiplicar y redondear para evitar errores de coma flotante (ej. 0.80 - 0.79 = 0.00999999)
    const socDeltaPercent = Math.round(socDelta * 100);

    if (socDeltaPercent >= 1) {
        // Normal SoC-based calculation
        electricityKwh = Math.round(Math.max(0, socDelta * batteryCapacity) * 100) / 100;
```

## 4. Asegurar que los viajes con gasto de batería no se marquen como 'idle'

En la misma función `closeTrip`, unas líneas más abajo, en el objeto `updateData`.

**Cambiar:**
```typescript
    const updateData: any = {
        status: 'completed',
        type: totalDistance >= 0.5 ? 'trip' : 'idle',
```

**Por:**
```typescript
    const updateData: any = {
        status: 'completed',
        // Si no ha recorrido 0.5km pero ha gastado 1% o más de batería, forzamos que sea un 'trip'
        type: (totalDistance >= 0.5 || socDeltaPercent >= 1) ? 'trip' : 'idle',
```

## 5. Aplicar la misma corrección matemática en `bydFixTripV2`

Buscar en la función `bydFixTripV2` (aprox. línea 2157).

**Cambiar:**
```typescript
            let electricityKwh = 0;

            if (socDelta >= 0.01) {
                // Normal SoC-based calculation
```

**Por:**
```typescript
            let electricityKwh = 0;
            
            const socDeltaPercent = Math.round(socDelta * 100);

            if (socDeltaPercent >= 1) {
                // Normal SoC-based calculation
```

---
*Una vez guardados estos cambios, puedes desplegar las funciones de Firebase con tranquilidad.*