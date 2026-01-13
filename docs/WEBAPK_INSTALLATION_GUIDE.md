# Guía para instalar BYD Stats como WebAPK en Android

## ⚠️ Problema actual

La PWA instalada en el coche **NO se instaló como WebAPK**, por eso no aparece en el menú "Compartir" ni puede abrir archivos .db.

## ¿Qué es WebAPK?

**WebAPK** es un formato especial que Chrome usa para instalar PWAs en Android. Solo las PWAs instaladas como WebAPK pueden:
- ✅ Aparecer en el menú "Compartir"
- ✅ Abrir archivos desde el administrador de archivos
- ✅ Integrarse completamente con el sistema Android

## 🔍 Verificar si está instalada como WebAPK

### Método 1: Revisar información de la app

1. Configuración → Aplicaciones
2. Buscar "BYD Stats"
3. Ver información:
   - **WebAPK**: Aparece como "Instalada desde Chrome"
   - **NO WebAPK**: Aparece como "Acceso directo web" o similar

### Método 2: Desde Chrome DevTools (USB)

```bash
# Conectar el coche con USB
adb forward tcp:9222 localabstract:chrome_devtools_remote

# Abrir en navegador:
chrome://inspect/#devices

# Buscar la app y revisar:
# WebAPK: chrome://webapks
```

### Método 3: Verificar package name

```bash
# WebAPK tendrá un package name como:
org.chromium.webapk.a1b2c3d4e5f6...

# NO WebAPK tendrá:
com.android.chrome o similar
```

## 📋 Requisitos para WebAPK

Chrome decide instalar como WebAPK si se cumplen TODOS estos criterios:

### 1. ✅ Manifest válido
- [x] `name` y `short_name`
- [x] `start_url` y `scope`
- [x] `display: standalone`
- [x] Iconos 192x192 y 512x512
- [x] `share_target` configurado
- [x] `file_handlers` configurado

### 2. ✅ Service Worker
- [x] Service Worker registrado y activo
- [x] Maneja eventos `fetch`
- [x] Procesa POST de `share_target`

### 3. ⚠️ HTTPS requerido
- La app DEBE servirse desde HTTPS
- NO funciona en HTTP (excepto localhost)

### 4. ⚠️ Engagement Score
Chrome requiere un "engagement score" mínimo:
- Visitar la PWA al menos **2 veces**
- Con al menos **5 minutos** entre visitas
- En un período de **2 semanas**

### 5. ⚠️ Chrome actualizado
- Chrome 57+ (WebAPK básico)
- Chrome 73+ (Share Target API)
- Chrome 102+ (File Handling API)
- **Recomendado: Chrome 120+**

## 🚀 Cómo forzar instalación como WebAPK

### Opción 1: Desinstalar y reinstalar (Recomendado)

```bash
# Paso 1: Desinstalar la PWA actual
# En el coche:
# - Configuración → Aplicaciones → BYD Stats → Desinstalar

# Paso 2: Limpiar datos de Chrome
# - Configuración → Aplicaciones → Chrome
# - Almacenamiento → Borrar datos (solo caché)

# Paso 3: Visitar la web y esperar el banner

# 1. Abrir Chrome en el coche
# 2. Ir a: https://byd-stats.netlify.app
# 3. Navegar por la app durante 2-3 minutos
# 4. CERRAR Chrome
# 5. Esperar 5 minutos
# 6. Abrir Chrome de nuevo
# 7. Volver a https://byd-stats.netlify.app
# 8. Navegar 2-3 minutos más

# Paso 4: Instalar
# - Después de 2 visitas, debería aparecer el banner:
#   "Agregar BYD Stats a la pantalla de inicio"
# - Tocar "Agregar"
# - Chrome debería mostrar: "Instalando..."
```

### Opción 2: Instalar desde menú de Chrome

```
1. Chrome → Ir a https://byd-stats.netlify.app
2. Menú (⋮) → Instalar aplicación / Add to Home Screen
3. Confirmar

NOTA: Si solo dice "Añadir a pantalla de inicio" sin
"Instalar", Chrome NO va a crear WebAPK todavía.
Necesitas cumplir requisitos de engagement primero.
```

### Opción 3: Forzar con Chrome Flags (Solo para pruebas)

⚠️ **Solo para desarrollo/pruebas**

```
1. En Chrome del coche, ir a:
   chrome://flags

2. Buscar y habilitar:
   - #enable-webapk-install
   - #enable-improved-a2hs
   - #bypass-app-banner-engagement-checks

3. Reiniciar Chrome

4. Ir a https://byd-stats.netlify.app

5. Menú → Instalar aplicación
```

### Opción 4: Actualizar Chrome

Si el coche tiene Chrome 113, considerar actualizar:

```
1. Google Play Store en el coche
2. Buscar "Chrome"
3. Actualizar a la última versión disponible
4. Reiniciar el sistema
5. Intentar instalación de nuevo
```

## 🔧 Después de instalar como WebAPK

### Verificar que funciona:

#### 1. Compartir archivos

```
1. Abrir Google Drive / Dropbox en el coche
2. Seleccionar un archivo .db
3. Tap en "Compartir"
4. **"BYD Stats" DEBE aparecer en la lista**
5. Seleccionar BYD Stats
6. El archivo debe cargarse automáticamente
```

#### 2. Abrir archivos

```
1. Descargar un archivo .db en el coche
2. Abrir administrador de archivos
3. Tap en el archivo .db
4. **"BYD Stats" DEBE aparecer como opción**
5. Seleccionar "Abrir con BYD Stats"
6. El archivo debe cargarse automáticamente
```

## 🐛 Solución de problemas

### La app se instaló pero NO aparece en "Compartir"

**Causa**: Se instaló como shortcut, no como WebAPK

**Solución**:
1. Desinstalar completamente
2. Borrar datos de Chrome
3. Seguir proceso de instalación paso a paso
4. Asegurar que cumples requisitos de engagement

### Chrome dice "Ya agregada a la pantalla de inicio"

**Solución**:
1. Eliminar el shortcut/icono actual de la pantalla
2. Desinstalar desde Configuración → Aplicaciones
3. Reiniciar el coche/sistema
4. Intentar instalación de nuevo

### El banner de instalación no aparece

**Causas posibles**:
- No cumples engagement score (visitar 2 veces, 5+ min entre visitas)
- Chrome no actualizado
- No estás en HTTPS
- Service Worker no está activo

**Verificar Service Worker**:
```
1. Chrome → https://byd-stats.netlify.app
2. Chrome DevTools (si tienes USB)
3. Application → Service Workers
4. Debe mostrar: "activated and running"
```

### Se instaló pero file_handlers no funciona

**Nota importante**: `file_handlers` solo funciona en:
- Chrome 102+ (escritorio)
- Chrome 120+ (Android, experimental)

Para Android 10 con Chrome 113:
- ✅ `share_target` **SÍ funciona**
- ❌ `file_handlers` **NO funciona aún**

**Workaround**: Los usuarios deben:
1. Descargar archivo .db
2. Compartir desde Downloads/Drive
3. Elegir "BYD Stats" del menú compartir

## 📊 Tabla de compatibilidad

| Feature | Chrome 113 Android 10 | Requerido |
|---------|----------------------|-----------|
| WebAPK básico | ✅ Sí | Chrome 57+ |
| Share Target | ✅ Sí | Chrome 73+ |
| File Handlers | ❌ **NO** | Chrome 120+ |
| Launch Handler | ✅ Sí | Chrome 102+ |

## ✅ Checklist de verificación

Antes de reportar que "no funciona":

- [ ] La app está instalada como WebAPK (no shortcut)
- [ ] Se accede vía HTTPS
- [ ] Service Worker está activo (verificar en chrome://serviceworker-internals)
- [ ] Chrome está actualizado (mínimo 73+)
- [ ] Se visitó la web 2+ veces con 5+ minutos entre visitas
- [ ] Se desinstaló cualquier versión anterior
- [ ] Se borró caché de Chrome
- [ ] Se reinició el sistema después de instalar

## 📝 Logs para depuración

Si necesitas reportar un problema, incluye estos logs:

```bash
# 1. Info de la app instalada
adb shell pm list packages | grep -E "chrome|byd|webapk"

# 2. Verificar WebAPKs instaladas
adb shell pm list packages | grep webapk

# 3. Logs de Chrome
adb logcat | grep -E "WebAPK|ShareTarget|FileHandler"

# 4. Info del manifest
adb shell dumpsys package com.bydstats.app

# 5. Service Worker status
# Desde Chrome DevTools: chrome://serviceworker-internals
```

## 🎯 Resumen

Para que BYD Stats aparezca en "Compartir":

1. **DEBE instalarse como WebAPK** (no shortcut)
2. Requiere cumplir engagement score (2 visitas, 5+ min)
3. Chrome 73+ mínimo
4. HTTPS obligatorio
5. Service Worker activo

Si todo está correcto y aún no funciona, es limitación de Chrome 113 en Android 10. Considerar actualizar Chrome a 120+ si es posible.
