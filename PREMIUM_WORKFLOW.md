# 🔐 Gestión de Repositorio Dual & Workflow Premium

Este repositorio (**BYD-Stats-Premium**) es el repositorio principal de desarrollo. Contiene tanto el código base de la PWA como las funcionalidades exclusivas de la APK Premium.

## 🏗️ Arquitectura de Ramas

Para garantizar que el código Premium nunca se filtre al repositorio público, seguimos una jerarquía estricta:

1.  **`main` (PWA / Open Source)**:
    - Es el núcleo de la aplicación.
    - Contiene el código que es común para la PWA y la APK.
    - Se sincroniza con el repositorio público `miguelpicado/byd-stats`.
    - **PROHIBIDO**: Hacer merge de ramas premium hacia `main`.

2.  **`PremiumAPK` (Premium / APK)**:
    - Es la rama de producción para la APK.
    - Contiene todo el código de `main` + integraciones privadas (PyBYD, Wear OS, etc.).
    - **SOLO** existe en este repositorio privado.
    - Recibe actualizaciones de `main` mediante merges periódicos.

---

## 🔄 Flujo de Trabajo Diario

### 1. Mejoras Generales (Para PWA y APK)
Si estás arreglando un bug visual o añadiendo una traducción que sirve para todos:
1. Trabaja en `main`.
2. Sube los cambios a ambos sitios:
   ```bash
   git checkout main
   # ... cambios ...
   git add .
   git commit -m "fix: corrección visual en dashboard"
   git push-safe  # El script te pedirá confirmar el push al público
   ```

### 2. Mejoras Premium (Solo para la APK)
Si estás tocando la lógica de PyBYD o comandos remotos:
1. Trabaja en `PremiumAPK`.
2. Sube los cambios solo al privado:
   ```bash
   git checkout PremiumAPK
   # ... cambios ...
   git add .
   git commit -m "feat: nuevo comando de climatización"
   git push-safe  # El script detectará que es privada y NO subirá al público
   ```

### 3. Mantener la APK Actualizada
Para que tu versión Premium no se quede atrás respecto a las mejoras de la PWA:
```bash
git checkout PremiumAPK
git merge main
# Resolver conflictos si los hay
git push-safe
```

---

## 🛡️ Herramientas de Seguridad

### Script `push-safe.sh`
Este script (ejecutable mediante el alias `git push-safe`) es tu red de seguridad. Antes de cada push:
1. Comprueba en qué rama estás.
2. Si la rama contiene palabras clave como `PremiumAPK`, `pybyd`, `private` o `premium`, **bloquea** el envío al repositorio público.
3. Si la rama es pública (`main`), te pide confirmación explícita antes de enviar al repositorio de la comunidad.

### Aliases Útiles
- `git status-all`: Para ver qué commits tienes por subir en cada repositorio (Privado vs Público).
- `git sync-main`: Para sincronizar rápidamente la PWA entre ambos mundos.

---

## ⚠️ Regla de Oro
> **Nunca hagas `git merge feat/pybyd-integration` estando en `main`.**
> Si necesitas llevar un cambio específico de la rama Premium a la PWA, usa `git cherry-pick <commit-hash>`.
