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
import { MovingAverageFilter, IIRFilter } from '../../core/algorithms/ecgFilters';
import { evaluateIrregularity, generateClinicalExplanation } from '../../core/clinical/ruleBasedEngine';
import { calculateEinthovenPoint } from '../../core/algorithms/einthoven';
import { calculateSingleRRInterval, calculateRRMetrics, calculateBatchRRIntervals, calculateHeartRate } from '../../core/algorithms/peakToPeak';

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

export interface StreamFilterConfig {
    baselineBlocker: boolean;
    hfDenoise: boolean;
    bandpass: boolean;
    zScoreNorm: boolean;
}

type FrameRawSamples = {
    ch1: number[];
    ch2: number[];
    ch3: number[];
};

const calculateStableHeartRateFromFrame = (
    rawFrame: FrameRawSamples,
    config: StreamFilterConfig
): { bpm: number; rrIntervals: number[] } => {
    if (rawFrame.ch1.length === 0 || rawFrame.ch2.length === 0) {
        return { bpm: 0, rrIntervals: [] };
    }

    const detector = new PanTompkins(250);
    const dcBlocker = new DCBlocker();
    const lpI = new MovingAverageFilter(5);
    const lpII = new MovingAverageFilter(5);
    const lpIII = new MovingAverageFilter(5);
    const bpI = new IIRFilter();
    const bpII = new IIRFilter();
    const bpIII = new IIRFilter();
    const peakIndices: number[] = [];

    for (let i = 0; i < rawFrame.ch1.length; i++) {
        let signalI = rawFrame.ch1[i];
        let signalII = rawFrame.ch2[i];
        let signalIII = rawFrame.ch3.length > i ? rawFrame.ch3[i] : signalII - signalI;

        if (config.baselineBlocker) {
            const cleaned = dcBlocker.process(signalI, signalII);
            signalI = cleaned.cleanI;
            signalII = cleaned.cleanII;
            signalIII = cleaned.cleanIII;
        }

        if (config.hfDenoise) {
            signalI = lpI.process(signalI);
            signalII = lpII.process(signalII);
            signalIII = lpIII.process(signalIII);
        }

        if (config.bandpass) {
            signalI = bpI.process(signalI);
            signalII = bpII.process(signalII);
            signalIII = bpIII.process(signalIII);
        }

        if (detector.detectRealTime(signalII, i)) {
            peakIndices.push(i);
        }
    }

    const rrIntervals = calculateBatchRRIntervals(peakIndices, 250);
    const bpm = calculateHeartRate(rrIntervals);
    return { bpm, rrIntervals };
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
    system: DeviceSystem | null;
    network: DeviceNetwork | null;
    prediction: DevicePrediction | null;
    stressTest: DeviceStressTest | null;
    createdAt: string | null;
    receivedAt: string | null;
    deviceId: string;
    sessionId: string;
    rawClassification: string | null;
    isViewingHistory: boolean;
    resumeRealTimeStream: () => void;
}

export const useECGStream = (endpoint: string, filterConfig: StreamFilterConfig = { baselineBlocker: true, hfDenoise: false, bandpass: false, zScoreNorm: false }): UseECGStreamReturn => {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [paths, setPaths] = useState<ECGPaths>({ I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] });
    const [rPeaks, setRPeaks] = useState<RPeakMarker[]>([]);
    const [heartRate, setHeartRate] = useState<number | string>('--');
    const [clinicalStatus, setClinicalStatus] = useState<ClinicalExplanation | null>(null);
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

    const [system, setSystem] = useState<DeviceSystem | null>(null);
    const [network, setNetwork] = useState<DeviceNetwork | null>(null);
    const [prediction, setPrediction] = useState<DevicePrediction | null>(null);
    const [stressTest, setStressTest] = useState<DeviceStressTest | null>(null);
    const [createdAt, setCreatedAt] = useState<string | null>(null);
    const [receivedAt, setReceivedAt] = useState<string | null>(null);
    const [deviceId, setDeviceId] = useState<string>("MENUNGGU PERANGKAT...");
    const [sessionId, setSessionId] = useState<string>("MENUNGGU SESI...");
    const [rawClassification, setRawClassification] = useState<string | null>(null);

    const clientRef = useRef<ECGWebSocketClient | null>(null);
    const ptRef = useRef<PanTompkins>(new PanTompkins(250));
    const visualDcBlockerRef = useRef<DCBlocker>(new DCBlocker());
    const mathDcBlockerRef = useRef<DCBlocker>(new DCBlocker());
    const lpIRef = useRef(new MovingAverageFilter(5));
    const lpIIRef = useRef(new MovingAverageFilter(5));
    const lpIIIRef = useRef(new MovingAverageFilter(5));
    const bpIRef = useRef(new IIRFilter());
    const bpIIRef = useRef(new IIRFilter());
    const bpIIIRef = useRef(new IIRFilter());
    const mathLpIRef = useRef(new MovingAverageFilter(5));
    const mathLpIIRef = useRef(new MovingAverageFilter(5));
    const mathLpIIIRef = useRef(new MovingAverageFilter(5));
    const mathBpIRef = useRef(new IIRFilter());
    const mathBpIIRef = useRef(new IIRFilter());
    const mathBpIIIRef = useRef(new IIRFilter());
    
    const filterConfigRef = useRef(filterConfig);
    useEffect(() => { filterConfigRef.current = filterConfig; }, [filterConfig]);

    const [isViewingHistory, setIsViewingHistory] = useState<boolean>(false);
    const isViewingHistoryRef = useRef<boolean>(false);

    const setViewingHistory = (val: boolean) => {
        isViewingHistoryRef.current = val;
        setIsViewingHistory(val);
    };

    const resumeRealTimeStream = useCallback(() => {
        setViewingHistory(false);
        if (dataRef.current) {
            dataRef.current.xIndex = TOTAL_POINTS;
        }
    }, []);

    const dataRef = useRef({
        xIndex: 0,
        currentPaths: { I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] } as ECGPaths,
        peakBuffer: [] as { x: number; index: number }[],
        rrIntervals: [] as number[],
        timelineSeconds: 0,
        currentRPeaks: [] as RPeakMarker[],
        recentSamples: [] as SamplePoint[],
        frameRawSamples: { ch1: [], ch2: [], ch3: [] } as FrameRawSamples
    });

    const preRegisteredFramesRef = useRef<Set<string>>(new Set());
    const unlinkedFramesRef = useRef<string[]>([]);
    const lastSessionIdRef = useRef<string | null>(null);

    const processDataChunk = useCallback((payload: ECGDataPayload, timestamp?: string, currentSessionId?: string | null) => {
        const { raw, classification_result, prediction_details, system: sysData, network: netData, stress_test } = payload;
        const isNormal = classification_result?.toUpperCase() === 'NORMAL' || classification_result?.toUpperCase() === 'NORM';
        const isAnomaly = !isNormal;

        if (classification_result) setRawClassification(classification_result);
        if (prediction_details) setPrediction(prediction_details);
        if (sysData) setSystem(sysData);
        if (netData) setNetwork(netData);
        if (stress_test) setStressTest(stress_test);
        if (timestamp) { setCreatedAt(timestamp); setReceivedAt(new Date().toISOString()); }

        let { xIndex, currentPaths, peakBuffer, rrIntervals, timelineSeconds, currentRPeaks, recentSamples, frameRawSamples } = dataRef.current;
        const ch1 = raw.ch1; const ch2 = raw.ch2; const ch3 = raw.ch3;

        for (let i = 0; i < ch1.length; i++) {
            if (xIndex >= TOTAL_POINTS) {
                xIndex = 0; timelineSeconds += 10;
                currentPaths = { I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] };
                peakBuffer = []; rrIntervals = []; currentRPeaks = []; recentSamples = [];
                frameRawSamples = { ch1: [], ch2: [], ch3: [] };
                visualDcBlockerRef.current.reset();
                lpIRef.current.reset(); lpIIRef.current.reset(); lpIIIRef.current.reset();
                bpIRef.current.reset(); bpIIRef.current.reset(); bpIIIRef.current.reset();
                mathDcBlockerRef.current.reset();
                mathLpIRef.current.reset(); mathLpIIRef.current.reset(); mathLpIIIRef.current.reset();
                mathBpIRef.current.reset(); mathBpIIRef.current.reset(); mathBpIIIRef.current.reset();
                ptRef.current.reset();
            }

            const rawI = ch1[i]; const rawII = ch2[i]; const rawIII = ch3[i];
            frameRawSamples.ch1.push(rawI);
            frameRawSamples.ch2.push(rawII);
            frameRawSamples.ch3.push(rawIII);
            let visualI = rawI, visualII = rawII, visualIII = rawIII;
            const config = filterConfigRef.current;

            if (config.baselineBlocker) {
                const vCleaned = visualDcBlockerRef.current.process(visualI, visualII);
                visualI = vCleaned.cleanI; visualII = vCleaned.cleanII; visualIII = vCleaned.cleanIII;
            }
            if (config.hfDenoise) {
                visualI = lpIRef.current.process(visualI);
                visualII = lpIIRef.current.process(visualII);
                visualIII = lpIIIRef.current.process(visualIII);
            }
            if (config.bandpass) {
                visualI = bpIRef.current.process(visualI);
                visualII = bpIIRef.current.process(visualII);
                visualIII = bpIIIRef.current.process(visualIII);
            }

            const calculated = calculateEinthovenPoint(visualI, visualII);
            const currentX = Number((xIndex * X_STEP).toFixed(2));
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

            recentSamples.push({ xIndex, x: currentX, yI, yII, yIII, yaVR, yaVL, yaVF, yV1 });
            if (recentSamples.length > 50) recentSamples.shift();

            let mathI = rawI;
            let mathII = rawII;
            let mathIII = rawIII;
            if (config.baselineBlocker) {
                const mCleaned = mathDcBlockerRef.current.process(mathI, mathII);
                mathI = mCleaned.cleanI;
                mathII = mCleaned.cleanII;
                mathIII = mCleaned.cleanIII;
            }
            if (config.hfDenoise) {
                mathI = mathLpIRef.current.process(mathI);
                mathII = mathLpIIRef.current.process(mathII);
                mathIII = mathLpIIIRef.current.process(mathIII);
            }
            if (config.bandpass) {
                mathI = mathBpIRef.current.process(mathI);
                mathII = mathBpIIRef.current.process(mathII);
                mathIII = mathBpIIIRef.current.process(mathIII);
            }
            const absoluteXIndex = (timelineSeconds / 10) * TOTAL_POINTS + xIndex;
            const isPeak = ptRef.current.detectRealTime(mathII, absoluteXIndex);

            if (isPeak && recentSamples.length > 0) {
                let truePeak = recentSamples[0];
                for (let j = 1; j < recentSamples.length; j++) {
                    if (recentSamples[j].yII < truePeak.yII) truePeak = recentSamples[j];
                }
                const marker: RPeakMarker = { x: truePeak.x, y: truePeak.yII, yI: truePeak.yI, yII: truePeak.yII, yIII: truePeak.yIII, yaVR: truePeak.yaVR, yaVL: truePeak.yaVL, yaVF: truePeak.yaVF, yV1: truePeak.yV1 };
                if (peakBuffer.length > 0) {
                    const prev = peakBuffer[peakBuffer.length - 1];
                    const secDist = calculateSingleRRInterval(prev.index, truePeak.xIndex, 250);
                    const metrics = calculateRRMetrics(secDist);
                    marker.bpm = metrics.bpm; marker.boxesText = metrics.boxesText;
                    rrIntervals.push(secDist); marker.rrText = `${secDist}s`; marker.prevX = prev.x;
                }
                currentRPeaks.push(marker); peakBuffer.push({ x: truePeak.x, index: truePeak.xIndex });
            }
            xIndex++;
            if (xIndex === TOTAL_POINTS) {
                const stableResult = calculateStableHeartRateFromFrame(frameRawSamples, config);
                const stableIntervals = stableResult.rrIntervals.length > 0 ? stableResult.rrIntervals : rrIntervals;
                setHeartRate(stableResult.bpm > 0 ? stableResult.bpm : '--');
                const evalResult = evaluateIrregularity(stableIntervals);
                const explanation = generateClinicalExplanation(classification_result || "UNKNOWN", isAnomaly, evalResult);
                setClinicalStatus(explanation);
                setTimeline(prev => [...prev, { index: timelineSeconds / 10, timeStr: formatTime(timelineSeconds), isAnomaly, classResult: classification_result || "UNKNOWN" }]);
            }
        }
        dataRef.current = { xIndex, currentPaths, peakBuffer, rrIntervals, timelineSeconds, currentRPeaks, recentSamples, frameRawSamples };
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
                        return { index: (seg as any).index, timeStr: formatTime((seg as any).index * 10), isAnomaly: !isNormal, classResult: classRes };
                    });
                    setTimeline(summaries);
                } else if (msg.type === 'live_data' || msg.type === 'segment_data') {
                    if (msg.device_id) setDeviceId(msg.device_id);
                    if (msg.session_id) { setSessionId(msg.session_id); lastSessionIdRef.current = msg.session_id; }
                    if (msg.data_payload) {
                        if (msg.type === 'segment_data') {
                            setViewingHistory(true);
                            dataRef.current.xIndex = TOTAL_POINTS;
                            dataRef.current.timelineSeconds = (msg.data_payload as any).segment_index * 10;
                            processDataChunk(msg.data_payload, msg.timestamp, msg.session_id || lastSessionIdRef.current);
                        } else if (msg.type === 'live_data' && !isViewingHistoryRef.current) {
                            processDataChunk(msg.data_payload, msg.timestamp, msg.session_id || lastSessionIdRef.current);
                        }
                    }
                } else if (msg.type === 'status') setIsRecording(false);
            };
            clientRef.current.onClose = () => setIsRecording(false);
        }
    }, [endpoint, processDataChunk]);

    const startStream = () => {
        if (isRecording) return;
        setIsRecording(true); setTimeline([]); setClinicalStatus(null); setHeartRate('--'); setRawClassification(null);
        dataRef.current = { xIndex: 0, currentPaths: { I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] }, peakBuffer: [], rrIntervals: [], timelineSeconds: 0, currentRPeaks: [], recentSamples: [], frameRawSamples: { ch1: [], ch2: [], ch3: [] } };
        ptRef.current.reset();
        visualDcBlockerRef.current.reset();
        mathDcBlockerRef.current.reset();
        lpIRef.current.reset(); lpIIRef.current.reset(); lpIIIRef.current.reset();
        bpIRef.current.reset(); bpIIRef.current.reset(); bpIIIRef.current.reset();
        mathLpIRef.current.reset(); mathLpIIRef.current.reset(); mathLpIIIRef.current.reset();
        mathBpIRef.current.reset(); mathBpIIRef.current.reset(); mathBpIIIRef.current.reset();
        setViewingHistory(false);
        initWebSocket(); clientRef.current?.connect();
    };

    const stopStream = () => { setIsRecording(false); clientRef.current?.disconnect(); setViewingHistory(false); };
    const fetchSummary = () => { initWebSocket(); clientRef.current?.connect(); };
    const fetchSegment = (index: number) => { 
        if (clientRef.current && clientRef.current.isConnected()) {
            clientRef.current.sendCommand({ command: "get_segment", index }); 
        } else {
            const sid = sessionId || lastSessionIdRef.current;
            if (sid) {
                fetchWithAuth(`/api/records/${sid}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.length > 0) {
                            // Filter payloads to only show one recording session (handles merged mockup files)
                            const targetSessionId = data[data.length - 1].session_id;
                            const filteredData = targetSessionId ? data.filter((p: any) => p.session_id === targetSessionId) : data;
                            const target = filteredData[index];
                            if (target) {
                                setViewingHistory(true);
                                dataRef.current.xIndex = 0;
                                dataRef.current.timelineSeconds = index * 10;
                                processDataChunk(target, target.created_at || new Date().toISOString(), sid);
                            }
                        }
                    }).catch(console.error);
            }
        }
    };

    useEffect(() => { return () => { clientRef.current?.disconnect(); }; }, []);

    return {
        isRecording, paths, rPeaks, heartRate, clinicalStatus, timeline,
        startStream, stopStream, fetchSummary, fetchSegment,
        system, network, prediction, stressTest, createdAt, receivedAt, deviceId, sessionId, rawClassification,
        isViewingHistory, resumeRealTimeStream
    };
};