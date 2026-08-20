/**
 * @fileoverview Modul Core: Tipe Data Universal EKG
 * Berisi seluruh definisi tipe data, interface, dan struktur payload
 * yang digunakan lintas modul (Network, Hooks, UI).
 * 
 * UPDATE: Penambahan properti multi-saluran (yI, yII, dll.) pada RPeakMarker 
 * agar penanda QRS dapat dirender di semua grafik gelombang secara presisi.
 */

// --- DARI NETWORK (WebSocket) ---
export interface RawECGData {
    time: number[];
    ch1: number[]; // Lead I
    ch2: number[]; // Lead II
    ch3: number[]; // Lead III (Data Kalibrasi Murni)
}

export interface DeviceValidation {
    status: string;
    warnings: string[];
    hr?: number;
}

export interface DevicePrediction {
    status: string;
    label: string;
    confidence_percent: number;
    probabilities?: Record<string, number>;
    threshold?: number;
    latency_ms?: number;
    runtime?: string;
}

export interface DeviceSystem {
    cpu_usage_percent?: number;
    memory_usage_percent?: number;
    memory_usage_mb?: number;
    cpu_temperature_c?: number;
    uptime_s?: number;
}

export interface DeviceNetwork {
    mqtt_publish_latency_ms?: number;
    wifi_rssi_dbm?: number;
    mqtt_connected?: boolean;
}

export interface DeviceStressTest {
    enabled?: boolean;
    frame_counter?: number;
}

export interface ECGDataPayload {
    raw: RawECGData;
    classification_result?: string;
    confidence?: string;
    anomaly_indices: number[];
    validation?: DeviceValidation;
    prediction_details?: DevicePrediction;
    system?: DeviceSystem;
    network?: DeviceNetwork;
    stress_test?: DeviceStressTest;
    heart_rate?: number;
    ecg?: any; // To allow for older JSON structures
    prediction?: any;
    created_at?: string;
    message_id?: string;
    frame_id?: string;
    measurement_id?: string;
    device_id?: string;
    session_id?: string;
    timestamp?: string;
    sha256_checksum?: string;
}

export interface ServerMessage {
    type: 'live_data' | 'segment_data' | 'summary' | 'status' | 'error';
    measurement_id?: string;
    device_id?: string;
    session_id?: string;
    timestamp?: string;
    sha256_checksum?: string;
    data_payload?: ECGDataPayload;
    data?: any[]; 
    message?: string;
}

// --- DARI UI & HOOKS ---
export interface ECGPaths {
    I: string[]; II: string[]; III: string[]; aVR: string[]; aVL: string[]; aVF: string[]; V1: string[];
}

export interface RPeakMarker {
    x: number;
    y: number; // Referensi default (biasanya merujuk ke Lead II)
    
    // Properti Baru: Wadah Koordinat Y Multi-Saluran
    yI?: number;
    yII?: number;
    yIII?: number;
    yaVR?: number;
    yaVL?: number;
    yaVF?: number;
    yV1?: number;
    
    // Metrik Kalkulasi Klinis R-R
    bpm?: number;       // Denyut jantung (BPM) pada interval ini
    boxesText?: string; // Teks jumlah kotak besar (contoh: "3,5 kotak")
    
    rrText?: string;    // Menyimpan data jarak waktu detik (sebagai fallback/log)
    prevX?: number;     // Koordinat X puncak R sebelumnya (titik awal garis)
}

export interface TimelineEvent {
    index: number;
    timeStr: string;
    isAnomaly: boolean;
    classResult: string;
}