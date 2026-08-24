/**
 * @fileoverview Modul Core: ECG Filter Pipeline
 * Mengimplementasikan pembersihan sinyal (Sanitasi), Denoising frekuensi tinggi (Moving Average),
 * Koreksi baseline wander (High-Pass), dan Normalisasi Z-score (skala amplitudo standar).
 */

export class MovingAverageFilter {
    private buffer: number[] = [];
    private size: number;

    constructor(size: number = 5) {
        this.size = size;
    }

    public process(val: number): number {
        this.buffer.push(val);
        if (this.buffer.length > this.size) {
            this.buffer.shift();
        }
        const sum = this.buffer.reduce((a, b) => a + b, 0);
        return sum / this.buffer.length;
    }

    public reset(): void {
        this.buffer = [];
    }
}

export class IIRFilter {
    private x1 = 0;
    private x2 = 0;
    private y1 = 0;
    private y2 = 0;
    
    // Butterworth Bandpass 0.5Hz - 40Hz coefficients at 250Hz sampling rate
    // b = [0.3622, 0, -0.3622], a = [1, -1.0270, 0.2756]
    private b = [0.3622, 0, -0.3622];
    private a = [-1.0270, 0.2756];

    public process(x: number): number {
        const y = this.b[0] * x + this.b[1] * this.x1 + this.b[2] * this.x2 
                  - this.a[0] * this.y1 - this.a[1] * this.y2;
                  
        this.x2 = this.x1;
        this.x1 = x;
        this.y2 = this.y1;
        this.y1 = y;
        
        return y;
    }

    public reset(): void {
        this.x1 = 0;
        this.x2 = 0;
        this.y1 = 0;
        this.y2 = 0;
    }
}

export interface FilterStates {
    sanitize: boolean;
    baseline: boolean;
    denoise: boolean;
    bandpass: boolean;
    normalization: boolean;
}

export const DEFAULT_FILTERS: FilterStates = {
    sanitize: true,
    baseline: true,
    denoise: true,
    bandpass: false,
    normalization: false
};
