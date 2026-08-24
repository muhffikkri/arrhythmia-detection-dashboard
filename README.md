# Arrhythmia Detection Dashboard (ECG Simulation)

A real-time medical dashboard designed for streaming and monitoring Electrocardiogram (ECG) data, featuring advanced clinical algorithms and AI-powered arrhythmia detection. 

This project simulates a medical device monitor, streaming high-frequency ECG data through a robust Rust-based WebSocket backend to a highly responsive React frontend rendered via HTML Canvas.

## 🚀 Features

- **Progressive Web App (PWA):** Fully installable on Desktop and Mobile devices, featuring an offline-ready caching mechanism and background auto-updates.
- **Backend Synchronization:** Seamless state synchronization for patient profiles with a graceful mock/local storage fallback when the API server is unreachable.
- **Real-Time ECG Streaming:** High-performance data streaming from backend to frontend.
- **AI Arrhythmia Detection:** Integrates AI model predictions for clinical insights.
- **Clinical Algorithms:** Implements Einthoven, Pan-Tompkins, and Peak-to-Peak algorithms for signal processing.
- **HTML Canvas Rendering:** Smooth, performant rendering of ECG waveforms using custom React Canvas components.
- **Clean Architecture:** Strict separation of concerns (Core, Data, Application, Presentation layers) in the frontend.

## 🛠️ Technology Stack

### Frontend (React + Vite)
- **Framework:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **State Management:** Custom Hooks (`useECGStream`)
- **Rendering:** HTML5 `<canvas>` for high-performance waveform visualization

### Backend (Rust)
- **Language:** Rust (Edition 2021)
- **WebSockets:** `tungstenite` for TCP Server and WebSocket streaming (Port 8080)
- **Data Parsing:** `csv` crate for reading simulated medical data
- **Serialization:** `serde` & `serde_json`

## 📂 Project Architecture

```text
├── backend/               # Rust WebSocket Server
│   ├── src/models/        # Data structures & JSON payloads
│   ├── src/data/          # CSV reading & Data simulation
│   ├── src/network/       # WebSocket handling (Port 8080)
│   └── src/main.rs        # Backend entry point
├── src/                   # React Frontend
│   ├── core/              # Pure clinical logic (Algorithms, Rule Engines)
│   ├── data/              # Network & Security (WebSockets, Checksum)
│   ├── application/       # State management hooks
│   └── presentation/      # UI Components (Dashboard, Canvas, Layout)
└── best_model.keras       # AI Model for Arrhythmia Detection
```

## ⚙️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Python 3.10+](https://www.python.org/)

### 1. Install Dependencies
Install React frontend packages and Python dependencies:
```bash
# Install React dependencies
npm install

# Install Python MQTT listener & analysis requirements
pip install -r scripts/mqtt/requirements.txt
```

### 2. Run the MQTT Listener & WebSocket Bridge
The listener script connects to the cloud MQTT broker to receive incoming ECG frames, saves raw JSON/CSVs in the `dataset/` directory, checks packet loss, and runs a local WebSocket server (on port `8080`) to bridge and stream this data in real-time directly to the React dashboard.
```bash
python scripts/mqtt/mqtt_listener.py
```

### 3. Run the Frontend Dashboard (React)
Start the Vite development server. The frontend will automatically connect to the WebSocket bridge at `ws://127.0.0.1:8080` and render live ECG telemetry.
```bash
npm run dev
```
*The dashboard will be available at `http://localhost:5173`.*

### 4. Run the Device Simulator (Optional)
To publish simulated ECG waves, CPU metrics, and a draining battery level to the MQTT broker for testing:
```bash
python scripts/mqtt/simulate_device.py --interval 10.0 --battery-start 100.0
```

### 5. Run Stress Test Diagnostics
To check packet loss rates, analyze CPU metrics, calculate battery depletion times, and generate diagnostic plots:
```bash
python scripts/mqtt/analyze_stress_test.py
```
*Charts will be saved to `dataset/plots/stress_test_analysis.png`.*

## 📜 License
This project is for educational and simulation purposes.
