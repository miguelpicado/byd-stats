# 🚀 Guía rápida: Obtener tu APK en 5 pasos

## ⚡ La forma MÁS FÁCIL de obtener la APK

### Paso 1️⃣: Ir a GitHub Actions

```
Tu repositorio → Pestaña "Actions" (arriba)
```

### Paso 2️⃣: Seleccionar el workflow manual

```
En el menú lateral izquierdo:
└─ Manual APK Build  ← Haz clic aquí
```

### Paso 3️⃣: Ejecutar el workflow

```
Botón "Run workflow" (derecha, verde) → Click
├─ Branch: main (o la que uses)
├─ build_type: debug  ← Recomendado
└─ Click en "Run workflow"
```

### Paso 4️⃣: Esperar 5-10 minutos ☕

```
Verás el workflow ejecutándose:
🟡 Amarillo = En proceso
✅ Verde = Completado
❌ Rojo = Error
```

### Paso 5️⃣: Descargar la APK

```
Workflow completado → Scroll down
└─ Sección "Artifacts"
   └─ byd-stats-debug-2024-XX-XX  ← Click para descargar ZIP
      └─ Descomprime → app-debug.apk  ← ¡Esta es tu APK!
```

---

## 📱 Instalar en Android

### Opción A: Transferencia directa

1. **Copia** `app-debug.apk` a tu móvil (cable USB, Bluetooth, Drive, etc.)
2. **Abre** el archivo APK en tu Android
3. **Permite** instalar de fuentes desconocidas (si te lo pide)
4. **Instala** y ¡listo!

### Opción B: ADB (avanzado)

```bash
adb install app-debug.apk
```

---

## 🎯 Tipos de APK

| Tipo | Tamaño | Recomendado para | Logs de debug |
|------|--------|------------------|---------------|
| **debug** | ~3 MB | Pruebas y uso personal | ✅ Sí |
| **release** | ~2 MB | Distribución | ❌ No |
| **both** | Ambas | Si no sabes cuál elegir | Ambos |

💡 **Recomendación:** Usa **debug** para uso personal, es más fácil de instalar.

---

## ❓ FAQ Rápido

### ¿Cada cuánto puedo compilar?

🔁 Las veces que quieras, es gratis (hasta 2000 minutos/mes en GitHub Free)

### ¿Dónde queda guardada la APK?

📦 En "Artifacts" del workflow durante 90 días. Descárgala y guárdala localmente.

### ¿Puedo descargarla desde el móvil?

📱 Sí, pero es más fácil descargarla en PC y luego transferirla.

### ¿Necesito Android Studio?

❌ No. Todo se compila en la nube de GitHub.

### ¿Funciona sin internet?

✅ Una vez instalada, la app funciona 100% offline.

### ¿Se actualiza sola?

❌ No. Debes compilar y reinstalar manualmente cada actualización.

---

## 🆘 Solución rápida de problemas

### El workflow falla (❌ rojo)

1. Click en el workflow fallido
2. Click en "Build APK"
3. Lee el error en los logs
4. Asegúrate de que el código compile localmente primero

### No aparece la APK en Artifacts

- Verifica que el workflow terminó con ✅ (no ❌)
- Espera a que termine completamente
- Refresca la página

### Error al instalar en Android

- Activa "Instalar de fuentes desconocidas"
- Verifica que sea un archivo `.apk` válido
- Prueba con la versión `debug` en vez de `release`

---

## 📚 Más información

- **Documentación completa:** [GITHUB_ACTIONS.md](GITHUB_ACTIONS.md)
- **Build local con Android Studio:** [ANDROID_BUILD.md](ANDROID_BUILD.md)
- **Info de la app Android:** [README_ANDROID.md](README_ANDROID.md)

---

**¿Primera vez que compilas?** ¡Prueba ahora! Es más fácil de lo que parece 😊
