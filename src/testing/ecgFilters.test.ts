import { describe, it, expect, beforeEach } from 'vitest';
import { MovingAverageFilter, IIRFilter } from '../core/algorithms/ecgFilters';

describe('MovingAverageFilter', () => {
    let filter: MovingAverageFilter;

    beforeEach(() => {
        filter = new MovingAverageFilter(3);
    });

    it('should calculate the moving average of values correctly', () => {
        expect(filter.process(1.0)).toBe(1.0);
        expect(filter.process(2.0)).toBe(1.5);
        expect(filter.process(3.0)).toBe(2.0); // buffer = [1, 2, 3] -> avg = 2
        expect(filter.process(4.0)).toBe(3.0); // buffer = [2, 3, 4] -> avg = 3
    });

    it('should reset buffer properly', () => {
        filter.process(1.0);
        filter.process(2.0);
        filter.reset();
        expect(filter.process(10.0)).toBe(10.0);
    });
});

describe('IIRFilter (0.5Hz - 40Hz Bandpass)', () => {
    let filter: IIRFilter;

    beforeEach(() => {
        filter = new IIRFilter();
    });

    it('should filter a constant signal towards zero', () => {
        filter.reset();
        
        // Feed constant values (DC offset)
        let out = 0;
        for (let i = 0; i < 50; i++) {
            out = filter.process(10.0);
        }
        
        // Output should decay towards 0 as DC offset is filtered
        expect(Math.abs(out)).toBeLessThan(1.0);
    });

    it('should reset internal state on reset()', () => {
        filter.process(5.0);
        filter.process(10.0);
        filter.reset();
        
        // Resetting should clear history, giving the same output as a fresh start
        const freshFilter = new IIRFilter();
        expect(filter.process(3.0)).toBeCloseTo(freshFilter.process(3.0));
    });
});
