/**
 * @fileoverview Core Layer: ECG Pipeline
 * Encapsulates the signal processing mathematics and algorithms (DC blocking,
 * Einthoven transformations, Pan-Tompkins peak detection) separated from React hooks.
 */

import { calculateEinthovenPoint } from './einthoven';
import { PanTompkins } from './panTompkins';
import { DCBlocker } from './dcBlocker';
import { calculateSingleRRInterval, calculateRRMetrics, calculateBatchRRIntervals, calculateHeartRate } from './peakToPeak';
import type { ECGPaths, RPeakMarker } from '../types/ecgTypes';

export interface PipelineState {
  xIndex: number;
  currentPaths: ECGPaths;
  peakBuffer: { x: number; index: number }[];
  rrIntervals: number[];
  timelineSeconds: number;
  currentRPeaks: RPeakMarker[];
  recentSamples: Array<{
    xIndex: number;
    x: number;
    yI: number;
    yII: number;
    yIII: number;
    yaVR: number;
    yaVL: number;
    yaVF: number;
    yV1: number;
  }>;
}

export interface PipelineResult {
  state: PipelineState;
  frameCompleted: boolean;
}

export const processAllLeadEcgData = (
  rawChunk: { ch1: number[]; ch2: number[]; ch3?: number[] },
  samplingRate: number = 250
): { bpm: number } => {
  if (!rawChunk.ch1 || rawChunk.ch1.length === 0) return { bpm: 0 };
  const pt = new PanTompkins(samplingRate);
  const dcBlocker = new DCBlocker();
  const peakIndices: number[] = [];
  
  for (let i = 0; i < rawChunk.ch1.length; i++) {
    const rawI = rawChunk.ch1[i];
    const rawII = rawChunk.ch2 && rawChunk.ch2.length > i ? rawChunk.ch2[i] : rawI;
    const cleaned = dcBlocker.process(rawI, rawII);
    
    if (pt.detectRealTime(cleaned.cleanI, i)) {
      peakIndices.push(i);
    }
  }
  
  const rrIntervals = calculateBatchRRIntervals(peakIndices, samplingRate);
  const bpm = calculateHeartRate(rrIntervals);
  
  return { bpm };
};

export const processECGSamples = (
  rawChunk: { ch1: number[]; ch2: number[]; ch3: number[] },
  state: PipelineState,
  pt: PanTompkins,
  dcBlocker: DCBlocker,
  isFilterOn: boolean,
  TOTAL_POINTS: number,
  X_STEP: number
): PipelineResult => {
  let { xIndex, currentPaths, peakBuffer, rrIntervals, timelineSeconds, currentRPeaks, recentSamples } = state;
  const ch1 = rawChunk.ch1;
  const ch2 = rawChunk.ch2;

  let frameCompleted = false;

  for (let i = 0; i < ch1.length; i++) {
    if (xIndex >= TOTAL_POINTS) {
      xIndex = 0;
      timelineSeconds += 10;
      currentPaths = { I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] };
      peakBuffer = [];
      rrIntervals = [];
      currentRPeaks = [];
      recentSamples = [];
      pt.reset();
    }

    const rawI = ch1[i];
    const rawII = ch2[i];

    let finalI = rawI;
    let finalII = rawII;
    let finalIII = rawII - rawI;

    if (isFilterOn) {
      const cleaned = dcBlocker.process(rawI, rawII);
      finalI = cleaned.cleanI;
      finalII = cleaned.cleanII;
      finalIII = cleaned.cleanIII;
    }

    const calculated = calculateEinthovenPoint(finalI, finalII);

    const currentX = Number((xIndex * X_STEP).toFixed(2));

    // Standard medical scale mapping: 1mV = 80px, center line = 240px
    const yI = 240 - finalI * 80;
    const yII = 240 - finalII * 80;
    const yIII = 240 - finalIII * 80;
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

    const isPeak = pt.detectRealTime(finalII, xIndex);

    if (isPeak && recentSamples.length > 0) {
      let truePeak = recentSamples[0];
      for (let j = 1; j < recentSamples.length; j++) {
        if (recentSamples[j].yII < truePeak.yII) {
          truePeak = recentSamples[j];
        }
      }

      const marker: RPeakMarker = {
        x: truePeak.x,
        y: truePeak.yII,
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
        const secDist = calculateSingleRRInterval(prev.index, truePeak.xIndex, 250);
        const metrics = calculateRRMetrics(secDist);
        marker.bpm = metrics.bpm;
        marker.boxesText = metrics.boxesText;

        rrIntervals.push(secDist);
        marker.rrText = `${secDist}s`;
        marker.prevX = prev.x;
      }

      currentRPeaks.push(marker);
      peakBuffer.push({ x: truePeak.x, index: truePeak.xIndex });
    }
    xIndex++;

    if (xIndex === TOTAL_POINTS) {
      frameCompleted = true;
    }
  }

  return {
    state: { xIndex, currentPaths, peakBuffer, rrIntervals, timelineSeconds, currentRPeaks, recentSamples },
    frameCompleted
  };
};
