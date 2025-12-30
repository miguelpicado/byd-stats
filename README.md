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

## 🛠️ Instalación local (desarrollo)
```bash
git clone [https://github.com/miguelpicado/byd-stats.git](https://github.com/miguelpicado/byd-stats.git)
cd byd-stats
npm install
npm run dev

---
Hecho en Galicia con ❤️ y mucha curiosidad