# BYD MQTT Listener v2.0

Multi-user MQTT listener for BYD vehicles. Runs on Raspberry Pi and automatically:
- Connects to all BYD vehicles in Firestore
- Refreshes tokens automatically (every 4 hours)
- Reconnects on connection loss
- Forwards events to Firestore in real-time

## Architecture

```
Firestore (bydVehicles)     Raspberry Pi              BYD MQTT Broker
       │                         │                          │
       │  1. Read vehicles       │                          │
       │◄────────────────────────│                          │
       │                         │                          │
       │  2. Get credentials     │  3. Connect MQTT         │
       │◄────────────────────────│─────────────────────────►│
       │                         │                          │
       │  4. Forward events      │  5. Receive events       │
       │◄────────────────────────│◄─────────────────────────│
```

---

## Setup en Raspberry Pi (vía SSH)

### Requisitos previos
- Raspberry Pi con Raspberry Pi OS (headless OK)
- Acceso SSH configurado
- Conexión a internet

### Paso 1: Conectar por SSH

```bash
ssh pi@[IP_DE_TU_PI]
# o si usas el hostname:
ssh pi@raspberrypi.local
```

### Paso 2: Instalar Node.js 20

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
node --version   # Debe mostrar v20.x.x
npm --version
```

### Paso 3: Instalar PM2 (gestor de procesos)

```bash
sudo npm install -g pm2

# Configurar para iniciar con el sistema
pm2 startup
# Ejecutar el comando que muestra (sudo env PATH=...)
```

### Paso 4: Crear directorio y copiar archivos

**Opción A: Desde tu ordenador con SCP**

```bash
# En tu ordenador (no en la Pi), desde la carpeta byd-stats:
scp -r mqtt-listener pi@[IP_DE_TU_PI]:~/byd-mqtt
```

**Opción B: Clonar desde Git (si lo subes)**

```bash
# En la Pi
cd ~
git clone https://github.com/TU_USUARIO/byd-mqtt-listener.git byd-mqtt
cd byd-mqtt
```

### Paso 5: Configurar Firebase Service Account

1. Ve a [Firebase Console](https://console.firebase.google.com/project/REDACTED_FIREBASE_PROJECT_ID/settings/serviceaccounts/adminsdk)
2. Click "Generate new private key"
3. Descarga el archivo JSON

4. Copia el archivo a la Pi:
```bash
# Desde tu ordenador
scp firebase-service-account.json pi@[IP_DE_TU_PI]:~/byd-mqtt/
```

### Paso 6: Configurar .env

```bash
# En la Pi
cd ~/byd-mqtt
nano .env
```

Contenido del `.env`:
```env
WEBHOOK_SECRET=<generate with: openssl rand -hex 16>
TOKEN_ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
```

Guardar: `Ctrl+O`, `Enter`, `Ctrl+X`

### Paso 7: Instalar dependencias y compilar

```bash
cd ~/byd-mqtt
npm install
npm run build
```

### Paso 8: Probar ejecución

```bash
npm start
```

Deberías ver algo como:
```
============================================================
BYD MQTT Listener - Multi-User v2.0
============================================================
Listening for BYD vehicles in Firestore...
[LGXCH6CD0S2052990] New vehicle detected, connecting...
[LGXCH6CD0S2052990] Logging in as tu@email.com...
[LGXCH6CD0S2052990] Login successful, userId: 354251
[LGXCH6CD0S2052990] Connecting to MQTT broker...
[LGXCH6CD0S2052990] MQTT connected
[LGXCH6CD0S2052990] Subscribed to oversea/res/354251
Active connections: 1
```

Presiona `Ctrl+C` para detener.

### Paso 9: Ejecutar con PM2 (producción)

```bash
# Iniciar con PM2
pm2 start dist/index.js --name byd-mqtt

# Verificar que está corriendo
pm2 status

# Guardar configuración para reinicio automático
pm2 save

# Ver logs en tiempo real
pm2 logs byd-mqtt
```

---

## Comandos útiles

```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs byd-mqtt

# Reiniciar
pm2 restart byd-mqtt

# Detener
pm2 stop byd-mqtt

# Ver métricas (CPU, memoria)
pm2 monit
```

---

## Troubleshooting

### "No credentials found"
- Asegúrate de haber ejecutado `bydConnect` en la app para el vehículo

### "Login failed"
- Las credenciales BYD pueden haber cambiado
- El usuario debe re-conectar en la app

### "MQTT connection closed" constante
- Verificar conexión a internet: `ping google.com`
- Los tokens pueden estar expirados (se refrescan automáticamente)

### Verificar que Firestore funciona
```bash
# En la Pi, ejecutar node interactivo
node
> const admin = require('firebase-admin');
> admin.initializeApp({credential: admin.credential.cert(require('./firebase-service-account.json'))});
> admin.firestore().collection('bydVehicles').get().then(s => console.log(s.size, 'vehicles'));
```

---

## Consumo de recursos

- **CPU**: ~1-2% idle, ~5% durante eventos
- **RAM**: ~50-80 MB
- **Red**: ~1 KB/min idle, picos durante eventos
- **Electricidad**: ~0.5W (Pi Zero W)
