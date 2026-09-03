import { useMemo } from "react";
import type { ECGPaths } from "../../core/types/ecgTypes";
import { calculateEinthovenPoint } from "../../core/algorithms/einthoven";
import { applyConfiguredFiltersToFrame, type StreamFilterConfig } from "../../core/algorithms/ecgFrameProcessor";
import { type FilterStates, DEFAULT_FILTERS } from "../../core/algorithms/ecgFilters";

export const useLazyEcgPaths = (
  samples: any[],
  ch2: any[],
  ch3: any[],
  gain: number = 10, // mm/mV (default 10)
  paperSpeed: number = 25, // mm/s (default 25)
  isFilterOn: boolean = true,
  activeFilters: FilterStates = DEFAULT_FILTERS,
): ECGPaths => {
  return useMemo(() => {
    const paths: ECGPaths = { I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] };
    if (!samples || samples.length === 0) return paths;

    const rawI: number[] = [];
    const rawII: number[] = [];
    const rawIII: number[] = [];
    const toFiniteNumber = (value: unknown): number => {
      const numberValue = Number(value);
      return Number.isFinite(numberValue) ? numberValue : 0;
    };

    for (let j = 0; j < samples.length; j++) {
      let valI = 0;
      let valII = 0;
      let valIII = 0;
      if (Array.isArray(samples[j])) {
        valI = toFiniteNumber(samples[j][0]);
        valII = toFiniteNumber(samples[j][1]);
        valIII = toFiniteNumber(ch3[j] ?? samples[j][2]);
      } else {
        valI = toFiniteNumber(samples[j]);
        valII = toFiniteNumber(ch2[j]);
        valIII = toFiniteNumber(ch3[j]);
      }
      rawI.push(valI);
      rawII.push(valII);
      rawIII.push(valIII);
    }

    const config: StreamFilterConfig = {
      baselineBlocker: isFilterOn && activeFilters.baseline,
      hfDenoise: isFilterOn && activeFilters.denoise,
      bandpass: isFilterOn && activeFilters.bandpass,
      zScoreNorm: isFilterOn && activeFilters.normalization,
    };
    const filtered = applyConfiguredFiltersToFrame({ ch1: rawI, ch2: rawII, ch3: rawIII }, config);

    const calPulseWidth = Number((0.4 * paperSpeed * 8).toFixed(2));
    const calPulseRise = Number((0.1 * paperSpeed * 8).toFixed(2));
    const calPulseFall = Number((0.3 * paperSpeed * 8).toFixed(2));
    const calPulseHeight = Number((240 - 1.0 * (gain * 8)).toFixed(2));

    const calPulsePath = [`0,240.00`, `${calPulseRise},240.00`, `${calPulseRise},${calPulseHeight}`, `${calPulseFall},${calPulseHeight}`, `${calPulseFall},240.00`, `${calPulseWidth},240.00`];

    paths.I = [...calPulsePath];

    const remainingWidth = 10 * paperSpeed * 8 - calPulseWidth;
    const X_STEP = remainingWidth / samples.length;

    for (let j = 0; j < samples.length; j++) {
      const finalI = filtered.I[j];
      const finalII = filtered.II[j];
      const finalIII = filtered.III[j];
      const calculated = calculateEinthovenPoint(finalI, finalII);
      const currentX = Number((calPulseWidth + j * X_STEP).toFixed(2));
      const yMult = gain * 8; // 1mV = gain * 8 px

      paths.I.push(`${currentX},${(240 - finalI * yMult).toFixed(2)}`);
      paths.II.push(`${currentX},${(240 - finalII * yMult).toFixed(2)}`);
      paths.III.push(`${currentX},${(240 - finalIII * yMult).toFixed(2)}`);
      paths.aVR.push(`${currentX},${(240 - calculated.aVR * yMult).toFixed(2)}`);
      paths.aVL.push(`${currentX},${(240 - calculated.aVL * yMult).toFixed(2)}`);
      paths.aVF.push(`${currentX},${(240 - calculated.aVF * yMult).toFixed(2)}`);
      paths.V1.push(`${currentX},240.00`);
    }
    return paths;
  }, [samples, ch2, ch3, gain, paperSpeed, isFilterOn, activeFilters]);
};
