# Guía Paso a Paso: Crear APK Localmente

Sigue estos pasos EXACTAMENTE para generar el archivo APK de la aplicación en tu propio ordenador.

### 1. Preparar el entorno (Solo si no lo has hecho nunca)
Asegúrate de tener instalado:
- **Node.js 22+**
- **Java JDK 21**
- **Android Studio** (con el Android SDK configurado)

### 2. Generar la Llave de Firma (Keystore)
Si es la primera vez que creas una APK, necesitas una llave. Abre una terminal y ejecuta:

```powershell
# Ve a la carpeta de la app android
cd android/app

# Crea la llave (Copia y pega esto tal cual)
keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias bydstats
```
*Sigue las instrucciones, pon una contraseña que recuerdes y anótala.*

### 3. Configurar las Credenciales
Para que el sistema sepa qué llave usar, abre el archivo `android/app/build.gradle` y busca la sección `signingConfigs`. Pon tus contraseñas ahí:

```gradle
release {
    storeFile file("release.jks")
    storePassword "tu_contraseña_aquí"
    keyAlias "bydstats"
    keyPassword "tu_contraseña_aquí"
}
```
*Nota: No subas este archivo a GitHub si contiene las contraseñas reales. Usa variables de entorno si prefieres más seguridad.*

### 4. Compilar la APK
Ahora simplemente ejecuta este comando desde la **raíz del proyecto** (donde está el archivo `package.json`):

```powershell
npm run android:release
```
Este comando hará todo automáticamente:
1. Compilará el código web (React/Vite).
2. Sincronizará los archivos con el proyecto Android (Capacitor).
3. Generará la APK firmada usando Gradle.

### 5. Localizar el archivo APK
Una vez termine el proceso sin errores, encontrarás tu archivo listo en:
`android/app/build/outputs/apk/release/app-release.apk`

### 6. Instalar en el móvil
- Conecta tu móvil por USB (con Depuración USB activada) y ejecuta:
  ```powershell
  adb install android/app/build/outputs/apk/release/app-release.apk
  ```
- **O bien**: Copia el archivo `app-release.apk` a tu móvil y ábrelo para instalarlo manualmente.

---

### Resumen de comandos rápidos (Uso diario):
Siempre que quieras una nueva versión con los últimos cambios:
1. `npm run build` (Opcional, incluido en el siguiente)
2. `npm run android:release`
3. Instalar la APK resultante.
