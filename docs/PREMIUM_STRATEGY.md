# Estrategia Premium: PWA vs APK (Roadmap)

Este documento detalla la hoja de ruta para la monetización y segmentación de BYD Stats, diferenciando la experiencia gratuita (PWA) de la experiencia de pago (APK).

## 1. Segmentación de Versiones

| Característica | PWA (Gratuita / Web) | APK (Premium / Instalada) |
| :--- | :--- | :--- |
| **Almacenamiento** | 100% Local (Navegador) | Local + Firebase Cloud |
| **Sincronización** | Google Drive (Privado) | Firebase Real-time Sync |
| **Smartcar** | No (Bloqueado) | **Sí** (SoC, Bloqueo, Clima) |
| **Inteligencia Artificial** | Básico (Solo local) | **Total** (Predicciones, Smart Charging) |
| **Registro de Cargas** | Limitado | Completo e integrado |
| **Actualizaciones** | Navegador | Automáticas via GitHub |

---

## 2. Flujo de Suscripción (Zero-Touch)

La intención es que la activación sea 100% automática sin intervención del desarrollador:

1.  **Pago**: El usuario se suscribe a un Tier específico en **Ko-Fi**.
2.  **Activación**: Un Webhook de Ko-Fi dispara una **Firebase Cloud Function**.
3.  **Registro**: La función marca al usuario en Firestore como `isPro: true`.
4.  **Acceso**: Al iniciar sesión en la APK, la app detecta el estado y desbloquea las APIs de Smartcar e IA.

---

## 3. Estrategia de Actualización (GitHub)

Para evitar las cuotas de servicios como CapGo, usaremos **GitHub + Capacitor** para actualizaciones "Over-the-Air" (OTA):

1.  **Hosting**: Los bundles de actualización (`.zip` con el código web) se alojarán en **GitHub Pages** o **GitHub Releases**.
2.  **Manifest**: Un archivo `version.json` servirá para que la app compruebe si hay versiones nuevas.
3.  **Instalación**: La app descargará el bundle, lo extraerá localmente y cambiará la base de carga de Capacitor (`setServerBasePath`) para aplicar los cambios sin reinstalar la APK.

---

## 4. Escalabilidad y Costos (Smartcar)

*   **Plan Build Advanced**: Ideal para el arranque (hasta ~100 usuarios estimados bajo este modelo de ahorro).
*   **Escalado (>100 usuarios)**: Una vez superada la barrera de usuarios incluidos, Smartcar suele ofrecer planes por volumen ("Scale").
*   **Renegociación**: Al llegar a volumen de escala, es posible negociar tarifas personalizadas (Bulk Pricing) directamente con su equipo de ventas para mantener el margen de beneficio de la suscripción de Ko-Fi.

---

## 5. Próximos Pasos (1-2 Semanas)

- [ ] Implementar el "muro" de funciones en la UI basado en `isNative && isPro`.
- [ ] Configurar el Webhook de Ko-Fi en Firebase Functions.
- [ ] Crear el script de auto-actualización desde GitHub.
- [ ] Lanzamiento del plan mensual.
