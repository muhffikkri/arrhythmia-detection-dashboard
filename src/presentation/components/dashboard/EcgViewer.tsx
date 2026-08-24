import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ECGCanvas } from '../canvas/ECGCanvas';
import { useLazyEcgPaths } from '../../../application/hooks/useLazyEcgPaths';
import { useTranslation } from '../../../application/hooks/useTranslation';
import { type FilterStates, DEFAULT_FILTERS } from '../../../core/algorithms/ecgFilters';

interface EcgViewerProps {
    segment: any;
    speed?: 25 | 50;
    timeOffset?: number;
    classResult?: string;
}

export const EcgViewer: React.FC<EcgViewerProps> = ({ segment, speed = 25, timeOffset = 0, classResult }) => {
    const { t } = useTranslation();
    
    // Medical Configuration States
    const [gain, setGain] = useState<number>(10); // 5 | 10 | 20 mm/mV
    const [paperSpeed, setPaperSpeed] = useState<number>(25); // 12.5 | 25 | 50 mm/s

    // Filter Configurations
    const [isFilterOn, setIsFilterOn] = useState<boolean>(true);
    const [activeFilters, setActiveFilters] = useState<FilterStates>(DEFAULT_FILTERS);
    const [showFilterMenu, setShowFilterMenu] = useState<boolean>(false);
    const filterMenuRef = useRef<HTMLDivElement>(null);

    // Determine raw samples
    const samples = segment?.payload?.ecg?.samples || segment?.payload?.raw?.ch1 || [];
    const ch2 = segment?.payload?.raw?.ch2 || [];
    const ch3 = segment?.payload?.raw?.ch3 || [];

    // Calculate paths lazily based on current segment, medical configs, and filters
    const paths = useLazyEcgPaths(samples, ch2, ch3, gain, paperSpeed, isFilterOn, activeFilters);
    const rPeaks = segment?.rPeaks || [];

    // Playback Animation States
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [visibleCount, setVisibleCount] = useState<number>(0);
    const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x or 2x

    const animRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const startCountRef = useRef<number>(0);

    // Reset when segment changes (default to fully loaded visual)
    useEffect(() => {
        setIsPlaying(false);
        if (animRef.current) {
            cancelAnimationFrame(animRef.current);
            animRef.current = null;
        }
        setVisibleCount(samples.length);
    }, [segment, samples.length]);

    // Clean up animation on unmount
    useEffect(() => {
        return () => {
            if (animRef.current) {
                cancelAnimationFrame(animRef.current);
            }
        };
    }, []);

    // Handle clicking outside filter menu to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
                setShowFilterMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const animate = (time: number) => {
        if (!startTimeRef.current) {
            startTimeRef.current = time;
        }
        
        const elapsed = (time - startTimeRef.current) / 1000; // seconds
        const rate = 250 * playbackSpeed; // 250 Hz sampling rate * speed multiplier
        const nextCount = Math.min(samples.length, Math.floor(startCountRef.current + elapsed * rate));

        setVisibleCount(nextCount);

        if (nextCount < samples.length) {
            animRef.current = requestAnimationFrame(animate);
        } else {
            setIsPlaying(false);
        }
    };

    const handlePlayPause = () => {
        if (isPlaying) {
            setIsPlaying(false);
            if (animRef.current) cancelAnimationFrame(animRef.current);
        } else {
            let startFrom = visibleCount;
            if (visibleCount >= samples.length) {
                startFrom = 0;
                setVisibleCount(0);
            }
            setIsPlaying(true);
            startTimeRef.current = 0;
            startCountRef.current = startFrom;
            animRef.current = requestAnimationFrame(animate);
        }
    };

    const handleReplay = () => {
        setIsPlaying(true);
        setVisibleCount(0);
        startTimeRef.current = 0;
        startCountRef.current = 0;
        if (animRef.current) cancelAnimationFrame(animRef.current);
        animRef.current = requestAnimationFrame(animate);
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value, 10);
        setVisibleCount(val);
        if (isPlaying) {
            setIsPlaying(false);
            if (animRef.current) cancelAnimationFrame(animRef.current);
        }
    };

    const changeSpeed = (speedMultiplier: number) => {
        setPlaybackSpeed(speedMultiplier);
        if (isPlaying) {
            // Update reference points to keep animation linear without jumping
            startTimeRef.current = 0;
            startCountRef.current = visibleCount;
        }
    };

    const toggleSubFilter = (filterKey: keyof FilterStates, val: boolean) => {
        setActiveFilters(prev => ({
            ...prev,
            [filterKey]: val
        }));
    };

    // Slice paths and rPeaks based on visible count for animation drawing
    const slicedPaths = useMemo(() => {
        if (visibleCount >= samples.length) return paths;
        return {
            I: paths.I.slice(0, visibleCount),
            II: paths.II.slice(0, visibleCount),
            III: paths.III.slice(0, visibleCount),
            aVR: paths.aVR.slice(0, visibleCount),
            aVL: paths.aVL.slice(0, visibleCount),
            aVF: paths.aVF.slice(0, visibleCount),
            V1: paths.V1.slice(0, visibleCount),
        };
    }, [paths, visibleCount, samples.length]);

    const slicedRPeaks = useMemo(() => {
        if (visibleCount >= samples.length) return rPeaks;
        // Map visibleCount fraction to coordinate scale based on paperSpeed
        const canvasWidth = 10 * paperSpeed * 8;
        const maxVisibleX = (visibleCount / samples.length) * canvasWidth;
        return rPeaks.filter((p: any) => p.x <= maxVisibleX);
    }, [rPeaks, visibleCount, samples.length, paperSpeed]);

    const progressPercentage = Math.round((visibleCount / (samples.length || 1)) * 100) || 0;
    const currentTimeStr = `${(visibleCount / 250).toFixed(1)}s`;
    const totalTimeStr = `${(samples.length / 250).toFixed(1)}s`;

    return (
        <div className="relative flex flex-col flex-1 h-full w-full">
            {/* The main scrollable canvas wrapper */}
            <div className="flex-1 min-h-0 relative flex flex-col">
                <ECGCanvas 
                    paths={slicedPaths} 
                    rPeaks={slicedRPeaks} 
                    speed={speed} 
                    paperSpeed={paperSpeed}
                    gain={gain}
                    isAnomaly={segment?.isAnomaly || false}
                    classResult={classResult} 
                    timeOffset={timeOffset} 
                />

                {/* Active Filters Overlay Badge (Medical Standard Visual) */}
                <div className="absolute top-3 right-3 z-30 pointer-events-none select-none flex flex-wrap gap-1.5 max-w-[70%] justify-end">
                    {isFilterOn ? (
                        <>
                            <span className="bg-blue-50/90 backdrop-blur-xs border border-blue-100/50 text-clinical-blue text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs">
                                Filter: ON
                            </span>
                            {activeFilters.baseline && (
                                <span className="bg-emerald-50/90 backdrop-blur-xs border border-emerald-100/50 text-emerald-600 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs">
                                    Baseline
                                </span>
                            )}
                            {activeFilters.denoise && (
                                <span className="bg-emerald-50/90 backdrop-blur-xs border border-emerald-100/50 text-emerald-600 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs">
                                    Denoise
                                </span>
                            )}
                            {activeFilters.bandpass && (
                                <span className="bg-emerald-50/90 backdrop-blur-xs border border-emerald-100/50 text-emerald-600 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs">
                                    Bandpass
                                </span>
                            )}
                            {activeFilters.normalization && (
                                <span className="bg-purple-50/90 backdrop-blur-xs border border-purple-100/50 text-purple-600 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs">
                                    Normalized
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="bg-amber-50/90 backdrop-blur-xs border border-amber-100/50 text-amber-600 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs">
                            Raw Data (No Filters)
                        </span>
                    )}
                </div>
            </div>

            {/* Playback Control Bar */}
            {samples.length > 0 && (
                <div className="flex-shrink-0 bg-white border-t border-clinical-charcoal/5 px-6 py-3.5 flex flex-col xl:flex-row items-center justify-between gap-4 z-20 select-none">
                    {/* Left: Controls & Time Indicator */}
                    <div className="flex items-center gap-3 w-full xl:w-auto justify-between xl:justify-start">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePlayPause}
                                className="flex items-center justify-center bg-clinical-blue text-white rounded-full w-10 h-10 hover:bg-clinical-blue/90 active:scale-95 transition-all shadow-sm outline-none"
                                title={isPlaying ? t('history.pause') : t('history.play')}
                            >
                                <span className="material-symbols-outlined text-[22px] font-bold">
                                    {isPlaying ? 'pause' : 'play_arrow'}
                                </span>
                            </button>
                            
                            <button
                                onClick={handleReplay}
                                className="flex items-center justify-center bg-clinical-surface border border-clinical-charcoal/10 text-clinical-charcoal hover:bg-clinical-surface/80 active:scale-95 transition-all rounded-full w-10 h-10 shadow-xs outline-none"
                                title={t('history.replay')}
                            >
                                <span className="material-symbols-outlined text-[18px]">
                                    replay
                                </span>
                            </button>
                        </div>

                        {/* Current/Total time */}
                        <div className="ml-2 flex flex-col justify-center">
                            <span className="text-[9px] font-bold text-clinical-charcoal/40 uppercase tracking-wider leading-none">
                                {t('history.recordingTime')}
                            </span>
                            <span className="font-mono-data text-xs font-bold text-clinical-charcoal mt-1">
                                {currentTimeStr} / {totalTimeStr}
                            </span>
                        </div>
                    </div>

                    {/* Center: Progress Slider */}
                    <div className="flex-1 flex items-center gap-3 w-full px-2">
                        <input 
                            type="range"
                            min={0}
                            max={samples.length}
                            value={visibleCount}
                            onChange={handleSliderChange}
                            className="flex-1 h-1.5 bg-clinical-charcoal/10 rounded-full appearance-none cursor-pointer accent-clinical-blue focus:outline-none transition-all"
                            style={{
                                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(visibleCount / (samples.length || 1)) * 100}%, rgba(0, 0, 0, 0.1) ${(visibleCount / (samples.length || 1)) * 100}%, rgba(0, 0, 0, 0.1) 100%)`
                            }}
                        />
                        <span className="text-xs font-bold text-clinical-charcoal/50 w-10 text-right font-mono-data">
                            {progressPercentage}%
                        </span>
                    </div>

                    {/* Right: Medical Configurations (Gain, Paper Speed, Filters, and Animation Speed) */}
                    <div className="flex items-center gap-3 flex-wrap justify-end w-full xl:w-auto">
                        {/* Interactive Filter Configuration Dropdown */}
                        <div className="flex items-center gap-1 bg-clinical-surface p-1 rounded-full border border-clinical-charcoal/5 relative" ref={filterMenuRef}>
                            <button
                                onClick={() => setIsFilterOn(!isFilterOn)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${isFilterOn ? 'bg-white text-clinical-blue shadow-xs' : 'text-clinical-charcoal/60 hover:text-clinical-charcoal'}`}
                                title={isFilterOn ? 'Matikan Semua Filter' : 'Aktifkan Semua Filter'}
                            >
                                <span className="material-symbols-outlined text-[14px]">
                                    {isFilterOn ? 'filter_alt' : 'filter_alt_off'}
                                </span>
                                Filter: {isFilterOn ? 'ON' : 'OFF'}
                            </button>
                            
                            {isFilterOn && (
                                <button
                                    onClick={() => setShowFilterMenu(!showFilterMenu)}
                                    className={`p-1 hover:bg-clinical-charcoal/5 rounded-full transition-all flex items-center justify-center outline-none ${showFilterMenu ? 'text-clinical-blue' : 'text-clinical-charcoal/55'}`}
                                    title="Pilih Filter Aktif"
                                >
                                    <span className="material-symbols-outlined text-[16px] font-bold">
                                        settings
                                    </span>
                                </button>
                            )}

                            {/* Dropdown Menu for Sub-Filters */}
                            {isFilterOn && showFilterMenu && (
                                <div className="absolute top-full right-0 mt-2 bg-white border border-clinical-charcoal/10 rounded-[1.5rem] p-4 shadow-xl z-[200] min-w-[220px] flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <h4 className="text-[10px] font-bold text-clinical-charcoal/40 uppercase tracking-widest px-1">
                                        Pilih Filter Aktif
                                    </h4>
                                    
                                    <label className="flex items-center gap-2 px-1 hover:bg-clinical-surface/50 py-1.5 rounded cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={activeFilters.baseline}
                                            onChange={(e) => toggleSubFilter('baseline', e.target.checked)}
                                            className="w-3.5 h-3.5 rounded border-gray-300 text-clinical-blue focus:ring-clinical-blue"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-clinical-charcoal">Baseline Blocker</span>
                                            <span className="text-[8px] text-clinical-charcoal/50 leading-none">Menghapus baseline wander (drift)</span>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-2 px-1 hover:bg-clinical-surface/50 py-1.5 rounded cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={activeFilters.denoise}
                                            onChange={(e) => toggleSubFilter('denoise', e.target.checked)}
                                            className="w-3.5 h-3.5 rounded border-gray-300 text-clinical-blue focus:ring-clinical-blue"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-clinical-charcoal">HF Denoise</span>
                                            <span className="text-[8px] text-clinical-charcoal/50 leading-none">Meredam noise otot (frekuensi tinggi)</span>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-2 px-1 hover:bg-clinical-surface/50 py-1.5 rounded cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={activeFilters.bandpass}
                                            onChange={(e) => toggleSubFilter('bandpass', e.target.checked)}
                                            className="w-3.5 h-3.5 rounded border-gray-300 text-clinical-blue focus:ring-clinical-blue"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-clinical-charcoal">Bandpass 0.5-40Hz</span>
                                            <span className="text-[8px] text-clinical-charcoal/50 leading-none">Menjaga sinyal dalam batas klinis</span>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-2 px-1 hover:bg-clinical-surface/50 py-1.5 rounded cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={activeFilters.normalization}
                                            onChange={(e) => toggleSubFilter('normalization', e.target.checked)}
                                            className="w-3.5 h-3.5 rounded border-gray-300 text-clinical-blue focus:ring-clinical-blue"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-clinical-charcoal">Z-Score Norm</span>
                                            <span className="text-[8px] text-clinical-charcoal/50 leading-none">Menyamakan skala amplitudo rata-rata</span>
                                        </div>
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Gain Config */}
                        <div className="flex items-center gap-1.5 bg-clinical-surface p-1 rounded-full border border-clinical-charcoal/5">
                            <span className="text-[9px] font-bold text-clinical-charcoal/40 uppercase tracking-wider px-2 select-none">
                                Gain
                            </span>
                            <button
                                onClick={() => setGain(5)}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${gain === 5 ? 'bg-white text-clinical-blue shadow-xs' : 'text-clinical-charcoal/60 hover:text-clinical-charcoal'}`}
                                title="5 mm/mV (0.5x)"
                            >
                                5
                            </button>
                            <button
                                onClick={() => setGain(10)}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${gain === 10 ? 'bg-white text-clinical-blue shadow-xs' : 'text-clinical-charcoal/60 hover:text-clinical-charcoal'}`}
                                title="10 mm/mV (1x)"
                            >
                                10
                            </button>
                            <button
                                onClick={() => setGain(20)}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${gain === 20 ? 'bg-white text-clinical-blue shadow-xs' : 'text-clinical-charcoal/60 hover:text-clinical-charcoal'}`}
                                title="20 mm/mV (2x)"
                            >
                                20
                            </button>
                        </div>

                        {/* Paper Speed Config */}
                        <div className="flex items-center gap-1.5 bg-clinical-surface p-1 rounded-full border border-clinical-charcoal/5">
                            <span className="text-[9px] font-bold text-clinical-charcoal/40 uppercase tracking-wider px-2 select-none">
                                Speed
                            </span>
                            <button
                                onClick={() => setPaperSpeed(12.5)}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${paperSpeed === 12.5 ? 'bg-white text-clinical-blue shadow-xs' : 'text-clinical-charcoal/60 hover:text-clinical-charcoal'}`}
                                title="12.5 mm/s"
                            >
                                12.5
                            </button>
                            <button
                                onClick={() => setPaperSpeed(25)}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${paperSpeed === 25 ? 'bg-white text-clinical-blue shadow-xs' : 'text-clinical-charcoal/60 hover:text-clinical-charcoal'}`}
                                title="25 mm/s (1x)"
                            >
                                25
                            </button>
                            <button
                                onClick={() => setPaperSpeed(50)}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${paperSpeed === 50 ? 'bg-white text-clinical-blue shadow-xs' : 'text-clinical-charcoal/60 hover:text-clinical-charcoal'}`}
                                title="50 mm/s (2x)"
                            >
                                50
                            </button>
                        </div>

                        {/* Playback Speed Multiplier */}
                        <div className="flex items-center gap-1 bg-clinical-surface p-1 rounded-full border border-clinical-charcoal/5">
                            <button
                                onClick={() => changeSpeed(1)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${playbackSpeed === 1 ? 'bg-white text-clinical-blue shadow-xs' : 'text-clinical-charcoal/60 hover:text-clinical-charcoal'}`}
                                title="1x Speed"
                            >
                                1x
                            </button>
                            <button
                                onClick={() => changeSpeed(2)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${playbackSpeed === 2 ? 'bg-white text-clinical-blue shadow-xs' : 'text-clinical-charcoal/60 hover:text-clinical-charcoal'}`}
                                title="2x Speed"
                            >
                                2x
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
