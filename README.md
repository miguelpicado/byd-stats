# 🚗 BYD Stats Analyzer (AI Experiment)

Este proyecto es un **analizador visual de estadísticas para vehículos BYD**. Permite cargar el archivo de base de datos interna del coche para generar gráficos detallados sobre consumo, eficiencia, rutas y patrones de uso.

---

## 📊 ¿Qué hace esta aplicación?
La web procesa el archivo `EC_Database.db` que los vehículos BYD generan automáticamente. Al cargar el archivo, la aplicación extrae datos para mostrar:
* **Resumen General:** Kilómetros totales, energía consumida (kWh), eficiencia media y tiempo de conducción.
* **Tendencias:** Evolución mensual y diaria de distancias y consumos.
* **Patrones de Uso:** Análisis de viajes por hora del día y día de la semana.
* **Eficiencia:** Gráficos de dispersión que relacionan la distancia con el consumo (kWh/100km).
* **Récords:** Tus viajes más largos, más eficientes o de mayor duración.

---

## 📂 Cómo obtener tus datos
Para usar esta herramienta, necesitas el archivo de base de datos de tu vehículo:
1. Conecta un pendrive al puerto USB de tu BYD.
2. En la carpeta **`EnergyData`** de la unidad, busca el archivo llamado **`EC_Database.db`**.
3. Arrastra ese archivo directamente a la aplicación web.

> [!IMPORTANT]
> **Privacidad total:** Esta aplicación se ejecuta 100% en tu navegador. El archivo `.db` **no se sube a ningún servidor**. Los datos se procesan localmente mediante `sql.js` y se almacenan únicamente en el almacenamiento local de tu navegador.

---

## 🤖 Sobre este proyecto
Este sitio es un **experimento realizado con Inteligencia Artificial** (Gemini). Nació como un proyecto personal para explorar las capacidades de visualización de datos en React y para entender mejor el rendimiento de mi propio **BYD Seal**.

* **Propósito:** Jugar, aprender y compartir una herramienta útil con la comunidad de usuarios de BYD.
* **Tecnologías:** React, Vite, Recharts (gráficos), Tailwind CSS (diseño) y SQL.js (lectura de DB).

---

## 💡 Sugerencias y Mejora
¡Este proyecto está vivo! Si tienes ideas para nuevos gráficos, mejoras en la interfaz o has encontrado algún error, **cualquier sugerencia es más que bienvenida**. 

No soy un desarrollador experto, ¡estoy aquí para aprender! :-)

---

## 📱 Versión Android

¡Ahora disponible como app nativa para Android! Con diseño responsive optimizado para móviles y tablets.

### 🚀 Obtener la APK

**Opción 1: Descargar desde GitHub Actions (Recomendado)**

1. Ve a la pestaña [Actions](../../actions) de este repositorio
2. Selecciona el workflow "Manual APK Build"
3. Haz clic en "Run workflow" → "Run workflow"
4. Espera 5-10 minutos a que compile
5. Descarga el archivo APK desde "Artifacts"

**Opción 2: Descargar desde Releases**

Si hay un tag de versión (v1.0.0, etc.), la APK estará disponible en [Releases](../../releases)

**Opción 3: Compilar localmente**

Consulta [ANDROID_BUILD.md](ANDROID_BUILD.md) para instrucciones detalladas

### ✨ Características de la app Android

- ✅ Funciona 100% offline
- ✅ Diseño responsive para móvil y tablet
- ✅ Todas las funcionalidades de la versión web
- ✅ Privacidad total (datos procesados localmente)
- ✅ Compatible con Android 5.0+

Para más información, consulta [README_ANDROID.md](README_ANDROID.md)

---

## 🛠️ Instalación local (desarrollo)
```bash
git clone https://github.com/miguelpicado/byd-stats.git
cd byd-stats
npm install
npm run dev
```

### Scripts disponibles

```bash
npm run dev              # Servidor de desarrollo
npm run build            # Build para producción
npm run android:sync     # Build + sincronizar con Android
npm run android:open     # Abrir proyecto en Android Studio
npm run android:build    # Build completo de APK
```

---
Hecho en Galicia con ❤️ y mucha curiosidad