/**
 * @fileoverview Modul Core: DC Blocker (Median Filter)
 * Bertugas menyaring tegangan sisa (DC Offset) dan Baseline Wander 
 * dari perangkat keras EKG sehingga sinyal terpusat di angka 0.0 mV.
 * 
 * UPDATE: Mengadopsi Hukum Segitiga Einthoven murni untuk efisiensi komputasi Lead III.
 * UPDATE: Menggunakan Median Kernel Filter (ukuran 51) menggantikan Exponential Moving Average.
 */

export class DCBlocker {
    private emaI: number | null = null;
    private emaII: number | null = null;
    private alpha: number;

    /**
     * Alpha determines how fast the filter tracks the baseline.
     * A smaller alpha (e.g. 0.005) means it tracks slow baseline wanders smoothly.
     */
    constructor(alpha: number = 0.005) {
        this.alpha = alpha;
    }

    /**
     * Mengembalikan memori baseline ke kondisi kosong.
     * Ini akan membuat sinyal secara paksa kembali ke titik persis 0 pada frame baru.
     */
    public reset(): void {
        this.emaI = null;
        this.emaII = null;
    }

    /**
     * Memproses tegangan mentah menggunakan Exponential Moving Average (EMA).
     * Secara konstan akan melacak Baseline Wander dan menguranginya (High-Pass).
     */
    public process(rawI: number, rawII: number) {
        // Pada titik pertama frame, EMA diinisialisasi dengan nilai mentah itu sendiri,
        // sehingga raw - ema = 0 secara absolut.
        if (this.emaI === null || this.emaII === null) {
            this.emaI = rawI;
            this.emaII = rawII;
        }

        // Hitung rata-rata berjalan (EMA) dari sinyal
        this.emaI = this.alpha * rawI + (1 - this.alpha) * this.emaI;
        this.emaII = this.alpha * rawII + (1 - this.alpha) * this.emaII;

        // Kurangi sinyal asli dengan rata-rata berjalan (menghasilkan sinyal yang terpusat di 0)
        const cleanI = rawI - this.emaI;
        const cleanII = rawII - this.emaII;

        // Hukum Einthoven murni untuk Lead III: III = II - I
        const cleanIII = cleanII - cleanI;

        return {
            cleanI,
            cleanII,
            cleanIII
        };
    }
}