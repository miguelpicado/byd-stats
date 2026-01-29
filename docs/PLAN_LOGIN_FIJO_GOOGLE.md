# GUÍA MAESTRA: Login Persistente "Opción Hacker" (Vercel + Supabase)

> **Objetivo**: Conseguir que el inicio de sesión con Google en la web (PWA) de BYD Stats sea **eterno** (o dure 1 año), igual que en la App Nativa de Android, sin pagar ni un euro.

## 🏛️ Arquitectura (Cómo funciona el truco)

1.  **Frontend (Tu PWA)**: Dejará de guardar el token de Google. Ahora solo guardará una "Cookie de Sesión" segura.
2.  **Backend (Vercel)**: Actúa de intermediario. Recibe la Cookie -> Busca el secreto en Supabase -> Pide token fresco a Google -> Se lo da a la PWA.
3.  **Base de Datos (Supabase)**: El único lugar seguro donde guardaremos el `Refresh Token` (la llave maestra) de Google.

---

## 🛠️ Fase 1: Preparativos (Cuentas)

Necesitas tener cuenta en estos 3 servicios (todos tienen capa gratuita generosa):

1.  **Google Cloud Console** (Ya la tienes): Para las credenciales de OAuth.
2.  **Supabase** (Regístrate): Para la base de datos (PostgreSQL).
3.  **Vercel** (Regístrate): Para alojar el código del backend (Serverless Functions).

---

## 🗄️ Fase 2: Configurar Supabase (La Memoria)

1.  Crea un nuevo proyecto en [Supabase](https://supabase.com/dashboard) llamado `byd-stats-auth`.
2.  Ve al **SQL Editor** (barra lateral izquierda) y ejecuta este script para crear la tabla de sesiones:

```sql
create table user_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_email text not null,
  refresh_token text not null, -- ¡Joyas de la corona!
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null,
  user_agent text,
  UNIQUE(user_email) -- Una sesión activa por usuario para simplificar
);

-- Habilitar seguridad (opcional pero recomendado)
alter table user_sessions enable row level security;
```

3.  Ve a **Project Settings -> API**. Copia estos dos valores y guárdalos en un bloc de notas:
    *   **Project URL**
    *   **anon key** (public)

---

## ☁️ Fase 3: Configurar Google Cloud (Las Llaves)

1.  Ve a [Google Cloud Console](https://console.cloud.google.com/).
2.  Selecciona tu proyecto `byd-stats`.
3.  Ve a **APIs & Services -> Credentials**.
4.  Edita tu **OAuth 2.0 Client ID** (o crea uno nuevo tipo "Web Application").
5.  En **Authorized distribute URIs**, añade la URL que tendrá tu backend (te la dará Vercel, pero podemos predecirla o volver aquí luego). Por ahora, pon `http://localhost:5173/api/auth/callback` para pruebas locales.
6.  Copia:
    *   **Client ID**
    *   **Client Secret** (¡Este es nuevo! Antes no lo usábamos).

---

## ⚡ Fase 4: Código del Backend (Vercel)

En tu carpeta `byd-stats` local, vamos a crear la estructura de la API. Vercel detecta automáticamente cualquier archivo dentro de `/api` como una función serverless.

### 4.1. Instalar dependencias backend
Necesitamos un par de librerías pequeñas (no afectan al peso de la app frontend):

```bash
npm install googleapis @supabase/supabase-js cookie
```

### 4.2. Crear los Endpoints

Crea la carpeta `api/auth` y dentro estos 3 archivos:

#### A. `api/auth/login.js` (Inicia el baile)
Redirige al usuario a Google pidiendo acceso "offline" (esto es lo que nos da el Refresh Token).

```javascript
// api/auth/login.js
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI // ej: https://tu-app.vercel.app/api/auth/callback
);

export default function handler(req, res) {
  // Generar URL de login de Google
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive.appdata'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // ¡CRUCIAL para obtener Refresh Token!
    scope: scopes,
    prompt: 'consent' // Fuerza a que nos den refresh token siempre al principio
  });

  res.redirect(url);
}
```

#### B. `api/auth/callback.js` (Recibe la llave maestra)
Google nos devuelve al usuario con un `code`. Lo canjeamos por tokens y guardamos el Refresh Token en Supabase.

```javascript
// api/auth/callback.js
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { serialize } from 'cookie';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

export default async function handler(req, res) {
  const { code } = req.query;

  try {
    // 1. Canjear código por tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // 2. ¿Quién es este usuario?
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // 3. Guardar Refresh Token en Supabase
    // Solo si Google nos dio uno (a veces si ya diste permiso, no lo manda salvo prompt='consent')
    if (tokens.refresh_token) {
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 año de validez nuestra sesión

        const { error } = await supabase
            .from('user_sessions')
            .upsert({
                user_email: userInfo.email,
                refresh_token: tokens.refresh_token,
                expires_at: expiresAt.toISOString(),
                user_agent: req.headers['user-agent']
            }, { onConflict: 'user_email' });

        if (error) throw error;
    }

    // 4. Crear nuestra propia Cookie de Sesión (Segura)
    // En lugar de dar el token de Google, damos "nuestro" identificador (el email en este caso simple)
    // En producción idealmente sería un Session ID opaco.
    const sessionCookie = serialize('byd_session_user', userInfo.email, {
        httpOnly: true, // Javascript no puede leerla (seguridad XSS)
        secure: process.env.NODE_ENV === 'production', // Solo HTTPS
        maxAge: 60 * 60 * 24 * 365, // 1 año
        path: '/',
        sameSite: 'lax'
    });

    res.setHeader('Set-Cookie', sessionCookie);

    // 5. Redirigir a la app principal
    res.redirect('/');
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Error during login');
  }
}
```

#### C. `api/auth/token.js` (La fuente de la eterna juventud)
La PWA llama aquí cuando quiere un token nuevo. Como la PWA envía automáticamente nuestra cookie `byd_session_user`, sabemos quién es.

```javascript
// api/auth/token.js
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

export default async function handler(req, res) {
  // 1. Leer cookie
  const userEmail = req.cookies.byd_session_user;
  if (!userEmail) return res.status(401).json({ error: 'No session' });

  // 2. Buscar Refresh Token en DB
  const { data, error } = await supabase
    .from('user_sessions')
    .select('refresh_token')
    .eq('user_email', userEmail)
    .single();

  if (error || !data) return res.status(401).json({ error: 'Session expired' });

  // 3. Pedir Access Token fresco a Google
  try {
    oauth2Client.setCredentials({ refresh_token: data.refresh_token });
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // 4. Devolver Access Token a la PWA
    res.json({ 
        accessToken: credentials.access_token, 
        expiresAt: credentials.expiry_date 
    });
  } catch (err) {
    // Si falla (ej: usuario revocó acceso), borrar sesión
    await supabase.from('user_sessions').delete().eq('user_email', userEmail);
    res.status(401).json({ error: 'Revoked' });
  }
}
```

---

## 🚀 Fase 5: Despliegue en Vercel

1.  Sube tus cambios a GitHub.
2.  Ve a [Vercel Dashboard](https://vercel.com/dashboard).
3.  Importa tu proyecto `byd-stats`.
4.  En **Environment Variables**, añade:
    *   `GOOGLE_CLIENT_ID`: (De Google Cloud)
    *   `GOOGLE_CLIENT_SECRET`: (De Google Cloud)
    *   `SUPABASE_URL`: (De Supabase)
    *   `SUPABASE_KEY`: (De Supabase - anon key)
    *   `REDIRECT_URI`: La URL final de tu app + `/api/auth/callback` (ej: `https://byd-stats.vercel.app/api/auth/callback`).
    *   `NODE_ENV`: `production`

**¡Importante!**: Una vez tengas la URL de Vercel (`https://byd-stats.vercel.app`), vuelve a Google Cloud Console y añádela a "Authorized Redirect URIs".

---

## 📱 Fase 6: Cambios en el Frontend (PWA)

Ahora solo te queda modificar `src/hooks/useGoogleSync.js` para usar este sistema.

1.  **Login**: En lugar de `useGoogleLogin()` o librerías JS, simplemente haces:
    ```javascript
    window.location.href = '/api/auth/login';
    ```
2.  **Obtener Token**:
    Cuando la app inicia (o recibe un 401), llama a tu API:
    ```javascript
    const refreshMyToken = async () => {
        const res = await fetch('/api/auth/token');
        if (res.ok) {
            const { accessToken } = await res.json();
            googleDriveService.setAccessToken(accessToken);
        } else {
            // Mostrar botón login
        }
    };
    ```

## 🎉 Resultado Final

1.  Entras a la web.
2.  Clic en "Login con Google" -> Te vas a Google -> Vuelves.
3.  La app funciona.
4.  Vuelves dentro de 6 meses.
5.  La app hace un `fetch('/api/auth/token')` silencioso al cargar.
6.  Tu servidor Vercel renueva el token con Google y te lo devuelve.
7.  **Sincronizado al instante**. Magia. ✨
