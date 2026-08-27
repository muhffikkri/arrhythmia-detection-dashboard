import { describe, it, expect } from 'vitest';
import {
    FILTERS_ALL_OFF,
    FILTERS_CLINICAL_DEFAULT,
    applyConfiguredFiltersToFrame,
    calculateFrameHeartRate,
    mapMillivoltToCanvasY,
    parsePathPoint,
    renderFrameFromRaw,
} from '../core/algorithms/ecgFrameProcessor';
import { makeQrsFrame } from './ecgTestFixtures';

describe('ecgFrameProcessor unit', () => {
    it('tidak mengubah Lead I/II/III ketika semua filter mati', () => {
        const raw = {
            ch1: [0.2, 0.4, 1.1],
            ch2: [0.3, 0.5, 1.4],
            ch3: [0.1, 0.2, 0.3],
        };

        const filtered = applyConfiguredFiltersToFrame(raw, FILTERS_ALL_OFF);
        expect(filtered.I).toEqual(raw.ch1);
        expect(filtered.II).toEqual(raw.ch2);
        expect(filtered.III).toEqual(raw.ch3);

        const { paths } = renderFrameFromRaw(raw, FILTERS_ALL_OFF);
        raw.ch1.forEach((mv, i) => {
            expect(parsePathPoint(paths.I[i]).y).toBeCloseTo(Number(mapMillivoltToCanvasY(mv).toFixed(2)));
        });
        raw.ch2.forEach((mv, i) => {
            expect(parsePathPoint(paths.II[i]).y).toBeCloseTo(Number(mapMillivoltToCanvasY(mv).toFixed(2)));
        });
        raw.ch3.forEach((mv, i) => {
            expect(parsePathPoint(paths.III[i]).y).toBeCloseTo(Number(mapMillivoltToCanvasY(mv).toFixed(2)));
        });
    });

    it('mengubah gelombang ketika filter klinis aktif (bukan tampilan raw)', () => {
        const raw = makeQrsFrame(75, 400);
        const off = applyConfiguredFiltersToFrame(raw, FILTERS_ALL_OFF);
        const on = applyConfiguredFiltersToFrame(raw, FILTERS_CLINICAL_DEFAULT);
        const delta = on.II.reduce((sum, v, i) => sum + Math.abs(v - off.II[i]), 0);
        expect(delta).toBeGreaterThan(1);
    });

    it('menghitung BPM dari seluruh segmen frame, sinkron dengan filter', () => {
        const raw = makeQrsFrame(75);
        const off = calculateFrameHeartRate(raw, FILTERS_ALL_OFF);
        const on = calculateFrameHeartRate(raw, FILTERS_CLINICAL_DEFAULT);

        expect(off.bpm).toBeGreaterThan(50);
        expect(off.bpm).toBeLessThan(110);
        expect(on.bpm).toBeGreaterThan(50);
        expect(on.bpm).toBeLessThan(110);
        expect(off.rrIntervals.length).toBeGreaterThan(0);
        expect(on.rrIntervals.length).toBeGreaterThan(0);
    });

    it('mengembalikan BPM 0 jika frame belum berisi data', () => {
        expect(calculateFrameHeartRate({ ch1: [], ch2: [], ch3: [] }, FILTERS_ALL_OFF).bpm).toBe(0);
    });
});
