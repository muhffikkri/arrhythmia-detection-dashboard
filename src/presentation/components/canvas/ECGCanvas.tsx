/**
 * @fileoverview Komponen UI: ECG Canvas
 * Bertugas merender grid kertas medis standar (1mm = 0.04s, 1mV = 10mm)
 * dan menggambar 7 jalur gelombang (Lead I, II, III, aVR, aVL, aVF, V1).
 *
 * UPDATE VERSION: Unrestricted Wave Overlap & Single Canvas
 * 1. Menghapus batasan kotak per saluran (overflow-hidden) agar puncak
 *    gelombang tinggi dapat overlap dengan bebas layaknya kertas EKG fisik.
 * 2. Menyatukan seluruh gelombang ke dalam 1 layer SVG raksasa demi
 *    peningkatan performa (mengurangi jumlah node DOM).
 * 3. Menangani pembalikan aVR menggunakan matriks scale SVG matematis murni.
 */

import React, { useState, useRef } from "react";
import type { ECGPaths, RPeakMarker } from "../../../core/types/ecgTypes";

const PAPER_SPEED_X_SCALE: Record<number, number> = {
  12.5: 0.5,
  25: 1,
  50: 2.1,
};

interface ECGCanvasProps {
  paths: ECGPaths;
  rPeaks: RPeakMarker[];
  isAnomaly?: boolean;
  classResult?: string;
  speed?: number;
  paperSpeed?: number;
  gain?: number;
  scale?: number;
  timeOffset?: number;
  pixelsPerMm?: number; // physical scale calibration
  showCalibrationPulse?: boolean;
}

export const ECGCanvas: React.FC<ECGCanvasProps> = ({ paths, rPeaks, isAnomaly = false, classResult = "NORM", speed = 25, paperSpeed = 25, gain = 10, scale = 1, timeOffset = 0, pixelsPerMm = 3.7795, showCalibrationPulse = true }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pointerX, setPointerX] = useState<number | null>(null);
  const [pointerY, setPointerY] = useState<number | null>(null);

  // Mathematical Calibration:
  const xScale = PAPER_SPEED_X_SCALE[paperSpeed] ?? 1;
  const widthFactor = Math.max(1, xScale);
  const logicalCanvasWidth = 2000 * widthFactor;
  const physicalWidth = 10 * 25 * pixelsPerMm * widthFactor;
  const physicalHeight = 360 * pixelsPerMm; // 6 leads * 60mm

  const yGain = gain / 10;
  const lead2Stroke = "#001F54";

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    let x = clientX - rect.left;
    let y = clientY - rect.top;

    if (x > physicalWidth) x = physicalWidth;
    if (x < 0) x = 0;
    setPointerX(x);
    setPointerY(y);
  };

  const hidePointer = () => {
    setPointerX(null);
    setPointerY(null);
  };

  let tooltipX = (pointerX || 0) + 20;
  if (pointerX && pointerX > physicalWidth - 200) tooltipX = pointerX - 190;

  let tooltipY = (pointerY || 0) + 20;
  if (pointerY && pointerY > physicalHeight - 100) tooltipY = pointerY - 80;

  // Convert pointer physical X to seconds (10 seconds total width)
  const absoluteSecs = timeOffset + ((pointerX || 0) / physicalWidth) * 10;
  const mStr = Math.floor(absoluteSecs / 60)
    .toString()
    .padStart(2, "0");
  const sStr = Math.floor(absoluteSecs % 60)
    .toString()
    .padStart(2, "0");
  const msStr = Math.floor((absoluteSecs % 1) * 100)
    .toString()
    .padStart(2, "0");
  const boxIndex = (absoluteSecs / 0.04).toFixed(1);

  // Reference pulse: 1 mV high and half a second of paper distance at 25 mm/s.
  // This gives the calibration sheet's 12.5 mm at 25 mm/s and 25 mm at 50 mm/s.
  const calibrationPulseWidth = 100;
  const calibrationPulseHeight = 80;
  const renderCalibrationPulse = (lead: string) => {
    return (
      <path
        data-testid={`calibration-pulse-${lead}`}
        d={`M 0 240 L 5 240 L 5 ${240 - calibrationPulseHeight} L ${calibrationPulseWidth - 5} ${240 - calibrationPulseHeight} L ${calibrationPulseWidth - 5} 240 L ${calibrationPulseWidth} 240`}
        fill="none"
        stroke="#001F54"
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        transform={`translate(0, 240) scale(${xScale}, ${yGain}) translate(0, -240)`}
      />
    );
  };

  // Fungsi helper dinamis untuk merender marker di dalam koordinat grup SVG
  const renderMarkers = (leadKey: "yI" | "yII" | "yIII" | "yaVR" | "yaVL" | "yaVF" | "yV1", showMetrics: boolean = false) => {
    return rPeaks.map((peak, idx) => {
      const yPos = peak[leadKey];
      if (yPos === undefined) return null;

      return (
        <g key={idx}>
          {/* Titik Lingkaran Puncak QRS */}
          <circle cx={peak.x + 50} cy={yPos} r="2.5" fill="#3B82F6" />

          {/* Render teks metrik (Hanya diaktifkan pada Lead II) */}
          {showMetrics && peak.prevX !== undefined && peak.bpm !== undefined && peak.boxesText && (
            <>
              <line x1={peak.prevX + 50} y1="12" x2={peak.x + 50} y2="12" stroke="#3B82F6" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
              <line x1={peak.prevX + 50} y1="8" x2={peak.prevX + 50} y2="16" stroke="#3B82F6" strokeWidth="1.5" opacity="0.6" />
              <line x1={peak.x + 50} y1="8" x2={peak.x + 50} y2="16" stroke="#3B82F6" strokeWidth="1.5" opacity="0.6" />

              <text x={peak.prevX + 50 + (peak.x - peak.prevX) / 2} y="22" fill="#1E3A8A" fontSize="9" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
                {peak.bpm} BPM
              </text>
              <text x={peak.prevX + 50 + (peak.x - peak.prevX) / 2} y="32" fill="#64748B" fontSize="8" fontFamily="sans-serif" textAnchor="middle">
                ({peak.boxesText})
              </text>
            </>
          )}
        </g>
      );
    });
  };

  return (
    <div className="flex-1 overflow-auto custom-scrollbar relative flex flex-col bg-[#FFF9FA]" id="ecg-scroll-container">
      <div className="flex flex-col relative" style={{ minWidth: `${physicalWidth + 64}px`, zoom: scale }}>
        {/* Header Frame Atas (Non-sticky, sejajar kertas) */}
        <div className="w-full h-[40px] flex-shrink-0 bg-white rounded-t-[2rem] border-b border-clinical-charcoal/5 z-0"></div>

        <div className="relative flex flex-row">
          {/* Y-Axis Skala Garis Tepi (Kiri) */}
          <div className="sticky left-0 w-16 h-[2880px] flex-shrink-0 bg-white/95 backdrop-blur z-30 shadow-[2px_0_5px_rgba(0,0,0,0.03)]" style={{ height: `${physicalHeight}px` }}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="absolute w-full" style={{ top: `${idx * 60 * pixelsPerMm}px`, height: `${60 * pixelsPerMm}px` }}>
                <span className="absolute top-[0px] left-1 md:left-1.5 text-[9px] font-mono-data font-bold text-red-600 leading-none -translate-y-1/2">±3.0mV</span>
                <span className="absolute top-[16.6%] left-1.5 md:left-2 text-[9px] font-mono-data font-bold text-red-600 leading-none -translate-y-1/2">+2.0mV</span>
                <span className="absolute top-[33.3%] left-1.5 md:left-2 text-[9px] font-mono-data font-bold text-red-600 leading-none -translate-y-1/2">+1.0mV</span>
                <span className="absolute top-[50%] left-1.5 md:left-2 text-[9px] font-mono-data font-bold text-red-600 leading-none -translate-y-1/2">0</span>
                <span className="absolute top-[66.6%] left-1.5 md:left-2 text-[9px] font-mono-data font-bold text-red-600 leading-none -translate-y-1/2">-1.0mV</span>
                <span className="absolute top-[83.3%] left-1.5 md:left-2 text-[9px] font-mono-data font-bold text-red-600 leading-none -translate-y-1/2">-2.0mV</span>
              </div>
            ))}
          </div>

          {/* Area Canvas Interaktif Utama */}
          <div
            className="relative z-10 flex flex-col cursor-crosshair"
            style={{ width: `${physicalWidth}px`, height: `${physicalHeight}px` }}
            ref={canvasRef}
            onMouseMove={handlePointerMove}
            onTouchMove={handlePointerMove}
            onMouseEnter={() => setPointerX(0)}
            onMouseLeave={hidePointer}
            onTouchStart={() => setPointerX(0)}
            onTouchEnd={hidePointer}
          >
            {/* SATU CANVAS RAKSASA (GRID + GELOMBANG EKG TERINTEGRASI) */}
            <svg
              data-testid="ecg-svg"
              data-paper-speed={paperSpeed}
              data-gain={gain}
              data-pixels-per-mm={pixelsPerMm}
              data-grid-small-logical="8"
              data-grid-large-logical="40"
              data-calibration-pulse-width-logical={calibrationPulseWidth * xScale}
              data-calibration-pulse-height-logical={calibrationPulseHeight * yGain}
              className="absolute top-0 left-0 pointer-events-none z-10 overflow-visible"
              width={logicalCanvasWidth}
              height={2880}
              style={{ width: `${physicalWidth}px`, height: `${physicalHeight}px` }}
              viewBox={`0 0 ${logicalCanvasWidth} 2880`}
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Layer 1: Definisi & Latar Belakang Grid (Menggunakan Logical Coordinates 8px per kotak) */}
              <defs>
                <pattern id="smallGrid" width="8" height="8" patternUnits="userSpaceOnUse">
                  <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#FFD1DC" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                </pattern>
                <pattern id="largeGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <rect width="40" height="40" fill="url(#smallGrid)" />
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#FFA6C9" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
                </pattern>
              </defs>
              <rect width={logicalCanvasWidth} height={2880} fill="url(#largeGrid)" />

              {/* Garis Pemisah Antar Baris */}
              {[1, 2, 3, 4, 5].map((i) => (
                <line key={i} x1="0" y1={i * 480} x2={logicalCanvasWidth} y2={i * 480} stroke="rgba(255, 166, 201, 0.8)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              ))}

              {/* Layer 2: Saluran Gelombang (Digeser otomatis dengan transform-translate) */}
              {/* 1. Lead I */}
              <g transform={`translate(0, 0)`}>
                {showCalibrationPulse && renderCalibrationPulse("I")}
                <g transform={`translate(50, 240) scale(${xScale}, ${yGain}) translate(0, -240)`}>
                  <path data-testid="ecg-path-I" d={paths.I.length > 0 ? `M${paths.I.join(" L")}` : ""} fill="none" stroke="#001F54" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </g>
                {renderMarkers("yI")}
              </g>

              {/* 2. Lead II */}
              <g transform={`translate(0, 480)`}>
                {showCalibrationPulse && renderCalibrationPulse("II")}
                <g transform={`translate(50, 240) scale(${xScale}, ${yGain}) translate(0, -240)`}>
                  <path d={paths.II.length > 0 ? `M${paths.II.join(" L")}` : ""} fill="none" stroke={lead2Stroke} strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </g>
                {renderMarkers("yII", true)}
              </g>

              {/* 3. Lead III */}
              <g transform={`translate(0, 960)`}>
                {showCalibrationPulse && renderCalibrationPulse("III")}
                <g transform={`translate(50, 240) scale(${xScale}, ${yGain}) translate(0, -240)`}>
                  <path d={paths.III.length > 0 ? `M${paths.III.join(" L")}` : ""} fill="none" stroke="#001F54" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </g>
                {renderMarkers("yIII")}
              </g>

              {/* 4. aVR (Pembalikan sinyal dilakukan dengan -yGain) */}
              <g transform={`translate(0, 1440)`}>
                {showCalibrationPulse && renderCalibrationPulse("aVR")}
                <g transform={`translate(50, 240) scale(${xScale}, ${-yGain}) translate(0, -240)`}>
                  <path d={paths.aVR.length > 0 ? `M${paths.aVR.join(" L")}` : ""} fill="none" stroke="#001F54" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </g>
                {renderMarkers("yaVR")}
              </g>

              {/* 5. aVL */}
              <g transform={`translate(0, 1920)`}>
                {showCalibrationPulse && renderCalibrationPulse("aVL")}
                <g transform={`translate(50, 240) scale(${xScale}, ${yGain}) translate(0, -240)`}>
                  <path d={paths.aVL.length > 0 ? `M${paths.aVL.join(" L")}` : ""} fill="none" stroke="#001F54" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </g>
                {renderMarkers("yaVL")}
              </g>

              {/* 6. aVF */}
              <g transform={`translate(0, 2400)`}>
                {showCalibrationPulse && renderCalibrationPulse("aVF")}
                <g transform={`translate(50, 240) scale(${xScale}, ${yGain}) translate(0, -240)`}>
                  <path d={paths.aVF.length > 0 ? `M${paths.aVF.join(" L")}` : ""} fill="none" stroke="#001F54" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </g>
                {renderMarkers("yaVF")}
              </g>
            </svg>

            {/* Layer 3: Label Nama Saluran (Floating / Absolute Position) */}
            <div className="absolute top-0 left-0 w-full pointer-events-none z-20" style={{ height: `${physicalHeight}px` }}>
              {["Lead I", "Lead II", "Lead III", "aVR (Calculated)", "aVL (Calculated)", "aVF (Calculated)"].map((label, i) => (
                <div key={i} className="absolute left-2 bg-white/80 backdrop-blur px-2 py-0.5 rounded border border-pink-200 font-mono-data font-bold text-brand-navy text-[10px] shadow-sm" style={{ top: `${i * 60 * pixelsPerMm + 8}px` }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Layer 4: Interaksi Pointer Mouse & Tooltip (Paling Atas) */}
            <div
              className="absolute top-0 bottom-0 border-l border-dashed border-outline pointer-events-none z-30 transition-opacity duration-100"
              style={{ transform: `translateX(${pointerX || 0}px)`, opacity: pointerX !== null ? 1 : 0 }}
            />
            <div
              className="absolute z-40 pointer-events-none transition-transform duration-75 bg-charcoal/95 backdrop-blur-sm text-white p-3 rounded-xl shadow-xl border border-white/20 min-w-[140px]"
              style={{ transform: `translate(${tooltipX}px, ${tooltipY}px)`, opacity: pointerX !== null ? 1 : 0 }}
            >
              <div className="flex flex-col gap-1.5 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Waktu:</span> <span className="font-mono-data font-bold text-xs">{`${mStr}:${sStr}.${msStr}s`}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Kotak ke-:</span> <span className="font-mono-data font-bold text-medical-teal">{boxIndex}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Frame Bawah (Non-sticky, sejajar kertas) */}
        <div className="w-full h-[40px] flex-shrink-0 bg-white rounded-b-[2rem] border-t border-clinical-charcoal/5 mt-auto z-0"></div>
      </div>
    </div>
  );
};
