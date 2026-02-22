# 📱 Guía Completa: Build Local de APK Android

> **Versión actualizada:** Febrero 2026
> **Objetivo:** Compilar BYD Stats en tu máquina local para pruebas

## 📋 Requisitos Previos

Antes de empezar, asegúrate de tener instalado:

- ✅ **Node.js 20+** (verifica: `node -v`)
- ✅ **npm 10+** (verifica: `npm -v`)
- ✅ **JDK 17+** (verifica: `java -version`)
  - Recomendado: [Temurin JDK 21](https://adoptium.net/)
- ✅ **Android Studio** (opcional pero recomendado)
  - Descarga: https://developer.android.com/studio
- ✅ **Git** para control de versiones

---

## 🚀 Pasos Paso a Paso

### 1️⃣ Clonar o actualizar el repositorio

```bash
# Si es la primera vez
git clone https://github.com/TU-USUARIO/byd-stats.git
cd byd-stats

# Si ya lo tienes clonado
git pull origin main
```

### 2️⃣ Instalar dependencias

```bash
npm install
```

**Tiempo estimado:** 2-5 minutos

### 3️⃣ Configurar variables de entorno

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar .env con tus credenciales reales
nano .env  # o usa tu editor favorito
```

#### 📝 Dónde conseguir las credenciales:

<details>
<summary><b>🔑 Google OAuth Client ID</b></summary>

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto nuevo o selecciona uno existente
3. Ve a **APIs & Services** → **Credentials**
4. Click en **+ CREATE CREDENTIALS** → **OAuth client ID**
5. Tipo: **Web application**
6. **Authorized redirect URIs:** `http://localhost:5173`
7. Copia el **Client ID** generado → pégalo en `VITE_GOOGLE_WEB_CLIENT_ID`

Para Android OAuth:
- Tipo: **Android**
- Package name: `com.bydstats.app`
- SHA-1: Obtén con `keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android`
- Copia el **Client ID** → `VITE_GOOGLE_ANDROID_CLIENT_ID`

</details>

<details>
<summary><b>🔥 Firebase Configuration</b></summary>

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un proyecto nuevo o selecciona uno existente
3. Click en **⚙️ Project settings**
4. Scroll down hasta **Your apps** → Click en **</>** (Web)
5. Registra la app con nombre "BYD Stats Web"
6. Copia los valores del `firebaseConfig`:
   ```javascript
   apiKey: "..." → VITE_FIREBASE_API_KEY
   authDomain: "..." → VITE_FIREBASE_AUTH_DOMAIN
   projectId: "..." → VITE_FIREBASE_PROJECT_ID
   storageBucket: "..." → VITE_FIREBASE_STORAGE_BUCKET
   messagingSenderId: "..." → VITE_FIREBASE_MESSAGING_SENDER_ID
   appId: "..." → VITE_FIREBASE_APP_ID
   ```

Para Android:
- En Firebase Console, click en **⚙️ Project settings**
- Ve a **Your apps** → Click en Android icon (robot)
- Package name: `com.bydstats.app`
- Descarga `google-services.json`
- **NO LO COPIES AÚN** (ver paso 5 sobre seguridad)

</details>

<details>
<summary><b>🚗 Smartcar (Opcional)</b></summary>

Solo necesario si usas integración con Smartcar:

1. Ve a [Smartcar Dashboard](https://dashboard.smartcar.com/)
2. Crea una aplicación
3. Copia **Client ID** → `VITE_SMARTCAR_CLIENT_ID`
4. Configura redirect URI: `https://javascript-sdk.smartcar.com/v2/redirect?app_origin=http://localhost:5173`

**Nota:** Puedes dejarlo con valores de ejemplo si no usas Smartcar.

</details>

### 4️⃣ Build de la aplicación web

```bash
npm run build
```

**Qué hace:** Compila React + Vite en modo producción → crea carpeta `dist/`
**Tiempo estimado:** 30-60 segundos

**✅ Verificar:** Deberías ver mensajes como:
```
✓ built in 45s
✓ dist/index.html  X.XX kB
✓ dist/assets/...  XX.XX MB
```

### 5️⃣ Sincronizar con Capacitor

```bash
npx cap sync android
```

**Qué hace:**
- Copia `dist/` → `android/app/src/main/assets/public/`
- Actualiza plugins nativos de Capacitor
- Sincroniza configuración de `capacitor.config.ts`

**Tiempo estimado:** 10-20 segundos

### 6️⃣ Generar la APK

Tienes **2 opciones**:

#### 🅰️ Opción A: Línea de comandos (más rápido)

```bash
# APK de DEBUG (para pruebas locales)
cd android
./gradlew assembleDebug

# O usa el comando npm directo:
npm run android:build
```

**Ubicación de la APK:**
`android/app/build/outputs/apk/debug/app-debug.apk`

**Tamaño:** ~3 MB

#### 🅱️ Opción B: Android Studio (más control)

```bash
# Abrir Android Studio
npm run android:open

# O manualmente:
# 1. Abre Android Studio
# 2. File → Open → Selecciona carpeta "android/"
# 3. Espera a que Gradle sincronice (barra inferior)
# 4. Build → Build Bundle(s) / APK(s) → Build APK(s)
# 5. Espera... ✅ APK(s) generated successfully
```

**Ventajas:** Puedes depurar errores de Gradle más fácilmente

### 7️⃣ APK de RELEASE (producción)

**⚠️ Solo si necesitas distribuir la app públicamente**

```bash
cd android
./gradlew assembleRelease

# O usa:
npm run android:release
```

**Ubicación:** `android/app/build/outputs/apk/release/app-release.apk`

**Nota:** Por defecto usa las claves incluidas en `android/app/release.jks`. Para producción real, **genera tus propias claves** (ver sección de seguridad abajo).

---

## 📲 Instalar la APK en tu dispositivo

### Método 1: Transferencia manual

1. **Copia** `app-debug.apk` a tu móvil (USB, Bluetooth, email, Drive...)
2. **Localiza** el archivo en tu teléfono con un gestor de archivos
3. **Toca** el archivo APK
4. **Permite** instalación de fuentes desconocidas si se solicita:
   - Android 8+: Settings → Apps → Special access → Install unknown apps → [Tu gestor de archivos] → Allow
5. **Instala** → ¡Listo!

### Método 2: ADB (más técnico)

```bash
# Conecta tu Android por USB con depuración habilitada
adb devices  # Verifica que se detecta

# Instala la APK
adb install android/app/build/outputs/apk/debug/app-debug.apk

# O reinstalar sobre una versión previa:
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🔐 Seguridad: Proteger Claves y Secrets

### ❌ Archivos que NUNCA debes commitear:

```
.env                                  # Variables de entorno
.env.local, .env.production           # Variantes de env
android/app/google-services.json      # Config Firebase Android
android/app/*.keystore                # Keystores de firma
android/app/*.jks                     # Java Keystores
android/app/release-signing.properties # Props de firma
```

### ✅ Verificar que están ignorados:

```bash
git check-ignore android/app/release.jks android/app/google-services.json .env
```

Si NO muestra nada, los archivos **NO están ignorados** → ¡Revisa tu `.gitignore`!

### 🔑 Generar tus propias claves de firma (RELEASE)

**Si vas a distribuir la app públicamente, DEBES generar nuevas claves:**

```bash
# 1. Genera un nuevo keystore
keytool -genkey -v -keystore android/app/mi-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias bydstats-release

# Te pedirá:
# - Password del keystore (mínimo 6 caracteres) → ANÓTALO ✍️
# - Nombre, organización, ubicación, etc.
# - Password del alias (puede ser el mismo) → ANÓTALO ✍️

# 2. Editar android/app/build.gradle
# Cambia las líneas 28-32:
#   release {
#       storeFile file("mi-release.jks")
#       storePassword "TU_PASSWORD_AQUÍ"
#       keyAlias "bydstats-release"
#       keyPassword "TU_KEY_PASSWORD_AQUÍ"
#   }

# 3. Compilar con tu nuevo keystore
cd android && ./gradlew assembleRelease
```

**⚠️ IMPORTANTE:**
- **Guarda el .jks y las passwords en un lugar seguro** (gestor de contraseñas, bóveda...)
- **NO las subas a Git** → Ya están en `.gitignore`
- **Si pierdes el keystore**, NO podrás actualizar la app en Google Play Store

### 🗑️ Eliminar claves comprometidas del historial de Git

Si accidentalmente commiteaste claves al repositorio:

```bash
# 1. Eliminar del tracking actual (no del historial)
git rm --cached android/app/*.keystore android/app/*.jks android/app/google-services.json
git commit -m "chore: remove sensitive files from tracking"

# 2. Para borrar del HISTORIAL COMPLETO (usa con cuidado):
git filter-repo --path android/app/release.jks --invert-paths
git filter-repo --path android/app/debug.keystore --invert-paths
git filter-repo --path android/app/google-services.json --invert-paths

# Requiere: pip install git-filter-repo

# 3. Force push (si ya estaba en remoto)
git push origin --force --all
git push origin --force --tags
```

**⚠️ ADVERTENCIA:** `filter-repo` reescribe el historial. Coordina con tu equipo antes de hacer force push.

---

## 🔄 Workflow de desarrollo habitual

```bash
# 1. Haces cambios en el código (src/...)
# 2. Reconstruir
npm run build

# 3. Sincronizar con Android
npx cap sync android

# 4. Recompilar APK
cd android && ./gradlew assembleDebug

# 5. Reinstalar en dispositivo
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

**Atajo:** Si solo cambias código (no plugins nativos):
```bash
npm run android:build  # build + sync + gradle en un comando
```

---

## 🐛 Solución de Problemas

### Error: "SDK not found"

**Causa:** Android SDK no instalado o no configurado

**Solución:**
```bash
# Opción 1: Instalar Android Studio → incluye SDK
# Opción 2: Instalar solo SDK command-line tools

# Configurar ANDROID_HOME (Linux/Mac)
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools

# Windows (PowerShell)
$env:ANDROID_HOME = "C:\Users\TU_USUARIO\AppData\Local\Android\Sdk"
$env:PATH += ";$env:ANDROID_HOME\tools;$env:ANDROID_HOME\platform-tools"
```

### Error: "JAVA_HOME not set"

**Solución:**
```bash
# Linux/Mac
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk  # Ajusta la ruta
export PATH=$JAVA_HOME/bin:$PATH

# Windows
# Panel de Control → Sistema → Configuración avanzada del sistema
# → Variables de entorno → Nueva variable del sistema
# JAVA_HOME = C:\Program Files\Java\jdk-21
```

### Gradle build failed

```bash
# 1. Limpiar cache de Gradle
cd android
./gradlew clean

# 2. Invalidar caches en Android Studio
# File → Invalidate Caches / Restart

# 3. Borrar carpetas de build
rm -rf build/ app/build/ .gradle/

# 4. Recompilar
./gradlew assembleDebug
```

### La app no arranca / pantalla blanca

**Causas comunes:**
- No ejecutaste `npm run build` antes de `cap sync`
- Hay errores en el código JavaScript (revisa Logcat)
- Capacitor config incorrecta

**Solución:**
```bash
# 1. Rebuild completo
npm run build
npx cap sync android

# 2. Ver logs en tiempo real
adb logcat | grep -i "BYDStats\|Capacitor\|Web"

# 3. Abrir Chrome DevTools para webviews
# En Chrome desktop: chrome://inspect
```

### Error: "Unable to load script from assets"

**Solución:**
```bash
# Verificar que dist/ tiene contenido
ls -lh dist/

# Si está vacío:
npm run build

# Verificar que se copió a Android
ls -lh android/app/src/main/assets/public/

# Si está vacío:
npx cap sync android --force
```

### APK muy grande (>10 MB)

**Optimizaciones:**

1. **Habilitar minificación en release:**
   ```gradle
   // android/app/build.gradle
   buildTypes {
       release {
           minifyEnabled true  // Cambia a true
           shrinkResources true  // Añade esta línea
       }
   }
   ```

2. **Separar ABIs (APKs por arquitectura):**
   ```gradle
   android {
       splits {
           abi {
               enable true
               reset()
               include 'armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'
               universalApk false  // Desactiva APK universal
           }
       }
   }
   ```

---

## 📊 Diferencias: Debug vs Release

| Característica | Debug APK | Release APK |
|----------------|-----------|-------------|
| **Tamaño** | ~3-4 MB | ~2-3 MB |
| **Logs** | Sí, verbosos | No (minificados) |
| **Firma** | debug.keystore | release.jks |
| **Optimización** | No | Sí (R8/ProGuard) |
| **Google Play** | ❌ No aceptado | ✅ Requerido |
| **Debugging** | ✅ Fácil | ❌ Difícil |
| **Uso recomendado** | Pruebas locales | Distribución pública |

---

## 📚 Recursos Adicionales

- [Documentación de Capacitor](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/guide)
- [Gradle User Manual](https://docs.gradle.org/)
- [Keytool Reference](https://docs.oracle.com/javase/8/docs/technotes/tools/unix/keytool.html)

---

## ✅ Checklist Final

Antes de distribuir tu APK:

- [ ] Variables de entorno configuradas (`.env` completo)
- [ ] Build exitoso (`npm run build` sin errores)
- [ ] APK genera correctamente (`./gradlew assembleDebug`)
- [ ] APK instalada y probada en dispositivo real
- [ ] Funcionalidades críticas funcionan (cargar .db, ver stats, navegación)
- [ ] No hay claves sensibles en el repo (`git check-ignore ...`)
- [ ] `.gitignore` actualizado con reglas de seguridad
- [ ] Si es release: nuevo keystore generado y guardado de forma segura
- [ ] Logs revisados (sin errores críticos en Logcat)

---

**¿Problemas no listados aquí?** Consulta [TROUBLESHOOTING.md](TROUBLESHOOTING.md) o abre un issue en GitHub.

**¡Buena suerte con tu build! 🚀**
