# 📱 Instrucciones para generar la APK de Android

Este documento explica cómo generar la APK de **BYD Stats** para instalar en dispositivos Android.

## 📋 Requisitos previos

1. **Node.js** y **npm** instalados
2. **Android Studio** instalado
3. **JDK 17** o superior

## 🔧 Pasos para generar la APK

### 1. Instalar dependencias

```bash
npm install
```

### 2. Construir la aplicación web

```bash
npm run build
```

### 3. Sincronizar con Capacitor

```bash
npx cap sync android
```

### 4. Generar la APK

Tienes dos opciones:

#### Opción A: Usando Android Studio (Recomendado)

1. Abre Android Studio
2. Selecciona "Open an Existing Project"
3. Navega a la carpeta `android` dentro del proyecto
4. Espera a que se sincronicen las dependencias de Gradle
5. Ve a **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
6. La APK se generará en: `android/app/build/outputs/apk/debug/app-debug.apk`

#### Opción B: Usando línea de comandos

```bash
cd android
./gradlew assembleDebug
```

La APK se generará en: `android/app/build/outputs/apk/debug/app-debug.apk`

### 5. Para generar una APK de release (firmada)

Para distribución:

```bash
cd android
./gradlew assembleRelease
```

**Nota:** Necesitarás configurar un keystore para firmar la APK de release.

## 📦 Ubicación de la APK

Una vez generada, encontrarás la APK en:

- **Debug:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release:** `android/app/build/outputs/apk/release/app-release.apk`

## 📲 Instalar en tu dispositivo

### Método 1: Transferencia directa

1. Copia el archivo APK a tu dispositivo Android
2. Abre el archivo APK en tu dispositivo
3. Permite la instalación de fuentes desconocidas si se solicita
4. Instala la aplicación

### Método 2: Usando ADB

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## ✨ Características de la app Android

- ✅ Diseño responsive optimizado para móvil y tablet
- ✅ Funciona 100% offline
- ✅ Los datos se guardan localmente en el dispositivo
- ✅ Selección de archivos desde el almacenamiento del dispositivo
- ✅ Todas las funcionalidades de la versión web

## 🔄 Actualizar la app

Cuando hagas cambios en el código:

```bash
npm run build
npx cap sync android
```

Luego vuelve a generar la APK.

## 🐛 Solución de problemas

### Error: "SDK not found"

Asegúrate de tener Android SDK instalado y configurado en las variables de entorno.

### Error: "Gradle build failed"

1. Abre el proyecto en Android Studio
2. Ve a **File** → **Invalidate Caches / Restart**
3. Espera a que se sincronicen las dependencias
4. Intenta de nuevo

### La app no carga correctamente

Verifica que ejecutaste `npm run build` antes de sincronizar con Capacitor.

## 📝 Notas adicionales

- La app usa Capacitor 8.x para el puente nativo
- El tamaño final de la APK es aproximadamente 2-3 MB
- Compatible con Android 5.0+ (API 21+)
- Los iconos y splash screens se generan automáticamente en todas las densidades

---

Para más información sobre Capacitor: https://capacitorjs.com/docs
