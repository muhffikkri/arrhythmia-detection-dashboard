import type { FrameRawSamples } from '../core/algorithms/ecgFrameProcessor';
import { TOTAL_FRAME_SAMPLES } from '../core/algorithms/ecgFrameProcessor';

/** Sinyal QRS sintetis ~75 BPM pada 250 Hz (interval 200 sampel). */
export function makeQrsFrame(bpm = 75, samples = TOTAL_FRAME_SAMPLES, fs = 250): FrameRawSamples {
    const interval = Math.round((fs * 60) / bpm);
    const ch1: number[] = [];
    const ch2: number[] = [];
    const ch3: number[] = [];

    for (let i = 0; i < samples; i++) {
        const phase = i % interval;
        let v = 0.05 * Math.sin((2 * Math.PI * i) / fs);
        if (phase === 2) v += 1.0;
        if (phase === 3) v += 3.2;
        if (phase === 4) v += 0.35;
        ch1.push(v * 0.7);
        ch2.push(v);
        ch3.push(v * 0.45);
    }

    return { ch1, ch2, ch3 };
}

export function makeLivePayload(raw: FrameRawSamples, classification = 'NORM') {
    return {
        type: 'live_data' as const,
        device_id: 'ECG-TEST-01',
        session_id: 'session-test-1',
        timestamp: new Date().toISOString(),
        data_payload: {
            raw: {
                time: raw.ch1.map((_, i) => i / 250),
                ch1: raw.ch1,
                ch2: raw.ch2,
                ch3: raw.ch3,
            },
            classification_result: classification,
            anomaly_indices: [],
            prediction_details: {
                status: 'ok',
                label: classification,
                confidence_percent: 98,
            },
        },
    };
}
