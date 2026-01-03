# 🚗 BYD Stats — Analizador de estadísticas de BYD

[![Android Build](https://github.com/miguelpicado/byd-stats/actions/workflows/android-build.yml/badge.svg)](https://github.com/miguelpicado/byd-stats/actions/workflows/android-build.yml)
[![Manual APK Build](https://github.com/miguelpicado/byd-stats/actions/workflows/manual-build.yml/badge.svg)](https://github.com/miguelpicado/byd-stats/actions/workflows/manual-build.yml)
[![Release](https://img.shields.io/github/v/release/miguelpicado/byd-stats?style=flat-square)](https://github.com/miguelpicado/byd-stats/releases)
[![License](https://img.shields.io/github/license/miguelpicado/byd-stats?style=flat-square)](LICENSE)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fbydstats.com)](https://bydstats.com)

Una herramienta (web + Android) para visualizar y analizar las estadísticas del vehículo BYD a partir del archivo `EC_Database.db`.

## 📌 Resumen
- Procesa el archivo `EC_Database.db` del coche localmente (sin subir datos a servidores).
- Genera gráficos y estadísticas: resumen general, tendencias, patrones de uso, eficiencia y récords de viajes.
- Disponible como aplicación web (SPA con React + Vite) y como app nativa para Android mediante Capacitor.

---

## ✨ Características principales
- Resumen de kilometraje, energía (kWh), eficiencia media y tiempo de conducción
- Tendencias por mes/día y distribución horaria
- Análisis de eficiencia (kWh/100km) y scatterplots de consumo vs distancia
- Clasificación de viajes (más largos, más eficientes, mayor consumo)
- Funciona completamente offline: procesamiento local con `sql.js` y almacenamiento en localStorage
- App Android con mismas funcionalidades y soporte para seleccionar fichero `.db`

---

## 🗂️ Cómo obtener tus datos (EC_Database.db)
1. Introduce un pendrive en el puerto USB del vehículo BYD.
2. Abre la carpeta `EnergyData` en la unidad USB.
3. Copia `EC_Database.db` y arrástralo a la aplicación web (o selecciónalo desde la app Android).

> **Privacidad:** Todos los datos se procesan en tu dispositivo/navegador con `sql.js`; el archivo nunca se sube a ningún servidor.

---

## 🚀 Uso rápido (desarrollo)
Requisitos: Node.js (preferible 18+), npm

```bash
# Clonar y ejecutar en desarrollo
git clone https://github.com/miguelpicado/byd-stats.git
cd byd-stats
npm install
npm run dev
```

- `npm run dev` → servidor de desarrollo (Vite)
- `npm run build` → build de producción
- `npm run preview` → preview del build
- `npm run deploy` → desplegar con `gh-pages` (si lo configuras)

---

## 🤖 Android — obtener la APK
Opciones:
- GitHub Actions: usa el workflow "Manual APK Build" y descarga el artefacto (recomendado)
- Releases: si existe un tag, la APK puede publicarse en Releases
- Compilar localmente: `npm run android:build` (consulta `ANDROID_BUILD.md` para detalles)

Comandos útiles:
```bash
npm run android:sync     # Build + sincronizar con Android
npm run android:open     # Abrir el proyecto Android en Android Studio
npm run android:build    # Build local de APK
```

---

## 🧰 Tecnologías
- React (19.x), Vite
- Recharts (gráficos)
- Tailwind CSS (estilos)
- Capacitor (Android)
- SQL.js (leer `EC_Database.db` en el navegador)

---

## ✅ Requisitos y compatibilidad
- Node.js (18+ recomendado)
- Android Studio, JDK 17+ para build Android
- Android: API 21+ (Android 5.0+)

---

## 🐞 Solución de problemas
Para problemas con la compilación de la APK y CI, revisa `TROUBLESHOOTING.md`.
Si la app no carga correctamente en Android, asegúrate de haber ejecutado `npm run build` antes de sincronizar con Capacitor.

---

## 🤝 Contribuir
1. Abre un issue para discutir tu idea.
2. Haz un fork y crea una rama con tu feature o fix.
3. Envía un Pull Request con una descripción clara.

Por favor, incluye pasos para reproducir errores y capturas si es posible.

---

## 🌐 Sitio oficial
La app dispone de un sitio oficial accesible y funcional en: **https://bydstats.com**. El sitio está pensado para ser usable desde cualquier navegador, incluso desde el navegador del propio vehículo cuando sea posible.

---

## 📄 Licencia y atribución
Este proyecto se publica bajo la **Licencia MIT**. He añadido el archivo `LICENSE` en la raíz del repositorio. Por favor, conserva el aviso de copyright y la atribución a **Miguel Picado** en copias, derivados y redistribuciones.

- Se permiten forks, modificaciones y redistribución siempre que se mantenga la atribución original.
- Si necesitas una aclaración sobre uso comercial o redistribución a gran escala, contacta con el autor.

---

## 🙏 Agradecimientos
Hecho en Galicia con ❤️ — Si te sirve la herramienta, ¡compártela con la comunidad BYD!

---

**Documentación adicional:** [README_ANDROID.md](README_ANDROID.md) · [ANDROID_BUILD.md](ANDROID_BUILD.md) · [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
