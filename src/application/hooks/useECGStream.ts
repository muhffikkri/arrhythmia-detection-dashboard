/**
 * @fileoverview Modul Application Layer: useECGStream Hook
 * Konduktor utama yang mengorkestrasi aliran data EKG.
 * 
 * UPDATE: 
 * 1. Implementasi memori Look-Back Buffer (recentSamples) untuk mengoreksi 
 *    keterlambatan algoritma Pan-Tompkins dan mencari nilai puncak mutlak (Maxima).
 * 2. Penyimpanan koordinat Y Multi-Saluran untuk sinkronisasi render marker.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { API_URL } from '../../config/env';
import { ECGWebSocketClient } from '../../data/network/websocketClient';
import { PanTompkins } from '../../core/algorithms/panTompkins';
import { DCBlocker } from '../../core/algorithms/dcBlocker';
import { evaluateIrregularity, generateClinicalExplanation } from '../../core/clinical/ruleBasedEngine';
import { processECGSamples } from '../../core/algorithms/ecgPipeline';
import { calculateEinthovenPoint } from '../../core/algorithms/einthoven';
import { calculateSingleRRInterval, calculateRRMetrics } from '../../core/algorithms/peakToPeak';


import type { ClinicalExplanation } from '../../core/clinical/ruleBasedEngine';
import type { ECGPaths, RPeakMarker, TimelineEvent, ServerMessage, ECGDataPayload, DeviceSystem, DeviceNetwork, DevicePrediction, DeviceStressTest } from '../../core/types/ecgTypes';
import { fetchWithAuth } from '../../config/api';

const TOTAL_POINTS = 2500;
const X_STEP = 2000 / TOTAL_POINTS;

const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

type SamplePoint = {
    xIndex: number;
    x: number;
    yI: number;
    yII: number;
    yIII: number;
    yaVR: number;
    yaVL: number;
    yaVF: number;
    yV1: number;
};

export interface UseECGStreamReturn {
    isRecording: boolean;
    paths: ECGPaths;
    rPeaks: RPeakMarker[];
    heartRate: number | string;
    clinicalStatus: ClinicalExplanation | null;
    timeline: TimelineEvent[];
    startStream: () => void;
    stopStream: () => void;
    fetchSummary: () => void;
    fetchSegment: (index: number) => void;
    isFilterOn: boolean;
    toggleFilter: () => void;
    system: DeviceSystem | null;
    network: DeviceNetwork | null;
    prediction: DevicePrediction | null;
    stressTest: DeviceStressTest | null;
    createdAt: string | null;
    receivedAt: string | null;
    deviceId: string;
    sessionId: string;
    rawClassification: string | null;
}

export const useECGStream = (endpoint: string): UseECGStreamReturn => {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [paths, setPaths] = useState<ECGPaths>({ I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] });
    const [rPeaks, setRPeaks] = useState<RPeakMarker[]>([]);
    const [heartRate, setHeartRate] = useState<number | string>('--');
    const [clinicalStatus, setClinicalStatus] = useState<ClinicalExplanation | null>(null);
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

    // --- STATE EDGE AI METRICS & DEVICE ---
    const [system, setSystem] = useState<DeviceSystem | null>(null);
    const [network, setNetwork] = useState<DeviceNetwork | null>(null);
    const [prediction, setPrediction] = useState<DevicePrediction | null>(null);
    const [stressTest, setStressTest] = useState<DeviceStressTest | null>(null);
    const [createdAt, setCreatedAt] = useState<string | null>(null);
    const [receivedAt, setReceivedAt] = useState<string | null>(null);
    const [deviceId, setDeviceId] = useState<string>("MENUNGGU PERANGKAT...");
    const [sessionId, setSessionId] = useState<string>("MENUNGGU SESI...");
    const [rawClassification, setRawClassification] = useState<string | null>(null);

    // --- MANAJEMEN FILTER STATE ---
    const [isFilterOn, setIsFilterOn] = useState<boolean>(true);
    const filterStateRef = useRef<boolean>(true);

    const clientRef = useRef<ECGWebSocketClient | null>(null);
    const ptRef = useRef<PanTompkins>(new PanTompkins(250));
    const visualDcBlockerRef = useRef<DCBlocker>(new DCBlocker());
    const mathDcBlockerRef = useRef<DCBlocker>(new DCBlocker());

    const toggleFilter = useCallback(() => {
        setIsFilterOn(prev => {
            const newState = !prev;
            filterStateRef.current = newState;
            if (newState && visualDcBlockerRef.current) {
                visualDcBlockerRef.current.reset();
            }
            return newState;
        });
    }, []);

    const dataRef = useRef({
        xIndex: 0,
        currentPaths: { I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] } as ECGPaths,
        peakBuffer: [] as { x: number; index: number }[],
        rrIntervals: [] as number[],
        timelineSeconds: 0,
        currentRPeaks: [] as RPeakMarker[],
        recentSamples: [] as SamplePoint[] // Look-Back Buffer untuk akurasi puncak
    });

    const preRegisteredFramesRef = useRef<Set<string>>(new Set());
    const unlinkedFramesRef = useRef<string[]>([]);
    const lastSessionIdRef = useRef<string | null>(null);

    const processDataChunk = useCallback((payload: ECGDataPayload, timestamp?: string, currentSessionId?: string | null) => {
        const { raw, classification_result, anomaly_indices, prediction_details, system: sysData, network: netData, stress_test } = payload;

        const isNormal = classification_result?.toUpperCase() === 'NORMAL' || classification_result?.toUpperCase() === 'NORM';
        const isAnomaly = !isNormal;

        if (classification_result) setRawClassification(classification_result);

        if (prediction_details) setPrediction(prediction_details);
        if (sysData) setSystem(sysData);
        if (netData) setNetwork(netData);
        if (stress_test) setStressTest(stress_test);
        if (timestamp) {
            setCreatedAt(timestamp);
            setReceivedAt(new Date().toISOString());
        }

        let { xIndex, currentPaths, peakBuffer, rrIntervals, timelineSeconds, currentRPeaks, recentSamples } = dataRef.current;
        const ch1 = raw.ch1; const ch2 = raw.ch2; const ch3 = raw.ch3;

        for (let i = 0; i < ch1.length; i++) {
            if (xIndex >= TOTAL_POINTS) {
                xIndex = 0; timelineSeconds += 10;
                currentPaths = { I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] };
                peakBuffer = []; rrIntervals = []; currentRPeaks = []; recentSamples = [];
                // JALUR MATEMATIS KONTINU: ptRef dan mathDcBlockerRef tidak direset
                visualDcBlockerRef.current.reset(); // JALUR VISUAL: Reset agar selalu dimulai tepat dari 0
            }

            if (xIndex === 0) {
                const currentIntervalStr = `${formatTime(timelineSeconds)} - ${formatTime(timelineSeconds + 10)}`;
                if (!preRegisteredFramesRef.current.has(currentIntervalStr)) {
                    preRegisteredFramesRef.current.add(currentIntervalStr);
                    const frameId = `fra${Date.now()}${Math.floor(Math.random() * 1000)}`;

                    fetchWithAuth(`/api/frames`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: frameId,
                            time_interval: currentIntervalStr,
                            session_id: currentSessionId || null
                        })
                    }).catch(e => console.error("Gagal preregister frame:", e));

                    if (!currentSessionId) {
                        unlinkedFramesRef.current.push(frameId);
                    }
                }
            }

            const rawI = ch1[i];
            const rawII = ch2[i];
            const rawIII = ch3[i];

            let visualI = rawI, visualII = rawII, visualIII = rawIII;

            if (filterStateRef.current) {
                const vCleaned = visualDcBlockerRef.current.process(rawI, rawII);
                visualI = vCleaned.cleanI;
                visualII = vCleaned.cleanII;
                visualIII = vCleaned.cleanIII;
            }

            const calculated = calculateEinthovenPoint(visualI, visualII);

            const currentX = Number((xIndex * X_STEP).toFixed(2));

            // Kalkulasi koordinat Y untuk seluruh 7 saluran (Skala Medis Standar: 1mV = 80px, Center = 240px)
            const yI = 240 - visualI * 80;
            const yII = 240 - visualII * 80;
            const yIII = 240 - visualIII * 80;
            const yaVR = 240 - calculated.aVR * 80;
            const yaVL = 240 - calculated.aVL * 80;
            const yaVF = 240 - calculated.aVF * 80;
            const yV1 = 240.00;

            currentPaths.I.push(`${currentX},${yI.toFixed(2)}`);
            currentPaths.II.push(`${currentX},${yII.toFixed(2)}`);
            currentPaths.III.push(`${currentX},${yIII.toFixed(2)}`);
            currentPaths.aVR.push(`${currentX},${yaVR.toFixed(2)}`);
            currentPaths.aVL.push(`${currentX},${yaVL.toFixed(2)}`);
            currentPaths.aVF.push(`${currentX},${yaVF.toFixed(2)}`);
            currentPaths.V1.push(`${currentX},${yV1.toFixed(2)}`);

            // Memasukkan titik saat ini ke dalam memori Look-Back Buffer
            recentSamples.push({ xIndex, x: currentX, yI, yII, yIII, yaVR, yaVL, yaVF, yV1 });
            // Menjaga memori maksimal 50 sampel terakhir (setara 200ms)
            if (recentSamples.length > 50) recentSamples.shift();

            // JALUR MATEMATIS KONTINU
            const mCleaned = mathDcBlockerRef.current.process(rawI, rawII);
            const absoluteXIndex = (timelineSeconds / 10) * TOTAL_POINTS + xIndex;

            // Eksekusi Pendeteksi Puncak QRS
            const isPeak = ptRef.current.detectRealTime(mCleaned.cleanII, absoluteXIndex);

            if (isPeak && recentSamples.length > 0) {
                // Algoritma Pan-Tompkins memiliki keterlambatan (delay) secara natural.
                // Kita mencari puncak absolut (Maxima) dari buffer sampel masa lalu.
                let truePeak = recentSamples[0];
                for (let j = 1; j < recentSamples.length; j++) {
                    // Minima di koordinat pixel Y berarti Maxima di tegangan mV (puncak teratas)
                    if (recentSamples[j].yII < truePeak.yII) {
                        truePeak = recentSamples[j];
                    }
                }

                const marker: RPeakMarker = {
                    x: truePeak.x,
                    y: truePeak.yII, // Referensi default
                    yI: truePeak.yI,
                    yII: truePeak.yII,
                    yIII: truePeak.yIII,
                    yaVR: truePeak.yaVR,
                    yaVL: truePeak.yaVL,
                    yaVF: truePeak.yaVF,
                    yV1: truePeak.yV1
                };

                if (peakBuffer.length > 0) {
                    const prev = peakBuffer[peakBuffer.length - 1];
                    // Kalkulasi jarak menggunakan index historis yang sudah terkoreksi
                    const secDist = calculateSingleRRInterval(prev.index, truePeak.xIndex, 250);

                    const metrics = calculateRRMetrics(secDist);
                    marker.bpm = metrics.bpm;
                    marker.boxesText = metrics.boxesText;

                    rrIntervals.push(secDist);
                    marker.rrText = `${secDist}s`;
                    marker.prevX = prev.x;
                    
                    // NEW: Update BPM seketika secara Real-Time tanpa menunggu frame selesai!
                    setHeartRate(metrics.bpm);
                }

                currentRPeaks.push(marker);
                peakBuffer.push({ x: truePeak.x, index: truePeak.xIndex });
            }
            xIndex++;

            // MENCATAT TIMELINE TEPAT DI UJUNG FRAME (Penyelesaian Masalah 9 dari 10 Frame)
            if (xIndex === TOTAL_POINTS) {
                const evalResult = evaluateIrregularity(rrIntervals);
                const explanation = generateClinicalExplanation(classification_result || "UNKNOWN", isAnomaly, evalResult);
                setClinicalStatus(explanation);
                setHeartRate(prevHR => {
                    if (evalResult.hr > 0) return evalResult.hr;
                    if (payload.validation?.hr) return payload.validation.hr;
                    if (payload.heart_rate) return payload.heart_rate;
                    return prevHR !== '--' ? prevHR : '--';
                });
                setTimeline(prev => [...prev, {
                    index: timelineSeconds / 10, timeStr: formatTime(timelineSeconds),
                    isAnomaly, classResult: classification_result || "UNKNOWN"
                }]);
            }
        }

        dataRef.current = { xIndex, currentPaths, peakBuffer, rrIntervals, timelineSeconds, currentRPeaks, recentSamples };
        setPaths({ ...currentPaths }); setRPeaks([...currentRPeaks]);
    }, []);

    const initWebSocket = useCallback(() => {
        if (!clientRef.current) {
            clientRef.current = new ECGWebSocketClient(endpoint);
            clientRef.current.onMessage = (msg: ServerMessage) => {
                if (msg.type === 'summary' && msg.data) {
                    const summaries = msg.data.map(seg => {
                        const classRes = (seg as any).class_result;
                        const isNormal = classRes?.toUpperCase() === 'NORMAL' || classRes?.toUpperCase() === 'NORM';
                        return {
                            index: (seg as any).index, timeStr: formatTime((seg as any).index * 10),
                            isAnomaly: !isNormal, classResult: classRes
                        };
                    });
                    setTimeline(summaries);
                }
                else if (msg.type === 'live_data' || msg.type === 'segment_data') {
                    if (msg.device_id) setDeviceId(msg.device_id);
                    if (msg.session_id) {
                        setSessionId(msg.session_id);
                        lastSessionIdRef.current = msg.session_id;

                        // Link frames that were created before session_id was available
                        if (unlinkedFramesRef.current.length > 0) {
                            unlinkedFramesRef.current.forEach(frameId => {
                                fetchWithAuth(`/api/frames/${frameId}/session`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ session_id: msg.session_id })
                                }).catch(e => console.error("Gagal link session ke frame:", e));
                            });
                            unlinkedFramesRef.current = [];
                        }
                    }
                    if (msg.data_payload) {
                        if (msg.type === 'segment_data') {
                            dataRef.current.xIndex = TOTAL_POINTS;
                            dataRef.current.timelineSeconds = (msg.data_payload as any).segment_index * 10;
                        }
                        processDataChunk(msg.data_payload, msg.timestamp, msg.session_id || lastSessionIdRef.current);
                    }
                }
                else if (msg.type === 'status') setIsRecording(false);
            };
            clientRef.current.onClose = () => setIsRecording(false);
        }
    }, [endpoint, processDataChunk]);

    const startStream = () => {
        if (isRecording) return;
        setIsRecording(true); setTimeline([]); setClinicalStatus(null); setHeartRate('--'); setRawClassification(null);

        dataRef.current = {
            xIndex: 0, currentPaths: { I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] },
            peakBuffer: [], rrIntervals: [], timelineSeconds: 0, currentRPeaks: [], recentSamples: []
        };
        preRegisteredFramesRef.current.clear();
        unlinkedFramesRef.current = [];
        lastSessionIdRef.current = null;
        ptRef.current.reset();
        visualDcBlockerRef.current.reset();
        mathDcBlockerRef.current.reset();

        initWebSocket();
        clientRef.current?.connect();
    };

    const stopStream = () => {
        setIsRecording(false); clientRef.current?.disconnect();
    };

    const fetchSummary = () => { initWebSocket(); clientRef.current?.connect(); };
    const fetchSegment = (index: number) => { clientRef.current?.sendCommand({ command: "get_segment", index }); };

    useEffect(() => { return () => { clientRef.current?.disconnect(); }; }, []);

    return {
        isRecording, paths, rPeaks, heartRate, clinicalStatus, timeline,
        startStream, stopStream, fetchSummary, fetchSegment,
        isFilterOn, toggleFilter, system, network, prediction, stressTest, createdAt, receivedAt, deviceId, sessionId, rawClassification
    };
};