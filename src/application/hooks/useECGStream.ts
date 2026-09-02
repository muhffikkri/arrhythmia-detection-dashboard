/**
 * @fileoverview Modul Application Layer: useECGStream Hook
 * Mengorkestrasi aliran data EKG, BPM per frame penuh, dan sinkronisasi filter.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { ECGWebSocketClient } from "../../data/network/websocketClient";
import { evaluateIrregularity, generateClinicalExplanation } from "../../core/clinical/ruleBasedEngine";
import {
  applyConfiguredFiltersToFrame,
  buildCanvasPathsFromLeads,
  buildRPeakMarkersFromLeads,
  calculateFrameHeartRate,
  emptyFrameRawSamples,
  TOTAL_FRAME_SAMPLES,
  type FrameRawSamples,
  type StreamFilterConfig,
} from "../../core/algorithms/ecgFrameProcessor";

import type { ClinicalExplanation } from "../../core/clinical/ruleBasedEngine";
import type { ECGPaths, RPeakMarker, TimelineEvent, ServerMessage, ECGDataPayload, DeviceSystem, DeviceNetwork, DevicePrediction, DeviceStressTest } from "../../core/types/ecgTypes";
import { fetchWithAuth } from "../../config/api";

export type { StreamFilterConfig };

const TOTAL_POINTS = TOTAL_FRAME_SAMPLES;

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const cloneRaw = (raw: FrameRawSamples): FrameRawSamples => ({
  ch1: [...raw.ch1],
  ch2: [...raw.ch2],
  ch3: [...raw.ch3],
});

type LiveSnapshot = {
  xIndex: number;
  timelineSeconds: number;
  frameRawSamples: FrameRawSamples;
  paths: ECGPaths;
  rPeaks: RPeakMarker[];
  heartRate: number | string;
  clinicalStatus: ClinicalExplanation | null;
  rawClassification: string | null;
  prediction: DevicePrediction | null;
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

import { useRecordingStatus } from "./useRecordingStatus";

export const useECGStream = (endpoint: string, patientIdOrFilter: string | StreamFilterConfig, filterConfigArg: StreamFilterConfig = { baselineBlocker: true, hfDenoise: false, bandpass: false, zScoreNorm: false }): UseECGStreamReturn => {
  const patientId = typeof patientIdOrFilter === "string" ? patientIdOrFilter : localStorage.getItem("user_id") || "1";
  const filterConfig = typeof patientIdOrFilter === "string" ? filterConfigArg : patientIdOrFilter;
  const { isRecording, setIsRecording } = useRecordingStatus(patientId);
  const [paths, setPaths] = useState<ECGPaths>({ I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] });
  const [rPeaks, setRPeaks] = useState<RPeakMarker[]>([]);
  const [heartRate, setHeartRate] = useState<number | string>("--");
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
  const filterConfigRef = useRef(filterConfig);
  const [isViewingHistory, setIsViewingHistory] = useState<boolean>(false);
  const isViewingHistoryRef = useRef<boolean>(false);
  const historicalRawRef = useRef<FrameRawSamples | null>(null);
  const liveSnapshotRef = useRef<LiveSnapshot | null>(null);
  const lastSessionIdRef = useRef<string | null>(null);
  const bpmWorkerRef = useRef<Worker | null>(null);
  const bpmRequestIdRef = useRef(0);

  const liveRef = useRef({
    xIndex: 0,
    currentPaths: { I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] } as ECGPaths,
    timelineSeconds: 0,
    frameRawSamples: emptyFrameRawSamples() as FrameRawSamples,
  });

  const setViewingHistory = (val: boolean) => {
    isViewingHistoryRef.current = val;
    setIsViewingHistory(val);
  };

  const renderRawFrame = (raw: FrameRawSamples, config: StreamFilterConfig) => {
    const leads = applyConfiguredFiltersToFrame(raw, config);
    const nextPaths = buildCanvasPathsFromLeads(leads);
    const rPeakMarkers = buildRPeakMarkersFromLeads(leads);
    setPaths({ ...nextPaths });
    setRPeaks(rPeakMarkers);
    return { paths: nextPaths, rPeaks: rPeakMarkers };
  };

  const resumeRealTimeStream = useCallback(() => {
    historicalRawRef.current = null;
    setViewingHistory(false);
    const snap = liveSnapshotRef.current;
    if (snap) {
      liveRef.current = {
        xIndex: snap.xIndex,
        currentPaths: snap.paths,
        timelineSeconds: snap.timelineSeconds,
        frameRawSamples: cloneRaw(snap.frameRawSamples),
      };
      setPaths({ ...snap.paths });
      setRPeaks(snap.rPeaks);
      setHeartRate(snap.heartRate);
      setClinicalStatus(snap.clinicalStatus);
      setRawClassification(snap.rawClassification);
      setPrediction(snap.prediction);
    }
  }, []);

  const applyPayloadMeta = (payload: ECGDataPayload, timestamp?: string) => {
    const { classification_result, prediction_details, system: sysData, network: netData, stress_test } = payload;
    const classification = classification_result || prediction_details?.label || null;
    if (classification) setRawClassification(classification);
    if (prediction_details) setPrediction(prediction_details);
    if (sysData) setSystem(sysData);
    if (netData) setNetwork(netData);
    if (stress_test) setStressTest(stress_test);
    if (timestamp) {
      setCreatedAt(timestamp);
      setReceivedAt(new Date().toISOString());
    }
  };

  const calculateBpmInBackground = (raw: FrameRawSamples, config: StreamFilterConfig, onResult: (bpm: number, rrIntervals: number[]) => void) => {
    const worker = bpmWorkerRef.current;
    if (!worker) {
      const result = calculateFrameHeartRate(raw, config);
      onResult(result.bpm, result.rrIntervals);
      return;
    }

    const id = ++bpmRequestIdRef.current;
    worker.onmessage = (event: MessageEvent<{ id: number; bpm: number; rrIntervals: number[] }>) => {
      if (event.data.id === id) onResult(event.data.bpm, event.data.rrIntervals);
    };
    worker.postMessage({ id, raw: cloneRaw(raw), config });
  };

  const showHistoricalSegment = (payload: ECGDataPayload, timestamp?: string) => {
    setViewingHistory(true);
    applyPayloadMeta(payload, timestamp);
    const raw: FrameRawSamples = {
      ch1: [...(payload.raw?.ch1 || [])],
      ch2: [...(payload.raw?.ch2 || [])],
      ch3: [...(payload.raw?.ch3 || [])],
    };
    historicalRawRef.current = raw;
    const rendered = renderRawFrame(raw, filterConfigRef.current);
    liveRef.current.currentPaths = rendered.paths;
    calculateBpmInBackground(raw, filterConfigRef.current, (bpm, rrIntervals) => {
      setHeartRate(bpm > 0 ? bpm : "--");
      const classification = payload.classification_result || payload.prediction_details?.label || "UNKNOWN";
      const isNormal = classification.toUpperCase() === "NORMAL" || classification.toUpperCase() === "NORM";
      setClinicalStatus(generateClinicalExplanation(classification, !isNormal, evaluateIrregularity(rrIntervals)));
    });
  };

  useEffect(() => {
    filterConfigRef.current = filterConfig;
    const raw = isViewingHistoryRef.current && historicalRawRef.current ? historicalRawRef.current : liveRef.current.frameRawSamples;
    if (raw.ch1.length === 0) return;
    const rendered = renderRawFrame(raw, filterConfig);
    if (!isViewingHistoryRef.current) {
      liveRef.current.currentPaths = rendered.paths;
    }
    if (raw.ch1.length >= TOTAL_POINTS) {
      const stableResult = calculateFrameHeartRate(raw, filterConfig);
      setHeartRate(stableResult.bpm > 0 ? stableResult.bpm : "--");
    }
  }, [filterConfig]);

  const processLiveChunk = useCallback((payload: ECGDataPayload, timestamp?: string) => {
    applyPayloadMeta(payload, timestamp);
    let { xIndex, timelineSeconds, frameRawSamples } = liveRef.current;
    const ch1 = payload.raw.ch1;
    const ch2 = payload.raw.ch2;
    const ch3 = payload.raw.ch3;
    const config = filterConfigRef.current;
    const classification_result = payload.classification_result;
    const isNormal = classification_result?.toUpperCase() === "NORMAL" || classification_result?.toUpperCase() === "NORM";

    for (let i = 0; i < ch1.length; i++) {
      if (xIndex >= TOTAL_POINTS) {
        xIndex = 0;
        timelineSeconds += 10;
        frameRawSamples = emptyFrameRawSamples();
      }

      frameRawSamples.ch1.push(ch1[i]);
      frameRawSamples.ch2.push(ch2[i]);
      frameRawSamples.ch3.push(ch3.length > i ? ch3[i] : ch2[i] - ch1[i]);
      xIndex++;

      if (xIndex === TOTAL_POINTS) {
        const completedRaw = cloneRaw(frameRawSamples);
        calculateBpmInBackground(completedRaw, config, (bpm, rrIntervals) => {
          setHeartRate(bpm > 0 ? bpm : "--");
          const evalResult = evaluateIrregularity(rrIntervals);
          const explanation = generateClinicalExplanation(classification_result || "UNKNOWN", !isNormal, evalResult);
          setClinicalStatus(explanation);
          liveSnapshotRef.current = {
            ...(liveSnapshotRef.current as LiveSnapshot),
            clinicalStatus: explanation,
            heartRate: bpm > 0 ? bpm : "--",
          };
        });
        setTimeline((prev) => [
          ...prev,
          {
            index: timelineSeconds / 10,
            timeStr: formatTime(timelineSeconds),
            isAnomaly: !isNormal,
            classResult: classification_result || "UNKNOWN",
          },
        ]);
      }
    }

    const rendered = renderRawFrame(frameRawSamples, config);
    liveRef.current = { xIndex, currentPaths: rendered.paths, timelineSeconds, frameRawSamples };
    const completedBpm = liveSnapshotRef.current?.heartRate ?? "--";
    liveSnapshotRef.current = {
      xIndex,
      timelineSeconds,
      frameRawSamples: cloneRaw(frameRawSamples),
      paths: rendered.paths,
      rPeaks: rendered.rPeaks,
      heartRate: completedBpm,
      clinicalStatus: liveSnapshotRef.current?.clinicalStatus ?? null,
      rawClassification: classification_result || liveSnapshotRef.current?.rawClassification || null,
      prediction: payload.prediction_details || liveSnapshotRef.current?.prediction || null,
    };
  }, []);

  const processLiveChunkRef = useRef(processLiveChunk);
  processLiveChunkRef.current = processLiveChunk;
  const showHistoricalSegmentRef = useRef(showHistoricalSegment);
  showHistoricalSegmentRef.current = showHistoricalSegment;

  const initWebSocket = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new ECGWebSocketClient(endpoint);
      clientRef.current.onMessage = (msg: ServerMessage) => {
        if (msg.type === "summary" && msg.data) {
          const summaries = msg.data.map((seg) => {
            const classRes = (seg as any).class_result;
            const isNormal = classRes?.toUpperCase() === "NORMAL" || classRes?.toUpperCase() === "NORM";
            return { index: (seg as any).index, timeStr: formatTime((seg as any).index * 10), isAnomaly: !isNormal, classResult: classRes };
          });
          setTimeline(summaries);
        } else if (msg.type === "live_data" || msg.type === "segment_data") {
          if (msg.device_id) setDeviceId(msg.device_id);
          if (msg.session_id) {
            setSessionId(msg.session_id);
            lastSessionIdRef.current = msg.session_id;
          }
          if (msg.data_payload) {
            if (msg.type === "segment_data") {
              showHistoricalSegmentRef.current(msg.data_payload, msg.timestamp);
            } else if (msg.type === "live_data" && !isViewingHistoryRef.current) {
              processLiveChunkRef.current(msg.data_payload, msg.timestamp);
            }
          }
        } else if (msg.type === "status") setIsRecording(false);
      };
      clientRef.current.onClose = () => setIsRecording(false);
    }
  }, [endpoint, processLiveChunk]);

  useEffect(() => {
    if (isRecording) {
      if (!clientRef.current?.isConnected()) {
        setTimeline([]);
        setClinicalStatus(null);
        setHeartRate("--");
        setRawClassification(null);
        liveRef.current = { xIndex: 0, currentPaths: { I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] }, timelineSeconds: 0, frameRawSamples: emptyFrameRawSamples() };
        liveSnapshotRef.current = null;
        historicalRawRef.current = null;
        setViewingHistory(false);
        initWebSocket();
        clientRef.current?.connect();
      }
    } else {
      clientRef.current?.disconnect();
      setViewingHistory(false);
      historicalRawRef.current = null;
    }
  }, [isRecording, initWebSocket]);

  const startStream = () => {
    if (isRecording) return;
    setIsRecording(true);
  };

  const stopStream = () => {
    setIsRecording(false);
  };

  const fetchSummary = () => {
    initWebSocket();
    clientRef.current?.connect();
  };

  const fetchSegment = (index: number) => {
    if (clientRef.current && clientRef.current.isConnected()) {
      clientRef.current.sendCommand({ command: "get_segment", index });
    } else {
      const sid = sessionId || lastSessionIdRef.current;
      if (sid) {
        fetchWithAuth(`/api/records/${sid}`)
          .then((res) => res.json())
          .then((data) => {
            if (data && data.length > 0) {
              const targetSessionId = data[data.length - 1].session_id;
              const filteredData = targetSessionId ? data.filter((p: any) => p.session_id === targetSessionId) : data;
              const target = filteredData[index];
              if (target) {
                showHistoricalSegment(target, target.created_at || new Date().toISOString());
              }
            }
          })
          .catch(console.error);
      }
    }
  };

  useEffect(() => {
    if (typeof Worker !== "undefined") {
      bpmWorkerRef.current = new Worker(new URL("../../workers/bpm.worker.ts", import.meta.url), { type: "module" });
    }
    return () => {
      clientRef.current?.disconnect();
      bpmWorkerRef.current?.terminate();
      bpmWorkerRef.current = null;
    };
  }, []);

  return {
    isRecording,
    paths,
    rPeaks,
    heartRate,
    clinicalStatus,
    timeline,
    startStream,
    stopStream,
    fetchSummary,
    fetchSegment,
    system,
    network,
    prediction,
    stressTest,
    createdAt,
    receivedAt,
    deviceId,
    sessionId,
    rawClassification,
    isViewingHistory,
    resumeRealTimeStream,
  };
};
