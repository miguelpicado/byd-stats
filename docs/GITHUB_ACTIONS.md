# 🤖 Compilación automática con GitHub Actions

Este proyecto incluye workflows de GitHub Actions que compilan automáticamente la APK de Android en la nube, **sin necesidad de instalar Android Studio**.

## 🎯 Workflows disponibles

### 1. Build Android APK (Automático)

**Archivo:** `.github/workflows/android-build.yml`

Se ejecuta automáticamente cuando:
- ✅ Haces push a las ramas `main`, `master` o `develop`
- ✅ Creas un Pull Request
- ✅ Creas un tag de versión (ej: `v1.0.0`)

**¿Qué hace?**
- Compila la webapp con Vite
- Sincroniza con Capacitor
- Genera APK de debug (siempre)
- Genera APK de release (si es posible)
- Sube las APKs como artefactos
- Si es un tag, crea un Release con las APKs adjuntas

### 2. Manual APK Build (Manual)

**Archivo:** `.github/workflows/manual-build.yml`

Se ejecuta manualmente cuando tú lo solicites.

**¿Qué hace?**
- Te permite elegir qué tipo de APK generar (debug, release o ambas)
- Genera la APK seleccionada
- La sube como artefacto con 90 días de retención
- Muestra un resumen del build

## 📦 Cómo usar el workflow manual

### Paso 1: Ir a GitHub Actions

1. Ve a tu repositorio en GitHub
2. Haz clic en la pestaña **Actions** (arriba)
3. En el menú lateral izquierdo, selecciona **Manual APK Build**

### Paso 2: Ejecutar el workflow

1. Haz clic en el botón **Run workflow** (derecha)
2. Selecciona la rama (normalmente `main`)
3. Elige el tipo de build:
   - **debug**: APK de debug (más grande, con logs)
   - **release**: APK de release sin firmar
   - **both**: Genera ambas versiones
4. Haz clic en **Run workflow** (verde)

### Paso 3: Esperar la compilación

- ⏱️ La compilación tarda **5-10 minutos**
- 🔄 Puedes ver el progreso en tiempo real
- ✅ Recibirás una notificación cuando termine

### Paso 4: Descargar la APK

1. Una vez terminado, haz clic en el workflow completado
2. Baja hasta la sección **Artifacts**
3. Descarga el archivo ZIP con la APK
4. Descomprime el ZIP para obtener el archivo `.apk`

## 🏷️ Cómo crear un Release con APK

### Opción A: Usando git tags

```bash
# Crear tag localmente
git tag v1.0.0

# Subir el tag a GitHub
git push origin v1.0.0
```

Esto automáticamente:
1. Ejecuta el workflow de build
2. Compila las APKs
3. Crea un Release en GitHub
4. Adjunta las APKs al Release

### Opción B: Desde GitHub

1. Ve a **Releases** → **Draft a new release**
2. Crea un nuevo tag (ej: `v1.0.1`)
3. Escribe título y descripción
4. Publica el release
5. GitHub Actions compilará y subirá las APKs automáticamente

## 📊 Ver el historial de builds

1. Ve a la pestaña **Actions**
2. Verás todos los workflows ejecutados
3. Haz clic en cualquiera para ver:
   - Logs detallados
   - Tiempo de ejecución
   - Artefactos generados
   - Errores (si los hubo)

## 🔧 Troubleshooting

### El workflow falla

**Error común: "Gradle build failed"**

- Revisa los logs del paso "Build Debug APK"
- Asegúrate de que el código compila localmente primero
- Verifica que todas las dependencias estén en `package.json`

**Error: "Node modules not found"**

- El workflow ejecuta `npm ci` automáticamente
- Asegúrate de que `package-lock.json` esté commiteado

### La APK no aparece en Artifacts

- Verifica que el workflow terminó con éxito (✅ verde)
- Los artefactos aparecen al final de la página del workflow
- Si el build falló, no se generarán artefactos

### Quiero modificar el workflow

Los archivos están en `.github/workflows/`:
- `android-build.yml` - Build automático
- `manual-build.yml` - Build manual

Puedes editarlos para:
- Cambiar las ramas que disparan el build
- Añadir pasos adicionales
- Modificar la configuración de Gradle
- Cambiar los tiempos de retención de artefactos

## 💡 Consejos

### Retención de artefactos

- **Builds automáticos**: 30 días
- **Builds manuales**: 90 días
- **Releases**: Permanentes

### Limitar uso de Actions

Si quieres ahorrar minutos de GitHub Actions:
- Usa el workflow manual en vez de push automático
- Crea releases solo para versiones estables
- Desactiva el workflow en branches experimentales

### APK de release firmada

Por defecto, la APK de release no está firmada. Para firmarla:

1. Genera un keystore
2. Añádelo como secreto en GitHub (Settings → Secrets)
3. Modifica el workflow para usar el keystore
4. Consulta: [Signing Android Apps](https://developer.android.com/studio/publish/app-signing)

## 🎓 Recursos adicionales

- [Documentación de GitHub Actions](https://docs.github.com/en/actions)
- [Capacitor Android](https://capacitorjs.com/docs/android)
- [Android Build Guide](ANDROID_BUILD.md)
- [README Android](ANDROID.md)

---

**¿Necesitas ayuda?** Abre un Issue en el repositorio describiendo el problema.
