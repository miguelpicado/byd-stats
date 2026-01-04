# 📱 Configuración de APK Release Firmada

Este documento explica cómo configurar GitHub Actions para generar automáticamente APKs Release firmadas que pueden instalarse en dispositivos Android.

## 🔑 Paso 1: Generar Keystore (Solo Primera Vez)

### Opción A: Usando keytool (Recomendado)

```bash
keytool -genkey -v -keystore byd-stats.keystore \
  -alias byd-stats \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

El comando te pedirá:
- **Contraseña del keystore**: Elige una contraseña segura (¡guárdala!)
- **Nombre y apellido**: Tu nombre o nombre de la organización
- **Unidad organizativa**: (Opcional) Ej: "Desarrollo"
- **Organización**: (Opcional) Ej: "BYD Stats"
- **Ciudad/Localidad**: Tu ciudad
- **Estado/Provincia**: Tu estado/provincia
- **Código de país**: Ej: "ES", "MX", "AR"
- **Contraseña de la clave**: Presiona Enter para usar la misma que el keystore

### Opción B: Usando Android Studio

1. Menu: **Build** → **Generate Signed Bundle/APK**
2. Selecciona **APK**
3. Click **Create new...** junto a "Key store path"
4. Completa los campos y crea el keystore

## ⚠️ IMPORTANTE: Guarda el Keystore Seguro

**¡MUY IMPORTANTE!** El archivo `byd-stats.keystore` y su contraseña son **críticos**:

✅ **Haz backup del keystore** en un lugar seguro (1Password, Google Drive, etc.)
✅ **Guarda las contraseñas** de forma segura
❌ **NUNCA** subas el keystore a GitHub
❌ **NUNCA** compartas el keystore públicamente

**Si pierdes el keystore, NO podrás actualizar tu app en Google Play.** Tendrás que crear una nueva app con un nuevo paquete.

## 🔐 Paso 2: Convertir Keystore a Base64

Necesitas convertir el keystore a Base64 para poder guardarlo como secreto en GitHub:

```bash
# En Linux/Mac
base64 byd-stats.keystore > keystore.txt

# En Windows (PowerShell)
certutil -encode byd-stats.keystore keystore.txt
```

Abre `keystore.txt` y copia **TODO** el contenido (incluyendo las líneas BEGIN/END si las hay).

## 🔒 Paso 3: Configurar Secretos en GitHub

1. Ve a tu repositorio en GitHub
2. Click en **Settings** (Configuración)
3. En el menú lateral: **Secrets and variables** → **Actions**
4. Click **New repository secret** para cada uno de estos:

### Secretos requeridos:

| Nombre | Valor | Descripción |
|--------|-------|-------------|
| `KEYSTORE_BASE64` | (contenido de keystore.txt) | Keystore codificado en Base64 |
| `KEYSTORE_PASSWORD` | tu-contraseña-keystore | Contraseña del keystore |
| `KEY_ALIAS` | `byd-stats` | Alias de la clave (usaste esto en el comando keytool) |
| `KEY_PASSWORD` | tu-contraseña-clave | Contraseña de la clave (normalmente la misma que el keystore) |

### Cómo crear cada secreto:

1. Click **New repository secret**
2. **Name**: Ingresa el nombre exacto (ej: `KEYSTORE_BASE64`)
3. **Secret**: Pega el valor correspondiente
4. Click **Add secret**
5. Repite para los 4 secretos

## ✅ Paso 4: Verificar que Funciona

Una vez configurados los secretos, el workflow generará APKs firmadas automáticamente:

### Opción A: Hacer un push a main/develop

```bash
git push origin main
```

### Opción B: Trigger manual desde GitHub

1. Ve a **Actions** en GitHub
2. Selecciona **Build Android APK**
3. Click **Run workflow**
4. Selecciona la rama
5. Click **Run workflow** (verde)

### Opción C: Crear un tag/release

```bash
git tag v1.0.0
git push origin v1.0.0
```

## 📦 Descargar la APK

### Desde GitHub Actions:

1. Ve a **Actions** en tu repositorio
2. Click en el workflow que se ejecutó
3. Scroll down hasta **Artifacts**
4. Descarga `byd-stats-release-signed-XXXXXX`

### Desde Releases (si creaste un tag):

1. Ve a **Releases** en GitHub
2. Descarga `app-release.apk`

## 🚀 Instalar la APK Firmada

1. Copia el archivo `app-release.apk` a tu dispositivo Android
2. Abre el archivo desde el explorador de archivos
3. Android pedirá permiso para instalar apps de fuentes desconocidas
4. Acepta y la app se instalará

## 🔄 Actualizaciones Futuras

Para actualizar la app:

1. Incrementa `versionCode` y `versionName` en `android/app/build.gradle`:
   ```gradle
   versionCode 2
   versionName "1.1"
   ```
2. Haz commit y push
3. La nueva APK se generará automáticamente
4. Los usuarios podrán instalarla sobre la versión anterior (sin perder datos)

## ❌ Solución de Problemas

### "Build Release APK failed"

- Verifica que los 4 secretos estén configurados correctamente
- Revisa los logs del workflow en Actions

### "Keystore not found"

- Verifica que `KEYSTORE_BASE64` esté correctamente codificado
- Asegúrate de copiar TODO el contenido del archivo keystore.txt

### "Invalid keystore format"

- En Windows, usa `certutil` en lugar de otros métodos
- Verifica que no haya espacios o saltos de línea extras

### La APK no se instala en el dispositivo

- Verifica que la APK esté firmada (no debe decir "unsigned" en el nombre)
- Revisa los permisos de instalación de apps desconocidas en Android

## 📚 Recursos Adicionales

- [Documentación oficial de Android sobre firma de apps](https://developer.android.com/studio/publish/app-signing)
- [Capacitor Android Documentation](https://capacitorjs.com/docs/android)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

**¿Necesitas ayuda?** Abre un issue en el repositorio.
