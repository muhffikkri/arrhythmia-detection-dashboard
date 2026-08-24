import { describe, it, expect } from 'vitest';
import { useLazyEcgPaths } from '../application/hooks/useLazyEcgPaths';
import { renderHook } from '@testing-library/react';

describe('useLazyEcgPaths custom hook', () => {
    const mockSamples = Array.from({ length: 2500 }, (_, i) => Math.sin(i * 0.1));
    const mockCh2 = Array.from({ length: 2500 }, (_, i) => Math.cos(i * 0.1));
    const mockCh3 = Array.from({ length: 2500 }, () => 0);

    it('should return empty paths when samples are empty', () => {
        const { result } = renderHook(() => useLazyEcgPaths([], [], []));
        expect(result.current.I).toEqual([]);
        expect(result.current.II).toEqual([]);
    });

    it('should prepend the standard calibration pulse to the beginning of each path', () => {
        const gain = 10;
        const speed = 25;
        const { result } = renderHook(() => useLazyEcgPaths(mockSamples, mockCh2, mockCh3, gain, speed));

        // Calibration pulse parameters at 25 mm/s and 10 mm/mV:
        // rise = 0.1 * 25 * 8 = 20px
        // fall = 0.3 * 25 * 8 = 60px
        // height = 240 - 1.0 * (10 * 8) = 160px
        // width = 0.4 * 25 * 8 = 80px
        const expectedCalPulse = [
            '0,240.00',
            '20,240.00',
            '20,160',
            '60,160',
            '60,240.00',
            '80,240.00'
        ];

        // Verify each lead contains the cal pulse as prefix
        expect(result.current.I.slice(0, 6)).toEqual(expectedCalPulse);
        expect(result.current.II.slice(0, 6)).toEqual(expectedCalPulse);
        expect(result.current.III.slice(0, 6)).toEqual(expectedCalPulse);
    });

    it('should scale calibration pulse and coordinates when gain is modified', () => {
        const gain = 20; // 2x gain
        const speed = 25;
        const { result } = renderHook(() => useLazyEcgPaths(mockSamples, mockCh2, mockCh3, gain, speed));

        // height = 240 - 1.0 * (20 * 8) = 80px
        const expectedCalPulseHeight = '80';
        expect(result.current.I[2]).toBe(`20,${expectedCalPulseHeight}`);
        expect(result.current.I[3]).toBe(`60,${expectedCalPulseHeight}`);
    });

    it('should scale calibration pulse width and coordinates when paperSpeed is modified', () => {
        const gain = 10;
        const speed = 50; // 2x paper speed
        const { result } = renderHook(() => useLazyEcgPaths(mockSamples, mockCh2, mockCh3, gain, speed));

        // rise = 0.1 * 50 * 8 = 40px
        // fall = 0.3 * 50 * 8 = 120px
        // width = 0.4 * 50 * 8 = 160px
        const expectedCalPulse = [
            '0,240.00',
            '40,240.00',
            '40,160',
            '120,160',
            '120,240.00',
            '160,240.00'
        ];
        expect(result.current.I.slice(0, 6)).toEqual(expectedCalPulse);
    });
});
