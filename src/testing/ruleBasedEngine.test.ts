import { describe, it, expect } from 'vitest';
import { evaluateIrregularity, generateClinicalExplanation } from '../core/clinical/ruleBasedEngine';

describe('Clinical Rule-Based Engine', () => {
  describe('evaluateIrregularity', () => {
    it('should return default values if less than 2 intervals are provided', () => {
      const result = evaluateIrregularity([1.0]);
      expect(result.hr).toBe(0);
      expect(result.events).toContain('Menganalisis...');
      expect(result.isIrregular).toBe(false);
    });

    it('should identify Non Aritmia for steady 60 BPM (1s intervals)', () => {
      const result = evaluateIrregularity([1.0, 1.0, 1.0]);
      expect(result.hr).toBe(60);
      expect(result.rrAvgMs).toBe(1000);
      expect(result.rmssdMs).toBe(0); // Constant interval
      expect(result.events).toContain('Non Aritmia');
      expect(result.isIrregular).toBe(false);
    });

    it('should diagnose Tachycardia if heart rate is > 100 BPM (0.5s intervals)', () => {
      const result = evaluateIrregularity([0.5, 0.5, 0.5]);
      expect(result.hr).toBe(120);
      expect(result.events).toContain('Tachycardia');
      expect(result.isIrregular).toBe(false);
    });

    it('should diagnose Bradycardia if heart rate is < 60 BPM (1.2s intervals)', () => {
      const result = evaluateIrregularity([1.2, 1.2, 1.2]);
      expect(result.hr).toBe(50);
      expect(result.events).toContain('Bradycardia');
      expect(result.isIrregular).toBe(false);
    });

    it('should diagnose Irregular Rhythm if interval variation (stdRr) exceeds 100ms', () => {
      // Highly variable intervals: 1.0s and 0.6s
      const result = evaluateIrregularity([1.0, 0.6, 1.0, 0.6]);
      expect(result.isIrregular).toBe(true);
      expect(result.events).toContain('Irregular Rhythm');
    });
  });

  describe('generateClinicalExplanation', () => {
    it('should synthesize a normal explanation when both AI and rules say normal', () => {
      const ruleResult = evaluateIrregularity([1.0, 1.0, 1.0]); // 60 BPM
      const explanation = generateClinicalExplanation('NORM', false, ruleResult);
      
      expect(explanation.isAnomaly).toBe(false);
      expect(explanation.severity).toBe('NORMAL');
      expect(explanation.fullExplanation).toContain('Non Aritmia');
      expect(explanation.fullExplanation).toContain('NORM');
    });

    it('should synthesize a warning/critical explanation if AI predicts an abnormality', () => {
      const ruleResult = evaluateIrregularity([1.0, 1.0, 1.0]); // 60 BPM
      const explanation = generateClinicalExplanation('AF', true, ruleResult);
      
      expect(explanation.isAnomaly).toBe(true);
      expect(explanation.severity).toBe('CRITICAL');
      expect(explanation.fullExplanation).toContain('PERINGATAN KLINIS');
      expect(explanation.fullExplanation).toContain('AF');
    });
  });
});
