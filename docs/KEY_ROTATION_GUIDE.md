# 🔑 Guía de Rotación de Claves — Tarea 1.4

> **ACCIÓN REQUERIDA:** Las claves del `.env` estuvieron expuestas en el historial de git.
> Aunque el historial ya ha sido limpiado, las claves deben considerarse **comprometidas** y regeneradas.

---

## ✅ Ya completado automáticamente

- [x] `git rm --cached .env` — dejar de trackear el archivo
- [x] `git filter-repo --path .env --invert-paths` — eliminado de los 762 commits del historial
- [x] `git push --force origin PremiumAPK` — historial limpio subido a GitHub
- [x] Verificado con `git log --all -- ".env"` → sin resultados ✅

---

## ⚠️ Acción manual requerida: Rotar estas claves

Las claves expuestas estaban en `.env`:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
VITE_SMARTCAR_CLIENT_ID=...
```

---

### 1. Firebase API Key → Restricción (recomendado en vez de regenerar)

> Las Firebase API Keys para web están pensadas para ser públicas, **PERO** deben estar restringidas por dominio HTTP y APIs habilitadas.

1. Ve a [Firebase Console](https://console.firebase.google.com) → **REDACTED_FIREBASE_PROJECT_ID**
2. Entra en **Configuración del proyecto** (⚙️) → **General**
3. En la sección **Tus apps**, haz clic en la app web → **Restricciones de API Key**
4. Busca tu API Key en [Google Cloud Console → Credenciales](https://console.cloud.google.com/apis/credentials?project=REDACTED_FIREBASE_PROJECT_ID)
5. Haz clic en la API Key → **Editar**:
   - En **Restricciones de aplicación** → selecciona **Referentes HTTP** y añade:
     - `https://REDACTED_FIREBASE_PROJECT_ID.web.app/*`
     - `https://REDACTED_FIREBASE_AUTH_DOMAIN/*`
     - Tu dominio personalizado si tienes uno
   - En **Restricciones de API** → selecciona solo las APIs necesarias (Firebase, Firestore, Maps)
6. Guarda los cambios

---

### 2. Google OAuth Client ID → Regenerar si es necesario

1. Ve a [Google Cloud Console → Credenciales](https://console.cloud.google.com/apis/credentials?project=REDACTED_FIREBASE_PROJECT_ID)
2. Busca el **OAuth 2.0 Client ID** correspondiente a tu app
3. Verifica que los **Orígenes de JavaScript autorizados** solo incluyen tus dominios reales
4. Verifica que los **URIs de redirección autorizados** son correctos
5. Si quieres mayor seguridad, puedes **Crear un nuevo OAuth Client ID** y sustituir el antiguo

---

### 3. Smartcar Client ID → Regenerar

1. Ve al [Smartcar Dashboard](https://dashboard.smartcar.com)
2. En tu aplicación → **Settings** → **API Keys**
3. Haz clic en **Regenerate** en el Client Secret (el Client ID no suele poder regenerarse, pero sí el secreto)
4. Actualiza el valor en tu `.env` local

---

## Pasos finales

Después de rotar las claves, actualiza tu `.env` local con los nuevos valores y verifica que la app sigue funcionando:

```bash
npm run dev
```

Si cambias el Firebase API Key también deberás actualizar la configuración en Firebase Hosting si aplica.

---

## Recordatorio: `.env` está en `.gitignore`

Verificado — el `.env` ya está correctamente listado en `.gitignore`. No volverá a ser committeado.
