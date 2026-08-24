import { useMemo } from 'react';
import type { ECGPaths } from '../../core/types/ecgTypes';
import { calculateEinthovenPoint } from '../../core/algorithms/einthoven';
import { DCBlocker } from '../../core/algorithms/dcBlocker';
import { MovingAverageFilter, IIRFilter, type FilterStates, DEFAULT_FILTERS } from '../../core/algorithms/ecgFilters';

export const useLazyEcgPaths = (
    samples: any[], 
    ch2: any[], 
    ch3: any[],
    gain: number = 10, // mm/mV (default 10)
    paperSpeed: number = 25, // mm/s (default 25)
    isFilterOn: boolean = true,
    activeFilters: FilterStates = DEFAULT_FILTERS
): ECGPaths => {
    return useMemo(() => {
        const paths: ECGPaths = { I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] };
        if (!samples || samples.length === 0) return paths;

        const dcBlocker = new DCBlocker();
        const lpI = new MovingAverageFilter(5);
        const lpII = new MovingAverageFilter(5);
        
        const bpI = new IIRFilter();
        const bpII = new IIRFilter();

        // 1. Extract and sanitize raw signals
        const rawI: number[] = [];
        const rawII: number[] = [];

        for (let j = 0; j < samples.length; j++) {
            let valI = 0, valII = 0;
            if (Array.isArray(samples[j])) {
                valI = samples[j][0] || 0;
                valII = samples[j][1] || 0;
            } else {
                valI = samples[j] || 0;
                valII = ch2[j] || 0;
            }
            
            // Sanitization (Clean NaNs/Infs)
            const cleanValI = isNaN(valI) || !isFinite(valI) ? 0.0 : valI;
            const cleanValII = isNaN(valII) || !isFinite(valII) ? 0.0 : valII;
            
            rawI.push(cleanValI);
            rawII.push(cleanValII);
        }

        // 2. Apply filters (if isFilterOn is true)
        let filteredI = [...rawI];
        let filteredII = [...rawII];

        if (isFilterOn) {
            // Apply Baseline Filter
            if (activeFilters.baseline) {
                dcBlocker.reset();
                filteredI = filteredI.map(x => dcBlocker.process(x, 0).cleanI);
                
                dcBlocker.reset();
                filteredII = filteredII.map(x => dcBlocker.process(0, x).cleanII);
            }

            // Apply Denoise (Moving Average)
            if (activeFilters.denoise) {
                lpI.reset();
                filteredI = filteredI.map(x => lpI.process(x));
                
                lpII.reset();
                filteredII = filteredII.map(x => lpII.process(x));
            }

            // Apply Bandpass IIR
            if (activeFilters.bandpass) {
                bpI.reset();
                filteredI = filteredI.map(x => bpI.process(x));
                
                bpII.reset();
                filteredII = filteredII.map(x => bpII.process(x));
            }

            // Apply Z-Score Normalization
            if (activeFilters.normalization) {
                const norm = (arr: number[]) => {
                    if (arr.length === 0) return arr;
                    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
                    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
                    const std = Math.sqrt(variance);
                    const eps = 1e-6;
                    return arr.map(x => (x - mean) / (std + eps));
                };
                filteredI = norm(filteredI);
                filteredII = norm(filteredII);
            }
        }

        // 3. Calibration Pulse Prefix
        const calPulseWidth = Number((0.4 * paperSpeed * 8).toFixed(2));
        const calPulseRise = Number((0.1 * paperSpeed * 8).toFixed(2));
        const calPulseFall = Number((0.3 * paperSpeed * 8).toFixed(2));
        const calPulseHeight = Number((240 - 1.0 * (gain * 8)).toFixed(2));

        const calPulsePath = [
            `0,240.00`,
            `${calPulseRise},240.00`,
            `${calPulseRise},${calPulseHeight}`,
            `${calPulseFall},${calPulseHeight}`,
            `${calPulseFall},240.00`,
            `${calPulseWidth},240.00`
        ];

        paths.I = [...calPulsePath];
        paths.II = [...calPulsePath];
        paths.III = [...calPulsePath];
        paths.aVR = [...calPulsePath];
        paths.aVL = [...calPulsePath];
        paths.aVF = [...calPulsePath];
        paths.V1 = [...calPulsePath];

        const remainingWidth = 10 * paperSpeed * 8 - calPulseWidth;
        const X_STEP = remainingWidth / samples.length;

        // 4. Map Filtered signals to SVG coordinates
        for (let j = 0; j < samples.length; j++) {
            const finalI = filteredI[j];
            const finalII = filteredII[j];

            const calculated = calculateEinthovenPoint(finalI, finalII);
            const currentX = Number((calPulseWidth + j * X_STEP).toFixed(2));
            const yMult = gain * 8; // 1mV = gain * 8 px

            paths.I.push(`${currentX},${(240 - finalI * yMult).toFixed(2)}`);
            paths.II.push(`${currentX},${(240 - finalII * yMult).toFixed(2)}`);
            paths.III.push(`${currentX},${(240 - calculated.leadIII * yMult).toFixed(2)}`);
            paths.aVR.push(`${currentX},${(240 - calculated.aVR * yMult).toFixed(2)}`);
            paths.aVL.push(`${currentX},${(240 - calculated.aVL * yMult).toFixed(2)}`);
            paths.aVF.push(`${currentX},${(240 - calculated.aVF * yMult).toFixed(2)}`);
            paths.V1.push(`${currentX},240.00`);
        }
        return paths;
    }, [samples, ch2, ch3, gain, paperSpeed, isFilterOn, activeFilters]);
};
