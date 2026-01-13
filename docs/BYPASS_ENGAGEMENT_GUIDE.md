# Saltarse el Engagement Score de Chrome para instalación inmediata

## 🤔 ¿Por qué Chrome requiere 2 visitas con 5+ minutos?

### El problema del spam de PWAs

Antes de Chrome 57 (2017):
```
❌ Cualquier sitio web podía mostrar "Instalar app" inmediatamente
❌ Usuarios instalaban apps sin querer
❌ Pantallas de inicio llenas de apps no deseadas
❌ Mala reputación de las PWAs
```

### La solución: Engagement Score

Chrome implementó un sistema de puntuación para determinar si un usuario está realmente interesado:

```javascript
// Criterios que Chrome evalúa:
{
  visits: >= 2,                    // Mínimo 2 visitas
  timeBetweenVisits: >= 5 * 60,   // 5+ minutos entre visitas
  timeOnSite: >= 30,              // 30+ segundos por visita
  interactions: >= 1,              // Scroll, click, etc.
  periodMax: <= 14 * 24 * 60 * 60 // Dentro de 2 semanas
}

// Fórmula (simplificada):
score = (visits * 2) + (timeOnSite / 60) + (interactions * 0.5)

// Chrome requiere: score >= 5
```

### ¿Por qué es bueno?

1. **Previene spam**: Solo apps que el usuario realmente usa
2. **Mejor experiencia**: No se bombardea al usuario con popups
3. **Calidad**: Solo PWAs bien diseñadas que el usuario visita repetidamente
4. **Confianza**: Los usuarios confían más en el sistema de instalación

## 🚀 Métodos para saltarse el engagement score

### Método 1: Chrome Flags (Recomendado para testing)

**Pasos en el coche (Android 10, Chrome 113)**:

```
1. Abrir Chrome en el coche

2. Ir a: chrome://flags

3. Buscar y habilitar estos flags:

   🔍 bypass-app-banner-engagement-checks
   ✅ Cambiar a "Enabled"

   🔍 enable-webapk-install
   ✅ Cambiar a "Enabled"

   🔍 enable-improved-a2hs
   ✅ Cambiar a "Enabled"

4. Reiniciar Chrome (botón al final de la página)

5. Ir a: https://tu-dominio.com

6. Menú (⋮) → "Instalar aplicación" o "Add to Home Screen"

7. ✅ Se instalará como WebAPK inmediatamente
```

### Método 2: Via ADB (Si tienes acceso USB)

```bash
# Conectar el coche con USB

# Habilitar flag vía command line
adb shell am start -a android.intent.action.VIEW \
  -d "chrome://flags/#bypass-app-banner-engagement-checks"

# O forzar instalación directamente
adb shell am start -a android.intent.action.VIEW \
  -d "intent://tu-dominio.com#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https://tu-dominio.com;end"
```

### Método 3: Manifest Trick (Cambiar ID)

Cada vez que cambias el `id` en el manifest, Chrome lo trata como una "nueva app":

```json
{
  "id": "/?v=1.2.1",  // Cambiar esto resetea engagement
  "start_url": "/?v=1.2.1"
}
```

**Nota**: Esto hace que Chrome reinstale la app desde cero, perdiendo datos.

### Método 4: Developer Mode (Solo para desarrollo)

Si tienes acceso a Chrome Developer Mode:

```javascript
// En DevTools Console:
navigator.serviceWorker.ready.then(registration => {
  registration.unregister().then(() => {
    window.location.reload();
  });
});

// Luego:
// Application → Manifest → "Add to Home Screen"
```

### Método 5: beforeinstallprompt Event (Programático)

Puedes capturar y mostrar el banner manualmente (si Chrome lo permite):

```javascript
// En tu código JS:
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevenir el banner automático
  e.preventDefault();

  // Guardar el evento
  deferredPrompt = e;

  // Mostrar tu propio botón de instalación
  document.getElementById('install-button').style.display = 'block';
});

// Cuando el usuario hace click en tu botón:
document.getElementById('install-button').addEventListener('click', async () => {
  if (!deferredPrompt) return;

  // Mostrar el prompt
  deferredPrompt.prompt();

  // Esperar respuesta
  const { outcome } = await deferredPrompt.userChoice;
  console.log('User choice:', outcome);

  // Limpiar
  deferredPrompt = null;
});
```

**Problema**: Chrome aún requiere engagement score para disparar `beforeinstallprompt`.

## ⚡ Instalación inmediata paso a paso

### Para el coche (Chrome 113, Android 10):

```bash
# Paso 1: Habilitar flags
1. Chrome → chrome://flags
2. Buscar: "bypass-app-banner-engagement-checks"
3. Cambiar a "Enabled"
4. Tap en "Relaunch" al final

# Paso 2: Instalar inmediatamente
1. Ir a: https://tu-dominio.com
2. Menú (⋮) → "Instalar aplicación"
3. Confirmar instalación
4. ✅ Listo! Se instala como WebAPK inmediatamente
```

### Verificar que se instaló como WebAPK:

```
Configuración → Aplicaciones → BYD Stats

WebAPK mostrará:
✅ "Instalada desde Chrome"
✅ Package: org.chromium.webapk...
✅ Puede aparecer en menú "Compartir"

NO WebAPK:
❌ "Acceso directo web"
❌ Package: com.android.chrome
❌ NO aparece en "Compartir"
```

## 🔧 Troubleshooting

### El flag no aparece en chrome://flags

**Solución**: Tu Chrome puede estar desactualizado o no soportar ese flag.

```
Alternativa:
1. chrome://flags/#enable-webapk-install
2. Esto fuerza WebAPK sin bypass de engagement
```

### Instalé pero sigue sin aparecer en "Compartir"

**Verificar**:
```bash
# Via ADB
adb shell pm list packages | grep webapk

# Debe mostrar algo como:
org.chromium.webapk.a1b2c3d4...
```

**Si no aparece ningún webapk**:
- La instalación fue como shortcut (no WebAPK)
- Desinstalar y volver a intentar con flags habilitados

### El flag se deshabilitó solo

Chrome puede resetear flags después de actualizaciones.

**Solución**: Volver a habilitar el flag después de cada actualización de Chrome.

## 📊 Comparación de métodos

| Método | Velocidad | Complejidad | Funciona en Chrome 113 |
|--------|-----------|-------------|------------------------|
| Chrome Flags | ⚡ Inmediato | 🟢 Fácil | ✅ Sí |
| ADB | ⚡ Inmediato | 🟡 Media | ✅ Sí |
| Manifest Trick | ⚡ Inmediato | 🟢 Fácil | ✅ Sí |
| Developer Mode | ⚡ Inmediato | 🔴 Difícil | ⚠️ Depende |
| beforeinstallprompt | 🐌 Requiere engagement | 🟡 Media | ❌ No |
| Esperar 2 visitas | 🐌 5+ minutos | 🟢 Fácil | ✅ Sí |

## 🎯 Recomendación para el coche

**Mejor opción**: Chrome Flags

```
1. chrome://flags
2. bypass-app-banner-engagement-checks → Enabled
3. Reiniciar Chrome
4. Instalar app normalmente
```

**Ventajas**:
- ✅ No requiere USB/ADB
- ✅ Funciona en Chrome 113
- ✅ Instalación inmediata
- ✅ Se instala como WebAPK
- ✅ Persiste entre reinicios (hasta actualización de Chrome)

## 🔍 Verificar instalación correcta

Después de instalar con flags habilitados:

```bash
# Test 1: Verificar package
adb shell dumpsys package | grep -A 20 "org.chromium.webapk"

# Test 2: Probar compartir
# 1. Drive → Seleccionar .db → Compartir
# 2. "BYD Stats" DEBE aparecer en la lista

# Test 3: Ver logs
adb logcat | grep -E "WebAPK|ShareTarget"

# Debes ver:
WebAPK: org.chromium.webapk... installed
ShareTarget: handling POST request
```

## ⚠️ Nota importante

Los flags de Chrome son para **testing y desarrollo**. En producción, es mejor cumplir con el engagement score natural para una mejor experiencia de usuario.

Para usuarios finales:
- ✅ Dejar que Chrome maneje el engagement naturalmente
- ✅ Mostrar valor antes de pedir instalación
- ✅ No forzar instalación inmediata

Para testing/desarrollo en el coche:
- ✅ Usar flags para testing rápido
- ✅ No requiere esperar 5 minutos entre pruebas
- ✅ Permite iterar rápidamente

## 📚 Referencias

- [Web.dev: Install criteria](https://web.dev/install-criteria/)
- [Chrome engagement heuristics](https://chromium.googlesource.com/chromium/src/+/master/chrome/browser/banners/app_banner_manager.cc)
- [WebAPK documentation](https://chromium.googlesource.com/chromium/src/+/master/chrome/android/webapk/README.md)
