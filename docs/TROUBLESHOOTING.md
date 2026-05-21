# 🔧 Troubleshooting - GitHub Actions

Guía para solucionar problemas con los workflows de compilación de APK.

## 📋 Diagnóstico rápido

### 1. El workflow falla en "Sync Capacitor"

Este es el error más común. Aquí están las soluciones:

#### ✅ Verificar que tienes estos archivos

Estos archivos **DEBEN** estar en tu repositorio:

```bash
✅ android/gradlew
✅ android/gradlew.bat
✅ android/gradle/wrapper/gradle-wrapper.jar
✅ android/gradle/wrapper/gradle-wrapper.properties
✅ android/build.gradle
✅ android/settings.gradle
✅ android/gradle.properties
✅ android/variables.gradle
✅ capacitor.config.json
✅ package.json
✅ package-lock.json
```

#### ✅ Verificar en GitHub

1. Ve a tu repositorio en GitHub
2. Navega a la carpeta `android/gradle/wrapper/`
3. Debes ver: `gradle-wrapper.jar` y `gradle-wrapper.properties`

Si NO están, ejecuta:

```bash
git add -f android/gradle/wrapper/
git add -f android/gradlew android/gradlew.bat
git commit -m "Add Gradle wrapper files"
git push
```

### 2. El workflow falla en "Build Debug APK"

#### Error: "SDK location not found"

**Solución:** No hacer nada, GitHub Actions configura el SDK automáticamente.

#### Error: "Execution failed for task"

Mira el error específico en los logs y:

1. Verifica que el código compila localmente:
   ```bash
   npm run build
   npx cap sync android
   cd android && ./gradlew assembleDebug
   ```

2. Si funciona local pero no en CI, puede ser un problema de dependencias.

### 3. El workflow no se ejecuta

#### Causa 1: GitHub Actions deshabilitado

**Solución:**
1. Settings → Actions → General
2. Selecciona "Allow all actions and reusable workflows"
3. Save

#### Causa 2: Rama incorrecta

Los workflows se ejecutan en:
- `main`
- `master`
- `develop`
- `claude/**`

Si tu rama tiene otro nombre, edita `.github/workflows/android-build.yml`:

```yaml
on:
  push:
    branches:
      - TU_RAMA_AQUI  # Añade tu rama
```

### 4. El artefacto no aparece

#### Si el workflow terminó verde (✅)

El problema es que el workflow dice "Success" pero no genera la APK.

**Verificar:**
1. Click en el workflow completado
2. Busca el paso "Upload Debug APK"
3. ¿Dice "Success"?
   - ✅ Sí → El artefacto debería estar
   - ❌ No → Mira el error en ese paso

**Dónde buscar los artefactos:**
```
Workflow completado → Scroll hasta el final → Sección "Artifacts"
```

### 5. Error: "npm ci" falla

**Causa:** `package-lock.json` desactualizado

**Solución:**
```bash
rm package-lock.json
npm install
git add package-lock.json
git commit -m "Update package-lock.json"
git push
```

### 6. Error: "capacitor.config.json not found"

**Verificar que existe:**
```bash
cat capacitor.config.json
```

**Si no existe, créalo:**
```json
{
  "appId": "com.bydstats.app",
  "appName": "BYD Stats",
  "webDir": "dist",
  "server": {
    "androidScheme": "https"
  },
  "android": {
    "allowMixedContent": true
  }
}
```

```bash
git add capacitor.config.json
git commit -m "Add Capacitor config"
git push
```

## 🔍 Cómo leer los logs de error

### Paso 1: Ir al workflow fallido

1. Actions → Click en el workflow con ❌ rojo
2. Click en el job "Build APK"

### Paso 2: Identificar el paso que falló

Los pasos fallidos tienen ❌ rojo. Los más comunes:

| Paso fallido | Problema probable |
|-------------|-------------------|
| Install dependencies | package-lock.json corrupto |
| Build web app | Error en el código JS/React |
| Sync Capacitor | Falta capacitor.config.json |
| Build Debug APK | Error en código Android/Gradle |

### Paso 3: Leer el error

Click en el paso fallido y busca:

```bash
ERROR: ...
FAILED: ...
Exception: ...
```

Ese es tu error real.

## 📊 Errores comunes y soluciones

### Error: "Unable to resolve dependency"

```
Could not resolve com.android.tools.build:gradle:X.X.X
```

**Solución:** El workflow usa Gradle cache, a veces se corrompe.

Prueba:
1. Re-ejecutar el workflow (botón "Re-run all jobs")
2. Si persiste, edita `android/build.gradle` y verifica la versión de Gradle

### Error: "Manifest merger failed"

```
Android Manifest merge failed
```

**Causa:** Conflicto en el AndroidManifest.xml

**Solución:**
1. Verifica `android/app/src/main/AndroidManifest.xml`
2. Asegúrate de que no haya plugins duplicados

### Error: "Task assembleDebug not found"

**Causa:** El proyecto Android está corrupto

**Solución:**
1. Local: `rm -rf android/`
2. `npx cap add android`
3. `npx cap sync android`
4. Regenera iconos: `npx capacitor-assets generate --android`
5. Commit y push todo

## ✅ Checklist antes de pedir ayuda

Antes de abrir un issue, verifica:

- [ ] Los archivos de Gradle wrapper están en el repo
- [ ] `capacitor.config.json` existe
- [ ] `package-lock.json` está actualizado
- [ ] El código compila localmente (`npm run build`)
- [ ] GitHub Actions está habilitado
- [ ] Has leído los logs completos del error
- [ ] Has intentado re-ejecutar el workflow

## 🆘 Pedir ayuda

Si nada de esto funciona, abre un issue con:

1. **URL del workflow fallido**
2. **Paso exacto que falla** (nombre del paso)
3. **Error completo** (copia el log)
4. **Rama que usas**
5. **¿Compila localmente?** (sí/no)

Ejemplo:

```
Workflow: https://github.com/USER/REPO/actions/runs/12345
Paso: "Sync Capacitor"
Error: capacitor.config.json not found
Rama: main
Compila local: Sí
```

---

**Última actualización:** Diciembre 2024
