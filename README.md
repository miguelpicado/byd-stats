# BYD Stats v2.0.0 ⚡🚗

**BYD Stats** is a powerful, offline-first Progressive Web App (PWA) designed to track, analyze, and optimize your BYD EV driving and charging experience.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-2.0.0-green.svg)
![Status](https://img.shields.io/badge/status-stable-success.svg)

## 🌟 Key Features (v2.0.0)

### 🧠 AI & Predictive Analytics
- **Range Prediction**: Uses TensorFlow.js to predict your real-world range based on driving style and temperature.
- **Battery Health (SoH)**: AI monitoring of your battery's State of Health over time.
- **Trip Analysis**: Deep dives into efficiency (kWh/100km) vs. speed and distance.

### ⚡ Smart Charging V5
- **Intelligent Scheduling**: Calculates the cheapest and most efficient times to charge based on your tariff (Hourly/Period).
- **Volume Optimization**: Groups charging sessions to minimize start/stop cycles.
- **Scenario Planning**: "Standard", "Long Trip", and "Emergency" presets.

### 📊 Comprehensive Tracking
- **Trip Logging**: Import CSVs (e.g., from Car Scanner ELM OBD2) to visualize every trip.
- **Charge Registry**: Track costs, locations, and efficiency of your charging sessions.
- **Cost Analysis**: See exactly how much you spend per km and per kWh.

### 🛠️ Technical Prowess
- **Privacy First**: All data lives locally in your browser (IndexedDB/SQL.js). Optional Google Drive Sync.
- **PWA**: Installable on Android/iOS/Desktop. Works 100% offline.
- **Modern Stack**: Built with React, TypeScript, Vite, and TailwindCSS.

## 🚀 Getting Started

1.  **Open the App**: Visit [bydstats.com](https://bydstats.com) (or your local deployment).
2.  **Import Data**: Go to Settings -> Import and load your `.csv` files.
3.  **Configure Car**: Set your model (Atto 3, Seal, Dolphin, etc.) and battery size.
4.  **Analyze**: Explore the Dashboard, Charts, and AI Predictions.

## 🤝 Contributing

We welcome contributions!
1.  Fork the repo.
2.  Create a feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'Add some amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
