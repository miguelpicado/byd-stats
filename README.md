# BYD Stats v2.0.0 ⚡🚗

**BYD Stats** es una potente Progressive Web App (PWA) offline-first diseñada para rastrear, analizar y optimizar tu experiencia de conducción y carga de tu vehículo eléctrico BYD.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-2.0.0-green.svg)
![Status](https://img.shields.io/badge/status-stable-success.svg)

## 🌟 Características Principales (v2.0.0)

### 🧠 IA y Analítica Predictiva
- **Predicción de Autonomía**: Utiliza TensorFlow.js para predecir tu autonomía real basándose en tu estilo de conducción y la temperatura.
- **Salud de la Batería (SoH)**: Monitorización por IA del estado de salud de tu batería a lo largo del tiempo.
- **Análisis de Viajes**: Análisis profundos de eficiencia (kWh/100km) vs. velocidad y distancia.

### ⚡ Carga Inteligente V5 (Smart Charging)
- **Programación Inteligente**: Calcula los momentos más baratos y eficientes para cargar basándose en tu tarifa (Horaria/Periodo).
- **Optimización por Volumen**: Agrupa las sesiones de carga para minimizar los ciclos de arranque/parada.
- **Planificación de Escenarios**: Preajustes para "Estándar", "Viaje Largo" y "Emergencia".

### 📊 Seguimiento Integral
- **Registro de Viajes**: Importa CSVs (ej. de Car Scanner ELM OBD2) para visualizar cada viaje.
- **Registro de Cargas**: Rastrea costes, ubicaciones y eficiencia de tus sesiones de carga.
- **Análisis de Costes**: Mira exactamente cuánto gastas por km y por kWh.

### 🛠️ Destreza Técnica
- **Privacidad Primero**: Todos los datos viven localmente en tu navegador (IndexedDB/SQL.js). Sincronización opcional con Google Drive.
- **PWA**: Instalable en Android/iOS/Desktop. Funciona 100% offline.
- **Stack Moderno**: Construido con React, TypeScript, Vite y TailwindCSS.

## 🚀 Empezando

1.  **Abre la App**: Visita [bydstats.com](https://bydstats.com) (o tu despliegue local).
2.  **Importa Datos**: Ve a Ajustes -> Importar y carga tus archivos `.csv`.
3.  **Configura el Coche**: Selecciona tu modelo (Atto 3, Seal, Dolphin, etc.) y tamaño de batería.
4.  **Analiza**: Explora el Panel, Gráficos y Predicciones de IA.

## 🤝 Contribuir

¡Aceptamos contribuciones!
1.  Haz un Fork del repo.
2.  Crea una rama de funcionalidad (`git checkout -b feature/funcionalidad-increible`).
3.  Haz commit de tus cambios (`git commit -m 'Añadir alguna funcionalidad increíble'`).
4.  Haz push a la rama (`git push origin feature/funcionalidad-increible`).
5.  Abre un Pull Request.

## 📄 Licencia

Distribuido bajo la Licencia MIT. Ver `LICENSE` para más información.
