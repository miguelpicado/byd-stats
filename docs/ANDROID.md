# 📱 BYD Stats - Versión Android

Aplicación Android nativa para analizar las estadísticas de tu vehículo BYD, con diseño responsive optimizado para móvil y tablet.

## ✨ Características

- ✅ **100% Offline**: Todos los datos se procesan localmente en tu dispositivo
- ✅ **Diseño Responsive**: Optimizado para móviles y tablets de todos los tamaños
- ✅ **Privacidad Total**: Tus datos nunca salen de tu dispositivo
- ✅ **Todas las funcionalidades**: Mismas características que la versión web
- ✅ **Análisis completo**: Gráficos de consumo, eficiencia, patrones de uso y récords
- ✅ **Soporte para archivos .db**: Lee directamente el archivo EC_Database.db de tu BYD

## 📲 Instalación

### Opción 1: Compilar la APK tú mismo

Sigue las instrucciones detalladas en [ANDROID_BUILD.md](ANDROID_BUILD.md) para generar la APK desde el código fuente.

### Opción 2: Usar Android Studio

1. Clona este repositorio
2. Ejecuta `npm install`
3. Ejecuta `npm run android:sync`
4. Ejecuta `npm run android:open` para abrir el proyecto en Android Studio
5. Compila y ejecuta en tu dispositivo

## 🚀 Inicio rápido

```bash
# Instalar dependencias
npm install

# Sincronizar con Android (build + sync)
npm run android:sync

# Abrir en Android Studio
npm run android:open

# Compilar APK directamente
npm run android:build
```

## 📝 Cómo usar la app

1. **Obtén el archivo de datos**: Conecta un pendrive a tu BYD y copia el archivo `EC_Database.db` desde la carpeta `EnergyData`

2. **Carga el archivo**: Abre la app en tu Android y selecciona el archivo .db desde tu almacenamiento

3. **Explora tus datos**: Navega por las diferentes pestañas para ver:
   - Resumen general de tus viajes
   - Tendencias de consumo
   - Patrones de uso por hora y día
   - Análisis de eficiencia
   - Récords personales

## 🎨 Mejoras de diseño responsive

- **Header compacto**: Logo y navegación optimizados para pantallas pequeñas
- **Tabs scrollables**: Navegación horizontal con scroll suave
- **Filtros adaptables**: Layout vertical en móvil, horizontal en tablet
- **Tarjetas de estadísticas**: Tamaños ajustados para mejor legibilidad
- **Gráficos optimizados**: Alturas reducidas y fuentes más pequeñas en móvil
- **Grids responsivas**: De 1 columna en móvil a 4 en desktop
- **Tipografía escalable**: Tamaños de fuente adaptativos según el dispositivo

## 🔧 Requisitos técnicos

- **Android**: 5.0 (Lollipop) o superior (API 21+)
- **Espacio**: ~3 MB para la app
- **Permisos**: Acceso a almacenamiento para leer archivos .db

## 📦 Tecnologías utilizadas

- **React** 19.2.0 - Framework de UI
- **Capacitor** 8.0.0 - Puente nativo para Android
- **Recharts** 3.6.0 - Librería de gráficos
- **Tailwind CSS** 3.4.19 - Framework CSS
- **SQL.js** 1.8.0 - Motor SQLite en JavaScript
- **Vite** 7.2.4 - Build tool

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Si encuentras algún problema o tienes sugerencias:

1. Abre un issue describiendo el problema
2. Haz un fork del repositorio
3. Crea una rama para tu feature
4. Envía un pull request

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia que se especifique en el repositorio principal.

## 🙏 Agradecimientos

- Comunidad de usuarios de BYD
- Desarrolladores de Capacitor
- Contribuidores del proyecto

---

**Nota**: Esta app es un proyecto independiente y no está afiliada oficialmente con BYD.
