/**
 * Pipeline frame EKG: filter opsional, pemetaan kanvas, dan BPM dari seluruh segmen.
 * Jika semua filter mati, Lead I/II/III dikembalikan apa adanya (tanpa DC/MA/IIR/Z-Score).
 */

import { DCBlocker } from "./dcBlocker";
import { MovingAverageFilter, IIRFilter } from "./ecgFilters";
import { applyZScoreAndClip } from "./zScore";
import { PanTompkins } from "./panTompkins";
import { calculateBatchRRIntervals, calculateHeartRate, calculateRRMetrics, calculateSingleRRInterval } from "./peakToPeak";
import { calculateEinthovenPoint } from "./einthoven";
import type { ECGPaths, RPeakMarker } from "../types/ecgTypes";

export interface StreamFilterConfig {
  baselineBlocker: boolean;
  hfDenoise: boolean;
  bandpass: boolean;
  zScoreNorm: boolean;
}

export const FILTERS_ALL_OFF: StreamFilterConfig = {
  baselineBlocker: false,
  hfDenoise: false,
  bandpass: false,
  zScoreNorm: false,
};

export const FILTERS_CLINICAL_DEFAULT: StreamFilterConfig = {
  baselineBlocker: true,
  hfDenoise: true,
  bandpass: true,
  zScoreNorm: false,
};

export const TOTAL_FRAME_SAMPLES = 2500;
export const REFERENCE_PAPER_SPEED = 25;
export const CANVAS_CENTER_Y = 240;
export const MV_TO_PX = 80;
export const CALIBRATION_POINT_COUNT = 6;

export type FrameRawSamples = {
  ch1: number[];
  ch2: number[];
  ch3: number[];
};

export const emptyFrameRawSamples = (): FrameRawSamples => ({ ch1: [], ch2: [], ch3: [] });

export const isFilterPipelineActive = (config: StreamFilterConfig): boolean => config.baselineBlocker || config.hfDenoise || config.bandpass || config.zScoreNorm;

export const mapMillivoltToCanvasY = (mv: number): number => CANVAS_CENTER_Y - mv * MV_TO_PX;

export const canvasXStep = (totalPoints: number = TOTAL_FRAME_SAMPLES): number => 2000 / totalPoints;

export const parsePathPoint = (point: string): { x: number; y: number } => {
  const [x, y] = point.split(",").map(Number);
  return { x, y };
};

const toNumber = (value: unknown): number => {
  if (Array.isArray(value)) return toNumber(value[0]);
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const extractRawFromPayload = (payload: any): FrameRawSamples => {
  const raw = payload?.raw || {};
  const fallbackSamples = Array.isArray(payload?.ecg?.samples) ? payload.ecg.samples : [];
  const ch1 = Array.isArray(raw.ch1) && raw.ch1.length > 0 ? raw.ch1.map(toNumber) : fallbackSamples.map((sample: unknown) => toNumber(sample));
  const ch2 = Array.isArray(raw.ch2) && raw.ch2.length > 0 ? raw.ch2.map(toNumber) : fallbackSamples.map((sample: unknown) => (Array.isArray(sample) ? toNumber(sample[1]) : toNumber(sample)));
  const ch3 = Array.isArray(raw.ch3) && raw.ch3.length > 0 ? raw.ch3.map(toNumber) : fallbackSamples.map((sample: unknown) => (Array.isArray(sample) ? toNumber(sample[2]) : 0));
  return { ch1, ch2, ch3 };
};

export const applyConfiguredFiltersToFrame = (raw: FrameRawSamples, config: StreamFilterConfig): { I: number[]; II: number[]; III: number[] } => {
  const n = raw.ch1.length;
  const I = new Array<number>(n);
  const II = new Array<number>(n);
  const III = new Array<number>(n);

  const dcBlocker = new DCBlocker();
  const lpI = new MovingAverageFilter(6);
  const lpII = new MovingAverageFilter(6);
  const lpIII = new MovingAverageFilter(6);
  const bpI = new IIRFilter();
  const bpII = new IIRFilter();
  const bpIII = new IIRFilter();

  for (let i = 0; i < n; i++) {
    let signalI = raw.ch1[i];
    let signalII = raw.ch2.length > i ? raw.ch2[i] : signalI;
    let signalIII = raw.ch3.length > i ? raw.ch3[i] : signalII - signalI;

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

    I[i] = signalI;
    II[i] = signalII;
    III[i] = signalIII;
  }

  if (config.zScoreNorm) {
    return {
      I: applyZScoreAndClip(I),
      II: applyZScoreAndClip(II),
      III: applyZScoreAndClip(III),
    };
  }

  return { I, II, III };
};

export const buildCanvasPathsFromLeads = (leads: { I: number[]; II: number[]; III: number[] }, totalPoints: number = TOTAL_FRAME_SAMPLES): ECGPaths => {
  const xStep = canvasXStep(totalPoints);
  const paths: ECGPaths = { I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] };

  for (let i = 0; i < leads.I.length; i++) {
    const currentX = Number((i * xStep).toFixed(2));
    const calculated = calculateEinthovenPoint(leads.I[i], leads.II[i]);
    paths.I.push(`${currentX},${mapMillivoltToCanvasY(leads.I[i]).toFixed(2)}`);
    paths.II.push(`${currentX},${mapMillivoltToCanvasY(leads.II[i]).toFixed(2)}`);
    paths.III.push(`${currentX},${mapMillivoltToCanvasY(leads.III[i]).toFixed(2)}`);
    paths.aVR.push(`${currentX},${mapMillivoltToCanvasY(calculated.aVR).toFixed(2)}`);
    paths.aVL.push(`${currentX},${mapMillivoltToCanvasY(calculated.aVL).toFixed(2)}`);
    paths.aVF.push(`${currentX},${mapMillivoltToCanvasY(calculated.aVF).toFixed(2)}`);
    paths.V1.push(`${currentX},${mapMillivoltToCanvasY(0).toFixed(2)}`);
  }

  return paths;
};

export const detectPeakIndices = (leadII: number[], samplingRate: number = 250): number[] => {
  const detector = new PanTompkins(samplingRate);
  const peakIndices: number[] = [];
  for (let i = 0; i < leadII.length; i++) {
    if (detector.detectRealTime(leadII[i], i)) {
      peakIndices.push(i);
    }
  }
  return peakIndices;
};

export const buildRPeakMarkersFromLeads = (leads: { I: number[]; II: number[]; III: number[] }, samplingRate: number = 250, totalPoints: number = TOTAL_FRAME_SAMPLES): RPeakMarker[] => {
  const peakIndices = detectPeakIndices(leads.II, samplingRate);
  const xStep = canvasXStep(totalPoints);
  const markers: RPeakMarker[] = [];

  for (let p = 0; p < peakIndices.length; p++) {
    const idx = peakIndices[p];
    const calculated = calculateEinthovenPoint(leads.I[idx] ?? 0, leads.II[idx] ?? 0);
    const x = Number((idx * xStep).toFixed(2));
    const marker: RPeakMarker = {
      x,
      y: mapMillivoltToCanvasY(leads.II[idx]),
      yI: mapMillivoltToCanvasY(leads.I[idx] ?? 0),
      yII: mapMillivoltToCanvasY(leads.II[idx]),
      yIII: mapMillivoltToCanvasY(leads.III[idx] ?? 0),
      yaVR: mapMillivoltToCanvasY(calculated.aVR),
      yaVL: mapMillivoltToCanvasY(calculated.aVL),
      yaVF: mapMillivoltToCanvasY(calculated.aVF),
      yV1: mapMillivoltToCanvasY(0),
    };

    if (p > 0) {
      const prevIdx = peakIndices[p - 1];
      const secDist = calculateSingleRRInterval(prevIdx, idx, samplingRate);
      const metrics = calculateRRMetrics(secDist);
      marker.bpm = metrics.bpm;
      marker.boxesText = metrics.boxesText;
      marker.rrText = `${secDist}s`;
      marker.prevX = Number((prevIdx * xStep).toFixed(2));
    }

    markers.push(marker);
  }

  return markers;
};

export const calculateFrameHeartRate = (raw: FrameRawSamples, config: StreamFilterConfig, samplingRate: number = 250): { bpm: number; rrIntervals: number[] } => {
  if (raw.ch1.length === 0 || raw.ch2.length === 0) {
    return { bpm: 0, rrIntervals: [] };
  }

  const filtered = applyConfiguredFiltersToFrame(raw, config);
  const peakIndices = detectPeakIndices(filtered.II, samplingRate);
  const rrIntervals = calculateBatchRRIntervals(peakIndices, samplingRate);
  return { bpm: calculateHeartRate(rrIntervals), rrIntervals };
};

export const renderFrameFromRaw = (raw: FrameRawSamples, config: StreamFilterConfig, totalPoints: number = TOTAL_FRAME_SAMPLES): { paths: ECGPaths; rPeaks: RPeakMarker[]; leads: { I: number[]; II: number[]; III: number[] } } => {
  const leads = applyConfiguredFiltersToFrame(raw, config);
  return {
    leads,
    paths: buildCanvasPathsFromLeads(leads, totalPoints),
    rPeaks: buildRPeakMarkersFromLeads(leads, 250, totalPoints),
  };
};
