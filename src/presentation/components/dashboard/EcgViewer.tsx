import React from 'react';
import { ECGCanvas } from '../canvas/ECGCanvas';
import { useLazyEcgPaths } from '../../../application/hooks/useLazyEcgPaths';

interface EcgViewerProps {
    segment: any;
    speed?: 25 | 50;
    timeOffset?: number;
    classResult?: string;
}

export const EcgViewer: React.FC<EcgViewerProps> = ({ segment, speed = 25, timeOffset = 0, classResult }) => {
    // Determine raw samples
    const samples = segment?.payload?.ecg?.samples || segment?.payload?.raw?.ch1 || [];
    const ch2 = segment?.payload?.raw?.ch2 || [];
    const ch3 = segment?.payload?.raw?.ch3 || [];

    // Calculate paths lazily ONLY for the current segment
    const paths = useLazyEcgPaths(samples, ch2, ch3);

    return (
        <ECGCanvas 
            paths={paths} 
            rPeaks={segment?.rPeaks || []} 
            speed={speed} 
            isAnomaly={segment?.isAnomaly || false}
            classResult={classResult} 
            timeOffset={timeOffset} 
        />
    );
};
