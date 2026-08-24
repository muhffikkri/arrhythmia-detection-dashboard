import { useMemo } from 'react';
import type { ECGPaths } from '../../core/types/ecgTypes';
import { calculateEinthovenPoint } from '../../core/algorithms/einthoven';
import { DCBlocker } from '../../core/algorithms/dcBlocker';

export const useLazyEcgPaths = (samples: any[], ch2: any[], ch3: any[]): ECGPaths => {
    return useMemo(() => {
        const paths: ECGPaths = { I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] };
        if (!samples || samples.length === 0) return paths;

        let xIndex = 0;
        const TOTAL_POINTS = 2500;
        const X_STEP = 2000 / TOTAL_POINTS;
        const visualDcBlocker = new DCBlocker();

        for (let j = 0; j < samples.length; j++) {
            let finalI, finalII, finalIII;
            if (Array.isArray(samples[j])) {
                finalI = samples[j][0] || 0;
                finalII = samples[j][1] || 0;
                finalIII = samples[j][2] || 0;
            } else {
                finalI = samples[j] || 0;
                finalII = ch2[j] || 0;
                finalIII = ch3[j] || 0;
            }

            const visualCleaned = visualDcBlocker.process(finalI, finalII);
            finalI = visualCleaned.cleanI;
            finalII = visualCleaned.cleanII;
            finalIII = visualCleaned.cleanIII;

            const calculated = calculateEinthovenPoint(finalI, finalII);
            const currentX = Number((xIndex * X_STEP).toFixed(2));

            paths.I.push(`${currentX},${(240 - finalI * 80).toFixed(2)}`);
            paths.II.push(`${currentX},${(240 - finalII * 80).toFixed(2)}`);
            paths.III.push(`${currentX},${(240 - finalIII * 80).toFixed(2)}`);
            paths.aVR.push(`${currentX},${(240 - calculated.aVR * 80).toFixed(2)}`);
            paths.aVL.push(`${currentX},${(240 - calculated.aVL * 80).toFixed(2)}`);
            paths.aVF.push(`${currentX},${(240 - calculated.aVF * 80).toFixed(2)}`);
            paths.V1.push(`${currentX},240.00`);

            xIndex++;
        }
        return paths;
    }, [samples, ch2, ch3]);
};
