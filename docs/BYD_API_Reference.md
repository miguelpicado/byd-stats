# Documentación de Parámetros API BYD

Este documento registra todos los parámetros disponibles en la respuesta JSON del vehículo BYD.

## Tabla de Valores por Estado

La siguiente tabla muestra el valor esperado para cada campo en el estado "Apagado-Despierto" (basado en la captura proporcionada).

| Campo (JSON Path) | Valor (Apagado-Despierto) | Descripción |
| :--- | :--- | :--- |
| `meta.timestamp` | "2026-02-18T12:27:31.604Z" | Marca de tiempo de la respuesta del servidor |
| `meta.vin` | "LGXCH6CD0S2052990" | Número de Identificación del Vehículo (VIN) |
| `meta.serverTime` | 1771417651604 | Tiempo del servidor en formato epoch (ms) |
| `data.realtime.soc` | 54 | Estado de Carga (State of Charge) % |
| `data.realtime.range` | 311 | Autonomía estimada (km) |
| `data.realtime.odometer` | 12290 | Odómetro total (km) |
| `data.realtime.speed` | 0 | Velocidad actual (km/h) |
| `data.realtime.isCharging` | false | Indica si el vehículo está cargando (true/false) |
| `data.realtime.isLocked` | true | Indica si el vehículo está bloqueado (true/false) |
| `data.realtime.isOnline` | true | Indica si el vehículo está en línea (true/false) |
| `data.realtime.gear` | 1 | Marcha actual (1=Parking?) - POR RELLENAR |
| `data.realtime.parkingBrake` | -1 | Estado del freno de mano (-1=Desconocido?) - POR RELLENAR |
| `data.realtime.interiorTemp` | 16 | Temperatura interior (°C) |
| `data.realtime.doors.frontLeft` | false | Estado puerta delantera izquierda (false=Cerrada) |
| `data.realtime.doors.frontRight` | false | Estado puerta delantera derecha (false=Cerrada) |
| `data.realtime.doors.rearLeft` | false | Estado puerta trasera izquierda (false=Cerrada) |
| `data.realtime.doors.rearRight` | false | Estado puerta trasera derecha (false=Cerrada) |
| `data.realtime.doors.trunk` | false | Estado del maletero (false=Cerrado) |
| `data.realtime.doors.hood` | false | Estado del capó (false=Cerrado) |
| `data.realtime.windows.frontLeft` | false | Estado ventana delantera izquierda (false=Cerrada) |
| `data.realtime.windows.frontRight` | false | Estado ventana delantera derecha (false=Cerrada) |
| `data.realtime.windows.rearLeft` | false | Estado ventana trasera izquierda (false=Cerrada) |
| `data.realtime.windows.rearRight` | false | Estado ventana trasera derecha (false=Cerrada) |
| `data.realtime.tirePressure.frontLeft` | 2.6 | Presión neumático delantero izquierdo (bar) |
| `data.realtime.tirePressure.frontRight` | 2.6 | Presión neumático delantero derecho (bar) |
| `data.realtime.tirePressure.rearLeft` | 3 | Presión neumático trasero izquierdo (bar) |
| `data.realtime.tirePressure.rearRight` | 3 | Presión neumático trasero derecho (bar) |
| `data.realtime.raw.powerSystem` | 0 | Sistema de potencia (0=Apagado?) - POR RELLENAR |
| `data.realtime.raw.rightRearTirepressure` | 3 | Presión neumático trasero izquierdo (Raw) |
| `data.realtime.raw.chargeState` | 15 | Estado de carga (Código 15) - POR RELLENAR |
| `data.realtime.raw.evEndurance` | 311 | Autonomía eléctrica (km) |
| `data.realtime.raw.rightFrontTireStatus` | 0 | Estado neumático delantero derecho (0=OK?) - POR RELLENAR |
| `data.realtime.raw.totalEnergy` | "17.8kW·h/100km" | Consumo medio total (Texto con unidad) |
| `data.realtime.raw.elecPercent` | 54 | Porcentaje batería (Raw) |
| `data.realtime.raw.rrSeatVentilationState` | 0 | Ventilación asiento trasero derecho - POR RELLENAR |
| `data.realtime.raw.upgradeStatus` | 0 | Estado de actualización OTA - POR RELLENAR |
| `data.realtime.raw.rightFrontTirepressure` | 2.6 | Presión neumático delantero derecho (Raw) |
| `data.realtime.raw.engineStatus` | 0 | Estado del motor (0=Apagado?) - POR RELLENAR |
| `data.realtime.raw.epb` | -1 | Freno de estacionamiento electrónico (EPB) - POR RELLENAR |
| `data.realtime.raw.rapidTireLeak` | -1 | Alerta de fuga rápida de neumático - POR RELLENAR |
| `data.realtime.raw.oilPressureSystem` | 0 | Sistema de presión de aceite - POR RELLENAR |
| `data.realtime.raw.rrThirdHeatState` | 0 | Calefacción 3ra fila derecha? - POR RELLENAR |
| `data.realtime.raw.airRunState` | 2 | Estado del climatizador (2=Auto/On?) - POR RELLENAR |
| `data.realtime.raw.eps` | 0 | Dirección asistida eléctrica (EPS) - POR RELLENAR |
| `data.realtime.raw.chargingState` | -1 | Estado de carga (Código -1) - POR RELLENAR |
| `data.realtime.raw.totalConsumptionEn` | "17.8kW·h/100km" | Consumo total (Inglés) |
| `data.realtime.raw.waitStatus` | 0 | POR RELLENAR |
| `data.realtime.raw.leftFrontDoorLock` | 2 | Bloqueo puerta delantera izquierda (2=Bloqueado?) - POR RELLENAR |
| `data.realtime.raw.totalPower` | 0 | Potencia total actual (kW) |
| `data.realtime.raw.copilotSeatHeatState` | 1 | Calefacción asiento copiloto (Nivel 1) |
| `data.realtime.raw.fullHour` | -1 | Horas para carga completa - POR RELLENAR |
| `data.realtime.raw.enduranceMileage` | 311 | Kilometraje de autonomía |
| `data.realtime.raw.trunkLid` | 0 | Estado tapa maletero (0=Cerrado?) - POR RELLENAR |
| `data.realtime.raw.pwr` | 2 | Estado de energía (Power Mode) (2=Ready?) - POR RELLENAR |
| `data.realtime.raw.leftFrontTireStatus` | 0 | Estado neumático delantero izquierdo - POR RELLENAR |
| `data.realtime.raw.okLight` | 0 | POR RELLENAR |
| `data.realtime.raw.slidingDoor` | 0 | Puerta corredera (N/A) |
| `data.realtime.raw.sentryStatus` | 2 | Estado modo centinela (2=Activado?) - POR RELLENAR |
| `data.realtime.raw.leftRearTireStatus` | 0 | Estado neumático trasero izquierdo - POR RELLENAR |
| `data.realtime.raw.vehicleTimeZone` | "Europe/Madrid" | Zona horaria del vehículo |
| `data.realtime.raw.oilEndurance` | -1 | Autonomía combustible (N/A) |
| `data.realtime.raw.rightRearDoor` | 0 | Estado puerta trasera derecha (Raw) |
| `data.realtime.raw.mainSettingTempNew` | 22 | Temperatura configurada conductor (Nueva?) |
| `data.realtime.raw.tirepressureSystem` | 0 | Sistema de presión de neumáticos - POR RELLENAR |
| `data.realtime.raw.leftRearWindow` | 1 | Ventana trasera izquierda (1=Cerrada?) - POR RELLENAR |
| `data.realtime.raw.leftFrontTirepressure` | 2.6 | Presión neumático delantero izquierdo (Raw) |
| `data.realtime.raw.lrThirdVentilationState` | 0 | Ventilación 3ra fila izquierda? - POR RELLENAR |
| `data.realtime.raw.energyConsumption` | "18.4" | Consumo de energía reciente (valor numérico) |
| `data.realtime.raw.rightRearTireStatus` | 0 | Estado neumático trasero derecho - POR RELLENAR |
| `data.realtime.raw.mainSettingTemp` | 22 | Temperatura configurada conductor |
| `data.realtime.raw.leftRearTirepressure` | 3 | Presión neumático trasero izquierdo (Raw) |
| `data.realtime.raw.totalMileageV2` | 12290 | Kilometraje total V2 |
| `data.realtime.raw.skylight` | -1 | Techo solar (Skylight) - POR RELLENAR |
| `data.realtime.raw.enduranceMileageV2Unit` | "km" | Unidad de autonomía V2 |
| `data.realtime.raw.powerGear` | 1 | Marcha de potencia (1=P?) - POR RELLENAR |
| `data.realtime.raw.lrSeatVentilationState` | 0 | Ventilación asiento trasero izquierdo - POR RELLENAR |
| `data.realtime.raw.svs` | -1 | SVS (Service Vehicle Soon) - POR RELLENAR |
| `data.realtime.raw.abs` | 0 | Sistema ABS - POR RELLENAR |
| `data.realtime.raw.enduranceMileageV2` | 311 | Autonomía V2 |
| `data.realtime.raw.batteryHeatState` | 0 | Estado calentador batería - POR RELLENAR |
| `data.realtime.raw.esp` | 0 | ESP (Control de Estabilidad) - POR RELLENAR |
| `data.realtime.raw.remainingMinutes` | -1 | Minutos restantes de carga - POR RELLENAR |
| `data.realtime.raw.rrThirdVentilationState` | 0 | Ventilación 3ra fila derecha? - POR RELLENAR |
| `data.realtime.raw.rightFrontDoor` | 0 | Puerta delantera derecha (Raw) |
| `data.realtime.raw.fullMinute` | -1 | Minutos para carga completa - POR RELLENAR |
| `data.realtime.raw.totalMileage` | 12290 | Kilometraje total |
| `data.realtime.raw.powerBattery` | 0 | Estado batería de potencia (HV) - POR RELLENAR |
| `data.realtime.raw.rightFrontDoorLock` | 2 | Bloqueo puerta delantera derecha - POR RELLENAR |
| `data.realtime.raw.chargeHeatState` | 0 | Calentador de carga? - POR RELLENAR |
| `data.realtime.raw.ect` | 0 | Temp. refrigerante motor (ECT) - POR RELLENAR |
| `data.realtime.raw.rrSeatHeatState` | 0 | Calefacción asiento trasero derecho - POR RELLENAR |
| `data.realtime.raw.totalConsumption` | "17.8度/百公里" | Consumo total (Chino) |
| `data.realtime.raw.tirePressUnit` | 1 | Unidad de presión neumáticos (1=Bar?) - POR RELLENAR |
| `data.realtime.raw.bookingChargingMinute` | 0 | Minuto programado carga |
| `data.realtime.raw.lessOneMin` | false | Menos de un minuto restante |
| `data.realtime.raw.vehicleState` | 2 | Estado general vehículo (2=Apagado/Standby?) - POR RELLENAR |
| `data.realtime.raw.chargingSystem` | 0 | Sistema de carga - POR RELLENAR |
| `data.realtime.raw.connectState` | -1 | Estado de conexión carga (-1=Desconectado?) - POR RELLENAR |
| `data.realtime.raw.forehold` | 0 | Capó/Frunk (Raw) - POR RELLENAR |
| `data.realtime.raw.lrThirdHeatState` | 0 | Calefacción 3ra fila izquierda? - POR RELLENAR |
| `data.realtime.raw.mainSeatHeatState` | 1 | Calefacción asiento conductor (Nivel 1) |
| `data.realtime.raw.bookingChargingHour` | 0 | Hora programada carga |
| `data.realtime.raw.totalOil` | 0 | Aceite total (N/A) |
| `data.realtime.raw.oilPercent` | -1 | Porcentaje combustible (N/A) |
| `data.realtime.raw.mainSeatVentilationState` | 1 | Ventilación asiento conductor (Nivel 1) |
| `data.realtime.raw.nearestEnergyConsumptionUnit` | "kW·h/100km" | Unidad consumo reciente |
| `data.realtime.raw.ectValue` | -1 | Valor ECT - POR RELLENAR |
| `data.realtime.raw.leftFrontWindow` | 1 | Ventana delantera izquierda (Raw) (1=Cerrada?) - POR RELLENAR |
| `data.realtime.raw.remainingHours` | -1 | Horas restantes carga |
| `data.realtime.raw.steeringWheelHeatState` | 1 | Calefacción volante (1=Activado) |
| `data.realtime.raw.leftRearDoor` | 0 | Puerta trasera izquierda (Raw) |
| `data.realtime.raw.tempInCar` | 16 | Temperatura interior (Raw) |
| `data.realtime.raw.speed` | 0 | Velocidad (Raw) |
| `data.realtime.raw.rate` | -999 | Tasa de carga/descarga? - POR RELLENAR |
| `data.realtime.raw.rightRearDoorLock` | 2 | Bloqueo puerta trasera derecha - POR RELLENAR |
| `data.realtime.raw.leftRearDoorLock` | 2 | Bloqueo puerta trasera izquierda - POR RELLENAR |
| `data.realtime.raw.copilotSeatVentilationState` | 1 | Ventilación asiento copiloto (Nivel 1) |
| `data.realtime.raw.recent50kmEnergy` | "18.4kW·h/100km" | Consumo recientes 50km |
| `data.realtime.raw.brakingSystem` | 0 | Sistema de frenado - POR RELLENAR |
| `data.realtime.raw.gl` | 0 | POR RELLENAR |
| `data.realtime.raw.slidingDoorLock` | 2 | Bloqueo puerta corredera (N/A) |
| `data.realtime.raw.totalMileageV2Unit` | "km" | Unidad kilometraje V2 |
| `data.realtime.raw.rightFrontWindow` | 1 | Ventana delantera derecha (Raw) (1=Cerrada?) - POR RELLENAR |
| `data.realtime.raw.nearestEnergyConsumption` | "18.4" | Consumo reciente |
| `data.realtime.raw.ins` | -1 | POR RELLENAR |
| `data.realtime.raw.rightRearWindow` | 1 | Ventana trasera derecha (Raw) (1=Cerrada?) - POR RELLENAR |
| `data.realtime.raw.repairModeSwitch` | "0" | Interruptor modo reparación - POR RELLENAR |
| `data.realtime.raw.powerBatteryConnection` | -1 | Conexión batería potencia - POR RELLENAR |
| `data.realtime.raw.srs` | 0 | Sistema de restricción suplementaria (Airbags) - POR RELLENAR |
| `data.realtime.raw.lrSeatHeatState` | 0 | Calefacción asiento trasero izquierdo - POR RELLENAR |
| `data.realtime.raw.time` | 1771417649 | Timestamp del dato raw |
| `data.realtime.raw.leftFrontDoor` | 0 | Puerta delantera izquierda (Raw) |
| `data.realtime.raw.steeringSystem` | 0 | Sistema de dirección - POR RELLENAR |
| `data.realtime.raw.bookingChargeState` | 0 | Estado carga programada - POR RELLENAR |
| `data.realtime.raw.onlineState` | 1 | Estado online (1=Conectado?) - POR RELLENAR |
| `data.gps.error` | "Failed to trigger GPS..." | Error o estado del GPS |
| `data.charging.soc` | 54 | SoC durante carga |
| `data.charging.isCharging` | false | Estado de carga |
| `data.charging.chargeType` | null | Tipo de carga (AC/DC) |
| `data.charging.remainingMinutes` | null | Minutos restantes |
| `data.charging.targetSoc` | null | SoC objetivo |
| `data.charging.scheduledCharging` | false | Carga programada activa |
| `data.charging.raw.fullHour` | -1 | Raw horas carga completa |
| `data.charging.raw.soc` | 54 | Raw SoC |
| `data.charging.raw.fullMinute` | -1 | Raw minutos carga completa |
| `data.charging.raw.vehicleTimeZone` | "Europe/Madrid" | Raw Zona horaria |
| `data.charging.raw.updateTime` | 1771417468 | Última actualización carga |
| `data.charging.raw.connectState` | 0 | Estado conexión carga (0=Desconectado?) - POR RELLENAR |
| `data.charging.raw.chargingState` | 15 | Estado carga (Código 15) - POR RELLENAR |
| `data.charging.raw.waitStatus` | 0 | Estado espera - POR RELLENAR |

---

## Listado de Campos y Explicación

A continuación se detalla el significado de los campos principales obtenidos en la respuesta JSON.

### Sección Realtime (`data.realtime`)
Contiene la información en tiempo real del estado del vehículo.

- **soc**: State of Charge. Porcentaje de batería restante.
- **range**: Autonomía estimada en kilómetros basada en el consumo actual.
- **odometer**: Distancia total recorrida por el vehículo en kilómetros.
- **speed**: Velocidad actual del vehículo (km/h). 0 indica que está detenido.
- **isCharging**: Booleano que indica si el vehículo está cargando actualmente.
- **isLocked**: Booleano que indica si el vehículo está cerrado con seguro.
- **isOnline**: Booleano que indica si el vehículo tiene conexión a internet.
- **gear**: Marcha actual. Valor `1` parece corresponder a Parking o Neutro (POR RELLENAR confirmación de mapeo).
- **parkingBrake**: Estado del freno de mano. `-1` suele indicar estado desconocido o inactivo.
- **interiorTemp**: Temperatura interior del habitáculo en grados Celsius.

### Sección Puertas y Ventanas
Estados booleanos donde `false` generalmente significa cerrado/inactivo.
- **doors**: Objeto con el estado de puertas (frontLeft, frontRight, rearLeft, rearRight), maletero (trunk) y capó (hood).
- **windows**: Objeto con el estado de las ventanas.

### Sección Presión de Neumáticos
- **tirePressure**: Presión de cada neumático (bar).
  - frontLeft, frontRight, rearLeft, rearRight.

### Sección Raw (`data.realtime.raw`)
Esta sección contiene los datos "crudos" devueltos por la telemetría del vehículo. Muchos códigos numéricos requieren mapeo.

- **powerSystem**: Estado del sistema de potencia. POR RELLENAR.
- **chargeState**: Código de estado de carga. `15` podría indicar carga finalizada o desconectado. POR RELLENAR.
- **totalEnergy**: Consumo medio histórico.
- **elecPercent**: Otra lectura del SoC.
- **upgradeStatus**: Estado de actualizaciones OTA.
- **engineStatus**: Estado del motor (principalmente para híbridos, `0` en EV puro apagado).
- **epb**: Electronic Parking Brake. POR RELLENAR.
- **airRunState**: Estado del climatizador (AC). Valor `2` indica funcionamiento (posiblemente encendido o auto).
- **chargingState**: Otro indicador de estado de carga.
- **waitStatus**: POR RELLENAR.
- **doorLocks**: (leftFrontDoorLock, etc.) Indican si el seguro está puesto. Valor `2` parece ser "Bloqueado".
- **seatHeatState**: (copilotSeatHeatState, mainSeatHeatState, etc.) Nivel de calefacción de asientos. `1` indica encendido (nivel bajo/medio?).
- **seatVentilationState**: (copilotSeatVentilationState, etc.) Nivel de ventilación de asientos.
- **steeringWheelHeatState**: Calefacción del volante. `1` indica encendido.
- **vehicleTimeZone**: Zona horaria configurada en el vehículo.
- **mainSettingTemp**: Temperatura configurada en el climatizador.
- **vehicleState**: Estado global del vehículo. `2` podría ser "Estacionado" o "Apagado". POR RELLENAR.
- **pwr**: Modo de energía. POR RELLENAR.
- **sentryStatus**: Estado del modo centinela/vigilancia.
- **svs**: Service Vehicle Soon. Indicador de mantenimiento.

### Sección Charging (`data.charging`)
Información específica sobre el proceso de carga.

- **soc, isCharging**: Redundante con realtime pero específico del módulo de carga.
- **raw.smartJourneyDto**: Información sobre planificación de viajes y horarios de carga (descuentos).
- **raw.smartChargeDto**: Información sobre programación de carga inteligente.
