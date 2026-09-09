/**
 * @fileoverview Modul Core: Mesin Aturan Klinis & Holter (Rule-Based Engine)
 * Mengadopsi algoritma ekstraksi metrik klinis dari Research-Grade v5.0 (logic_layer.py)
 * untuk menghitung HR, RMSSD, QTc, dan mengidentifikasi anomali dasar.
 */

export interface ClinicalExplanation {
    isAnomaly: boolean;
    severity: 'NORMAL' | 'WARNING' | 'CRITICAL';
    fullExplanation: string;
}

export interface RuleBasedResult {
    hr: number;
    rrAvgMs: number;
    rmssdMs: number;
    qtcMs: number;
    events: string[];
    isIrregular: boolean;
}

/**
 * Menghitung metrik Holter berdasarkan kumpulan interval RR (dalam detik).
 * Algoritma ini diadopsi dari `extract_holter_metrics` versi Python.
 * 
 * @param rrIntervalsSec Array jarak antar R-Peak dalam satuan detik.
 * @param tolerance (Opsional) Toleransi iregularitas, disediakan untuk backward-compatibility.
 * @returns Objek metrik klinis (HR, RMSSD, QTc, Events).
 */

export function evaluateIrregularity(rrIntervalsSec: number[]): RuleBasedResult {
    // Jika data puncak belum cukup (minimal butuh 2 interval untuk perbandingan)
    if (rrIntervalsSec.length < 2) {
        return { 
            hr: 0, rrAvgMs: 0, rmssdMs: 0, qtcMs: 0, 
            events: ["Menganalisis..."], isIrregular: false 
        };
    }

    // 1. Konversi ke Milidetik (ms) untuk presisi medis
    const rrMs = rrIntervalsSec.map(sec => sec * 1000.0);
    const rrAvg = rrMs.reduce((a, b) => a + b, 0) / rrMs.length;
    
    // 2. Kalkulasi Heart Rate (BPM)
    const hr = rrAvg > 0 ? 60000.0 / rrAvg : 0;

    // 3. Kalkulasi RMSSD (Root Mean Square of Successive Differences)
    // Parameter standar emas untuk mengukur variabilitas detak jantung (HRV)
    const rrDiffs: number[] = [];
    for (let i = 1; i < rrMs.length; i++) {
        rrDiffs.push(rrMs[i] - rrMs[i - 1]);
    }
    
    let rmssd = 0;
    if (rrDiffs.length > 0) {
        const sqDiffSum = rrDiffs.reduce((sum, diff) => sum + (diff * diff), 0);
        rmssd = Math.sqrt(sqDiffSum / rrDiffs.length);
    }

    // 4. Standar Deviasi dari interval RR untuk mendeteksi Iregularitas
    const variance = rrMs.reduce((sum, rr) => sum + Math.pow(rr - rrAvg, 2), 0) / rrMs.length;
    const stdRr = Math.sqrt(variance);

    // 5. Kalkulasi QTc (Koreksi Interval QT) menggunakan Formula Bazett
    // Asumsi durasi QT normal 360ms untuk keperluan simulasi
    const qtMs = 360.0;
    const qtc = rrAvg > 0 ? qtMs / Math.sqrt(rrAvg / 1000.0) : 0;

    // 6. Aturan Status Klinis Dasar (Rules)
    const events: string[] = [];
    if (hr > 100) events.push("Tachycardia");
    else if (hr < 60) events.push("Bradycardia");

    // Aturan klinis: jika Standar Deviasi > 100ms, irama tidak teratur
    if (stdRr > 100) events.push("Irregular Rhythm");

    if (events.length === 0) events.push("Sinus Rhythm");

    return {
        hr: Math.round(hr),
        rrAvgMs: Math.round(rrAvg),
        rmssdMs: Math.round(rmssd),
        qtcMs: Math.round(qtc),
        events,
        isIrregular: stdRr > 100
    };
}

/**
 * Mensintesis penjelasan klinis gabungan dari prediksi Jaringan Saraf Tiruan (AI)
 * dan mesin aturan (Rule-based) metrik Holter.
 * 
 * @param aiClass Hasil klasifikasi dari model (misal: "AF", "Non Aritmia")
 * @param aiAnomaly Apakah indeks AI mendeteksi anomali (TFLite/Keras)
 * @param ruleResult Hasil kalkulasi statistik RR dari evaluateIrregularity()
 */
export function generateClinicalExplanation(
    aiClass: string,
    aiAnomaly: boolean,
    ruleResult: RuleBasedResult
): ClinicalExplanation {
    
    // Gabungan: Sistem akan membunyikan alarm jika AI mendeteksi anomali, 
    // ATAU jika mesin aturan matematis menemukan Tachy/Brady/Iregular.
    const isAnomaly = aiAnomaly || ruleResult.isIrregular || ruleResult.hr > 100 || ruleResult.hr < 60;
    
    const severity = isAnomaly ? 'CRITICAL' : 'NORMAL';
    let explanation = "";
    
    if (!isAnomaly) {
        explanation = `Non Aritmia. Jaringan AI menyimpulkan ${aiClass} dengan variasi interval (RMSSD: ${ruleResult.rmssdMs} ms). Detak jantung dan QTc (${ruleResult.qtcMs} ms) stabil.`;
    } else {
        const ruleEvents = ruleResult.events.filter(e => e !== "Sinus Rhythm" && e !== "Menganalisis...").join(" & ");
        const eventStr = ruleEvents.length > 0 ? `Diagnosis Aturan Matematis: [${ruleEvents}].` : "";
        
        explanation = `PERINGATAN KLINIS: Analisis AI mendeteksi [${aiClass}]. ${eventStr} Variabilitas jantung (RMSSD) mencapai ${ruleResult.rmssdMs} ms dengan QTc ${ruleResult.qtcMs} ms. Tinjauan klinis disarankan.`;
    }

    return {
        isAnomaly,
        severity,
        fullExplanation: explanation
    };
}