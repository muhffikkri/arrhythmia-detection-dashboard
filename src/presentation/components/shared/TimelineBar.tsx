/**
 * @fileoverview Komponen UI: TimelineBar
 * Menampilkan baris navigasi segmen waktu perekaman 10 detik (00:00 - 10:00).
 * Mengubah warna tombol berdasarkan hasil evaluasi AI klinis (Normal vs Aritmia).
 */

import React, { useEffect, useRef } from 'react';
import type { TimelineEvent } from '../../../core/types/ecgTypes';

interface TimelineBarProps {
    events: TimelineEvent[];
    currentIdx?: number;
    onSegmentSelect?: (index: number) => void;
}

export const TimelineBar: React.FC<TimelineBarProps> = ({
    events,
    currentIdx,
    onSegmentSelect
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll ke kanan saat ada segmen baru masuk (Simulasi Live Monitor)
    useEffect(() => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            container.scrollTo({
                left: container.scrollWidth,
                behavior: 'smooth'
            });
        }
    }, [events.length]);

    return (
        <div className="bg-white border border-clinical-charcoal/5 rounded-[2rem] p-8 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] w-full group">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
                <h3 className="text-xl font-bold text-clinical-charcoal flex items-center gap-2">
                    <span className="material-symbols-outlined text-[24px] text-clinical-blue group-hover:scale-110 transition-transform duration-700">history</span> Navigasi Segmen Perekaman (AI Timeline)
                </h3>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-[11px] text-clinical-charcoal/60 font-bold uppercase tracking-wider">
                        <div className="w-3 h-3 rounded-full bg-clinical-blue shadow-sm"></div> Normal
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-clinical-charcoal/60 font-bold uppercase tracking-wider">
                        <div className="w-3 h-3 rounded-full bg-clinical-red shadow-sm"></div> Anomali
                    </div>
                </div>
            </div>

            {/* WADAH TOMBOL TIMELINE DENGAN SCROLL HORIZONTAL */}
            <div
                ref={scrollContainerRef}
                className="flex gap-2 overflow-x-auto py-4 pl-1 pr-6 custom-scrollbar snap-x scroll-smooth w-full"
            >
                {events.length === 0 ? (
                    <div className="text-xs text-outline italic py-2">
                        Menunggu inisialisasi stream data untuk menyusun timeline AI...
                    </div>
                ) : (
                    events.map((event) => {
                        const isSelected = currentIdx === event.index;

                        return (
                            <button
                                key={event.index}
                                onClick={() => onSegmentSelect && onSegmentSelect(event.index)}
                                className={`flex-shrink-0 h-10 px-5 rounded-full text-white font-bold text-[11px] uppercase tracking-widest shadow-sm transition-all duration-500 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)] snap-center outline-none border-2 ${event.isAnomaly
                                        ? 'bg-clinical-red hover:shadow-[0px_10px_20px_rgba(220,38,38,0.2)] hover:brightness-110'
                                        : 'bg-clinical-blue hover:shadow-[0px_10px_20px_rgba(23,107,206,0.2)] hover:brightness-110'
                                    } ${isSelected
                                        ? 'border-transparent ring-2 ring-offset-[2px] ring-clinical-charcoal scale-105 z-10 relative'
                                        : 'border-transparent'
                                    }`}
                            >
                                {event.timeStr}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
};