import { describe, it, expect, beforeEach } from 'vitest';
import { DCBlocker } from '../core/algorithms/dcBlocker';

describe('DCBlocker filter', () => {
  let dcBlocker: DCBlocker;

  beforeEach(() => {
    dcBlocker = new DCBlocker();
  });

  it('should treat the first inputs as the baseline and output zero values', () => {
    // First data point sets baselineI = 1.2, baselineII = 2.4
    const result = dcBlocker.process(1.2, 2.4);
    
    expect(result.cleanI).toBe(0.0);
    expect(result.cleanII).toBe(0.0);
    expect(result.cleanIII).toBe(0.0);
  });

  it('should subtract the baseline from subsequent inputs', () => {
    // First inputs: Sets baseline
    dcBlocker.process(1.0, 2.0);
    
    // Second inputs:
    // cleanI = 1.5 - 1.0 = 0.5
    // cleanII = 2.8 - 2.0 = 0.8
    // cleanIII = 0.8 - 0.5 = 0.3
    const result = dcBlocker.process(1.5, 2.8);
    
    expect(result.cleanI).toBeCloseTo(0.5);
    expect(result.cleanII).toBeCloseTo(0.8);
    expect(result.cleanIII).toBeCloseTo(0.3);
  });

  it('should reset baseline on reset() call', () => {
    // First inputs: Sets baseline to (1.0, 2.0)
    dcBlocker.process(1.0, 2.0);
    
    dcBlocker.reset();
    
    // First input after reset should set a new baseline of (3.0, 5.0) and return zeros
    const result = dcBlocker.process(3.0, 5.0);
    expect(result.cleanI).toBe(0.0);
    expect(result.cleanII).toBe(0.0);
    
    // Next input
    const nextResult = dcBlocker.process(3.5, 6.2);
    expect(nextResult.cleanI).toBeCloseTo(0.4975);
    expect(nextResult.cleanII).toBeCloseTo(1.194);
  });
});
