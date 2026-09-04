import React, { useState, useEffect } from "react";
import { RulerIcon } from "./RulerIcon";

interface ScreenCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pixelsPerMm: number) => void;
}

export const ScreenCalibrationModal: React.FC<ScreenCalibrationModalProps> = ({ isOpen, onClose, onSave }) => {
  // Default 96 DPI CSS value: 1 inch = 96px => 1 mm = 96 / 25.4 ≈ 3.7795 px
  const [pixelsPerMm, setPixelsPerMm] = useState<number>(3.7795);
  const [targetLengthCm, setTargetLengthCm] = useState<number>(10); // 10 cm reference

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem("ecg_pixels_per_mm");
      if (saved) {
        setPixelsPerMm(parseFloat(saved));
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem("ecg_pixels_per_mm", pixelsPerMm.toString());
    onSave(pixelsPerMm);
    onClose();
  };

  const handleReset = () => {
    setPixelsPerMm(3.7795);
  };

  // Width of the box in CSS pixels = physical width (mm) * pixelsPerMm
  const targetLengthMm = targetLengthCm * 10;
  const boxWidthPx = targetLengthMm * pixelsPerMm;
  const rulerTicks = Array.from({ length: targetLengthMm + 1 }, (_, index) => index);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl max-h-[calc(100vh-2rem)] rounded-3xl shadow-xl overflow-y-auto flex flex-col relative animate-fade-in-up custom-scrollbar">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="bg-medical-teal/10 p-2 rounded-xl text-medical-teal">
              <RulerIcon size={20} />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-charcoal">Kalibrasi Monitor Fisik</h2>
              <p className="text-xs text-slate-500 mt-0.5">Sesuaikan skala piksel dengan ukuran penggaris asli</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 flex flex-col gap-8">
          {/* Info */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800 text-sm">
            <span className="material-symbols-outlined flex-shrink-0 mt-0.5 text-[16px]">info</span>
            <div>
              <p>
                <strong>Kenapa kalibrasi diperlukan?</strong> Ukuran piksel pada monitor (PPI) berbeda-beda. Agar pembacaan grid EKG 1mm = 0.04s akurat secara fisik, sesuaikan lebar kotak di bawah ini agar sama persis dengan penggaris di
                dunia nyata.
              </p>
            </div>
          </div>

          {/* Target Size Select */}
          <div className="flex gap-4 items-center">
            <span className="font-semibold text-slate-700 text-sm">Panjang Referensi:</span>
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button onClick={() => setTargetLengthCm(5)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${targetLengthCm === 5 ? "bg-white shadow-sm text-charcoal" : "text-slate-500 hover:text-slate-700"}`}>
                5 cm
              </button>
              <button onClick={() => setTargetLengthCm(8.56)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${targetLengthCm === 8.56 ? "bg-white shadow-sm text-charcoal" : "text-slate-500 hover:text-slate-700"}`}>
                Kartu ATM / KTP (8.56 cm)
              </button>
              <button onClick={() => setTargetLengthCm(10)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${targetLengthCm === 10 ? "bg-white shadow-sm text-charcoal" : "text-slate-500 hover:text-slate-700"}`}>
                10 cm
              </button>
            </div>
          </div>

          {/* Visual ruler */}
          <div className="flex flex-col gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-200 overflow-x-auto custom-scrollbar">
            <div className="flex justify-between items-center gap-4">
              <span className="text-xs font-mono font-bold text-slate-500 whitespace-nowrap">Tempelkan penggaris fisik pada garis ini</span>
              <span className="text-xs font-mono font-bold text-medical-teal whitespace-nowrap">{targetLengthMm} mm</span>
            </div>
            <div data-testid="screen-ruler" data-mm-length={targetLengthMm} data-pixels-per-mm={pixelsPerMm} className="relative h-16 shrink-0" style={{ width: `${boxWidthPx}px` }}>
              <div className="absolute left-0 right-0 top-7 h-0.5 bg-medical-teal"></div>
              {rulerTicks.map((millimeter) => (
                <div key={millimeter} className="absolute top-0 h-10 border-l border-medical-teal/70" style={{ left: `${millimeter * pixelsPerMm}px` }}>
                  {millimeter % 5 === 0 && <span className="absolute top-10 -translate-x-1/2 text-[9px] font-mono text-slate-500">{millimeter}</span>}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="inline-block border border-medical-teal bg-white" style={{ width: `${pixelsPerMm}px`, height: `${pixelsPerMm}px`, minWidth: `${pixelsPerMm}px`, minHeight: `${pixelsPerMm}px` }}></span>
              <span>
                Kotak kecil grid = <strong>1 mm</strong> ({pixelsPerMm.toFixed(3)} px)
              </span>
            </div>
          </div>

          {/* Slider */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
              <label className="font-semibold text-slate-700 text-sm">Sesuaikan Skala (Pixels per mm)</label>
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">{pixelsPerMm.toFixed(4)} px/mm</span>
            </div>
            <input
              aria-label="Pixels per mm"
              type="number"
              min="1"
              max="12"
              step="0.001"
              value={pixelsPerMm}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isFinite(value) && value >= 1 && value <= 12) setPixelsPerMm(value);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-700 focus:border-medical-teal focus:outline-none"
            />
            <div className="flex gap-4 items-center">
              <button onClick={() => setPixelsPerMm((p) => Math.max(1, p - 0.1))} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full font-bold">
                -
              </button>
              <input
                type="range"
                min="1"
                max="12"
                step="0.001"
                value={pixelsPerMm}
                onChange={(e) => setPixelsPerMm(parseFloat(e.target.value))}
                className="flex-1 accent-medical-teal h-2 bg-slate-200 rounded-full appearance-none outline-none cursor-pointer"
              />
              <button onClick={() => setPixelsPerMm((p) => Math.min(8, p + 0.1))} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full font-bold">
                +
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <button onClick={handleReset} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
            Reset ke Default (CSS)
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors">
              Batal
            </button>
            <button onClick={handleSave} className="px-5 py-2 rounded-xl text-sm font-bold bg-medical-teal hover:bg-teal-600 text-white shadow-sm transition-colors">
              Simpan Kalibrasi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
