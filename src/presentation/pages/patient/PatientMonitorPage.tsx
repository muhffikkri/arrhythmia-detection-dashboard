/**
 * @fileoverview Halaman UI: Monitor Page
 * Mengorkestrasi Custom Hook (useECGStream) dan mendistribusikan
 * state ke komponen-komponen UI modular (Clean Architecture).
 * 
 * UPDATE: Penambahan fitur Bypass Filter (ON/OFF) untuk komparasi sinyal mentah.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useECGStream } from '../../../application/hooks/useECGStream';
import { ECGCanvas } from '../../components/canvas/ECGCanvas';
import { TimelineBar } from '../../components/shared/TimelineBar';
import { AlertPanel } from '../../components/shared/AlertPanel';
import { useECGScale } from '../../../application/hooks/useECGScale';
import { PatientHeader } from '../../components/layout/PatientHeader';
import { VitalCard } from '../../components/dashboard/VitalCard';
import { AiCard } from '../../components/dashboard/AiCard';
import { DeviceCard } from '../../components/dashboard/DeviceCard';
import { API_URL, WS_URL } from '../../../config/env';
import { fetchWithAuth } from '../../../config/api';
import { ActionModal } from '../../components/shared/ActionModal';

interface DeviceRecord {
    id: string;
    name: string;
}

export const PatientMonitorPage: React.FC = () => {
    // Destructure isFilterOn dan toggleFilter dari useECGStream
    const {
        isRecording, paths, rPeaks, heartRate, clinicalStatus, timeline,
        startStream, stopStream, fetchSegment, isFilterOn, toggleFilter,
        prediction, deviceId, sessionId, stressTest, createdAt, rawClassification
    } = useECGStream(WS_URL);

    const [currentSegmentIndex, setCurrentSegmentIndex] = useState<number | undefined>(undefined);

    const handleSegmentSelect = (index: number) => {
        setCurrentSegmentIndex(index);
        fetchSegment(index);
    };

    const selectedPatientId = localStorage.getItem('user_id') || '1';
    const aiProbabilities = prediction?.probabilities || null;
    const aiMetrics = { latency_ms: prediction?.latency_ms, runtime: prediction?.runtime };

    const [speed, setSpeed] = useState<12.5 | 25 | 50>(25);
    const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
    const [showAlert, setShowAlert] = useState<boolean>(false);
    
    // Filter Popup State
    const [showFilterPopup, setShowFilterPopup] = useState<boolean>(false);
    const [filterConfig, setFilterConfig] = useState({
        baselineBlocker: true,
        hfDenoise: true,
        bandpass: true,
        zScoreNorm: false
    });

    // Animasi Playback
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [visibleCount, setVisibleCount] = useState<number>(0);
    const animRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const startCountRef = useRef<number>(0);
    const TOTAL_SAMPLES = 2500;

    useEffect(() => {
        if (isRecording) {
            setVisibleCount(paths.I.length);
            setIsPlaying(false);
            if (animRef.current) {
                cancelAnimationFrame(animRef.current);
                animRef.current = null;
            }
        }
    }, [isRecording, paths.I.length]);

    useEffect(() => {
        if (!isRecording && currentSegmentIndex !== undefined) {
            setVisibleCount(paths.I.length);
            setIsPlaying(false);
            if (animRef.current) {
                cancelAnimationFrame(animRef.current);
                animRef.current = null;
            }
        }
    }, [currentSegmentIndex, isRecording, paths.I.length]);

    const animate = (time: number) => {
        if (!startTimeRef.current) startTimeRef.current = time;
        const elapsed = (time - startTimeRef.current) / 1000;
        const rate = 250 * playbackSpeed;
        const targetLength = isRecording ? paths.I.length : TOTAL_SAMPLES;
        const nextCount = Math.min(targetLength, Math.floor(startCountRef.current + elapsed * rate));

        setVisibleCount(nextCount);

        if (nextCount < targetLength) {
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
            const targetLength = isRecording ? paths.I.length : TOTAL_SAMPLES;
            let startFrom = visibleCount;
            if (visibleCount >= targetLength) {
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

    const slicedPaths = React.useMemo(() => {
        if (visibleCount >= paths.I.length) return paths;
        return {
            I: paths.I.slice(0, visibleCount),
            II: paths.II.slice(0, visibleCount),
            III: paths.III.slice(0, visibleCount),
            aVR: paths.aVR.slice(0, visibleCount),
            aVL: paths.aVL.slice(0, visibleCount),
            aVF: paths.aVF.slice(0, visibleCount),
            V1: paths.V1.slice(0, visibleCount),
        };
    }, [paths, visibleCount]);

    const slicedRPeaks = React.useMemo(() => {
        if (visibleCount >= paths.I.length) return rPeaks;
        const canvasWidth = 10 * speed * 8; 
        const maxVisibleX = (visibleCount / TOTAL_SAMPLES) * canvasWidth;
        return rPeaks.filter((p: any) => p.x <= maxVisibleX);
    }, [rPeaks, visibleCount, paths.I.length, speed]);

    // Gain override untuk 5, 10, 20
    const [gain, setGain] = useState<number>(10);
    const scale = gain / 10;

    useEffect(() => {
        const isNormal = rawClassification?.toUpperCase() === 'NORMAL' || rawClassification?.toUpperCase() === 'NORM';
        setShowAlert(clinicalStatus?.isAnomaly && !isNormal ? true : false);
    }, [clinicalStatus, rawClassification]);

    // Check if we need to show warning
    const [showDeviceWarning, setShowDeviceWarning] = useState(false);
    const [onlineDevices, setOnlineDevices] = useState<DeviceRecord[]>([]);

    useEffect(() => {
        const fetchDevices = () => {
            fetchWithAuth(`/api/devices`)
                .then(res => res.json())
                .then(data => {
                    const devicesArray = Array.isArray(data.devices) ? data.devices : (Array.isArray(data) ? data : []);
                    const online = devicesArray.filter((d: any) => d.status === 'Online' || d.status === 'Active');
                    setOnlineDevices(online);
                    if (online.length > 0) {
                        // The device doesn't necessarily need to be assigned to the dropdown anymore.
                        // We will just use the first available device, or if the backend enforces assignment, it's handled there.
                    }
                })
                .catch(err => console.error("Error fetching devices:", err));
        };
        fetchDevices();

        // Auto-resume if there is an active session
        fetchWithAuth(`/api/sessions`)
            .then(res => res.json())
            .then(data => {
                const sessionsArray = data.data || data.sessions || (Array.isArray(data) ? data : []);
                const activeSessions = sessionsArray.filter((s: any) => !s.ended_at);
                if (activeSessions.length > 0) {
                    // startStream(); // Disabled to not automatically start recording
                }
            })
            .catch(err => console.error("Error fetching sessions for auto-resume:", err));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const syncedDeviceId = localStorage.getItem('synced_device_id');
    const displayDeviceId = deviceId !== "MENUNGGU PERANGKAT..."
        ? deviceId
        : (syncedDeviceId || (onlineDevices.length > 0 ? onlineDevices[0].name : "MENUNGGU PERANGKAT..."));

    useEffect(() => {
        if (displayDeviceId === "MENUNGGU PERANGKAT...") {
            setShowDeviceWarning(true);
        }
    }, [displayDeviceId]);

    const [isCommandLoading, setIsCommandLoading] = useState(false);

    const [actionModal, setActionModal] = useState<{
        isOpen: boolean;
        type: 'confirm' | 'success' | 'error' | 'warning';
        title: string;
        message: React.ReactNode;
        onConfirm?: () => void;
    }>({
        isOpen: false,
        type: 'confirm',
        title: '',
        message: ''
    });

    const closeActionModal = () => {
        if (!isCommandLoading) setActionModal(prev => ({ ...prev, isOpen: false }));
    };

    const handleToggleRecord = () => {
        if (!isRecording && !selectedPatientId) {
            alert("Harap pilih pasien terlebih dahulu sebelum memulai perekaman.");
            return;
        }

        if (isRecording) {
            setActionModal({
                isOpen: true,
                type: 'warning',
                title: 'Akhiri Rekaman?',
                message: 'Apakah Anda yakin ingin mengakhiri sesi pemantauan ini? Sistem akan mulai memproses data.',
                onConfirm: executeToggleRecord
            });
        } else {
            executeToggleRecord();
        }
    };

    const executeToggleRecord = async () => {
        const command = isRecording ? "STOP" : "START";

        // Optimistic UI update: Langsung ubah state saat diklik
        if (isRecording) {
            stopStream();
        } else {
            startStream();
        }

        setIsCommandLoading(true);
        try {
            let targetDeviceId = displayDeviceId;

            // Jika sedang stop (akhiri rekaman) tapi status perangkat "MENUNGGU PERANGKAT...",
            // kita harus mencari tahu device_id dari sesi aktif di DB agar bisa memberitahu backend untuk mengisi ended_at.
            if (command === "STOP" && targetDeviceId === "MENUNGGU PERANGKAT...") {
                const sessRes = await fetchWithAuth(`/api/sessions`);
                if (sessRes.ok) {
                    const sessData = await sessRes.json();
                    const sessionsArray = sessData.data || sessData.sessions || (Array.isArray(sessData) ? sessData : []);
                    const activeSession = sessionsArray.find((s: any) => !s.ended_at && s.patient_id === selectedPatientId);
                    if (activeSession) {
                        targetDeviceId = activeSession.device_id;
                    }
                }
            }

            if (targetDeviceId && targetDeviceId !== "MENUNGGU PERANGKAT...") {
                await fetchWithAuth(`/api/devices/${targetDeviceId}/command`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command, patient_id: selectedPatientId })
                });
            }

            if (command === 'STOP') {
                setActionModal({
                    isOpen: true,
                    type: 'success',
                    title: 'Sesi Diakhiri',
                    message: 'Berhasil mengakhiri rekaman.',
                    onConfirm: closeActionModal
                });
            }
        } catch (error: any) {
            console.error("Gagal mengirim command", error);
            if (command === 'STOP') {
                setActionModal({
                    isOpen: true,
                    type: 'error',
                    title: 'Gagal Mengakhiri Sesi',
                    message: error.message || 'Koneksi ke server gagal.',
                    onConfirm: closeActionModal
                });
            } else {
                alert("Gagal memulai perekaman: " + (error.message || 'Server error'));
            }
        } finally {
            setIsCommandLoading(false);
        }
    };

    const alertTitle = clinicalStatus ? clinicalStatus.fullExplanation.split('.')[0] : 'Anomali Terdeteksi';
    const aiClassResult = rawClassification || (clinicalStatus ? clinicalStatus.fullExplanation.split(' ')[2] : 'NORM');

    return (
        <div className="bg-clinical-surface/30 text-clinical-charcoal antialiased min-h-screen flex flex-col transition-colors duration-700 relative">
            <div className="absolute inset-0 ecg-grid opacity-[0.15] z-0 pointer-events-none"></div>

            <div className="relative z-10 flex flex-col flex-1">
                <PatientHeader />

                {/* Popup Peringatan Perangkat Belum Terhubung */}
                {showDeviceWarning && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-clinical-charcoal/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white border border-clinical-charcoal/5 rounded-[2rem] p-8 shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-50 fade-in duration-500 ease-spring text-center">
                            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-6 text-clinical-red mx-auto border border-red-100">
                                <span className="material-symbols-outlined text-3xl">warning</span>
                            </div>
                            <h3 className="text-xl font-bold font-display text-clinical-charcoal mb-2">Perangkat Belum Terhubung</h3>
                            <p className="text-sm font-medium text-clinical-charcoal/60 mb-8 leading-relaxed">
                                Sistem mendeteksi belum ada perangkat EKG yang tersinkronisasi. Pastikan Anda menghubungkan perangkat agar proses perekaman dapat berjalan dengan valid.
                            </p>
                            <div className="flex flex-col gap-3">
                                <a
                                    href="/patient/scanner"
                                    className="w-full py-3.5 rounded-lg font-bold text-[13px] bg-clinical-blue text-white hover:brightness-110 transition-colors shadow-sm hover:shadow-[0px_10px_20px_rgba(23,107,206,0.2)] block text-center"
                                >
                                    Sinkronkan Sekarang
                                </a>
                                <button
                                    onClick={() => setShowDeviceWarning(false)}
                                    className="w-full py-3.5 rounded-lg font-bold text-[13px] bg-clinical-surface hover:brightness-95 text-clinical-charcoal transition-colors"
                                >
                                    Abaikan
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <AlertPanel
                    visible={showAlert}
                    title={`KRITIS: ${alertTitle}`}
                    onClose={() => setShowAlert(false)}
                />

                <main className="w-full max-w-container-max pt-8 pb-16 mx-auto px-margin-mobile md:px-margin-desktop flex flex-col gap-8 flex-1">

                    <section className="w-full flex flex-col gap-5 flex-1">
                        <div className="bg-white rounded-[2rem] px-6 py-4 flex flex-wrap justify-between items-center shadow-[0px_20px_40px_rgba(0,0,0,0.04)] border border-clinical-charcoal/5 gap-4 transition-all duration-700">
                            
                            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto overflow-x-auto custom-scrollbar pb-2 lg:pb-0">
                            </div>

                            <div className="flex items-center justify-end w-full lg:w-auto">
                                <button
                                    disabled={isCommandLoading}
                                    onClick={handleToggleRecord}
                                    className={`${isRecording ? 'bg-clinical-red shadow-clinical-red/20' : 'bg-clinical-blue shadow-clinical-blue/20'} text-white px-8 py-3 rounded-full font-bold uppercase tracking-widest text-[11px] shadow-sm transition-all duration-500 flex items-center gap-2 outline-none hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 ${isCommandLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {isCommandLoading ? (
                                        <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span> <span className="hidden sm:inline">Mengirim...</span></>
                                    ) : isRecording ? (
                                        <><span className="material-symbols-outlined text-[18px]">stop_circle</span> <span className="hidden sm:inline">Hentikan Perekaman</span></>
                                    ) : (
                                        <><span className="material-symbols-outlined text-[18px]">play_circle</span> <span className="hidden sm:inline">Mulai Perekaman</span></>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="relative flex-1 min-h-[560px] md:min-h-[600px] group flex flex-col bg-white border border-clinical-charcoal/5 rounded-[2rem] shadow-[0px_20px_40px_rgba(0,0,0,0.04)] transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1 overflow-hidden">
                            <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
                                <ECGCanvas
                                    paths={slicedPaths}
                                    rPeaks={slicedRPeaks}
                                    speed={speed}
                                    paperSpeed={speed}
                                    isAnomaly={clinicalStatus?.isAnomaly}
                                    classResult={aiClassResult}
                                    scale={scale}
                                />
                            </div>

                            {/* Playback Control Bar */}
                            <div className="flex-shrink-0 bg-white border-t border-clinical-charcoal/5 px-6 py-3.5 flex flex-col xl:flex-row items-center justify-between gap-4 z-20 select-none">
                                {/* Left: Controls & Time Indicator */}
                                <div className="flex items-center gap-3 w-full xl:w-auto justify-between xl:justify-start">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handlePlayPause}
                                            className="flex items-center justify-center bg-clinical-blue text-white rounded-full w-10 h-10 hover:bg-clinical-blue/90 active:scale-95 transition-all shadow-sm outline-none"
                                        >
                                            <span className="material-symbols-outlined text-[22px] font-bold">
                                                {isPlaying ? 'pause' : 'play_arrow'}
                                            </span>
                                        </button>
                                        
                                        <button
                                            onClick={handleReplay}
                                            className="flex items-center justify-center bg-clinical-surface border border-clinical-charcoal/10 text-clinical-charcoal hover:bg-clinical-surface/80 active:scale-95 transition-all rounded-full w-10 h-10 shadow-xs outline-none"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">
                                                replay
                                            </span>
                                        </button>
                                        
                                        {/* Filter Toggle */}
                                        <div className="relative z-[9999]">
                                            <button
                                                onClick={() => setShowFilterPopup(!showFilterPopup)}
                                                className={`h-10 px-4 rounded-full font-bold uppercase tracking-wider text-[10px] transition-all duration-300 flex items-center justify-center gap-2 outline-none hover:-translate-y-0.5 hover:shadow-sm border ${isFilterOn || filterConfig.baselineBlocker || filterConfig.hfDenoise || filterConfig.zScoreNorm ? 'bg-blue-50 text-clinical-blue border-blue-100' : 'bg-clinical-surface text-clinical-charcoal/60 border-clinical-charcoal/10'}`}
                                                title="Konfigurasi Filter Sinyal"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">
                                                    {isFilterOn ? 'filter_alt' : 'filter_alt_off'}
                                                </span>
                                            </button>
                                            
                                            {showFilterPopup && (
                                                <div className="absolute bottom-full mb-2 left-0 w-56 bg-white border border-clinical-charcoal/10 rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.2)] py-3 px-4 z-[9999] flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                    <h4 className="text-[10px] font-bold text-clinical-charcoal/40 uppercase tracking-wider mb-1">Konfigurasi Filter</h4>
                                                    
                                                    <label className="flex items-center justify-between cursor-pointer group">
                                                        <span className="text-xs font-bold text-clinical-charcoal group-hover:text-clinical-blue transition-colors">Baseline Blocker</span>
                                                        <input type="checkbox" checked={filterConfig.baselineBlocker} onChange={() => setFilterConfig(p => ({...p, baselineBlocker: !p.baselineBlocker}))} className="accent-clinical-blue w-4 h-4 rounded" />
                                                    </label>
                                                    
                                                    <label className="flex items-center justify-between cursor-pointer group">
                                                        <span className="text-xs font-bold text-clinical-charcoal group-hover:text-clinical-blue transition-colors">HF Denoise</span>
                                                        <input type="checkbox" checked={filterConfig.hfDenoise} onChange={() => setFilterConfig(p => ({...p, hfDenoise: !p.hfDenoise}))} className="accent-clinical-blue w-4 h-4 rounded" />
                                                    </label>
                                                    
                                                    <label className="flex items-center justify-between cursor-pointer group">
                                                        <span className="text-xs font-bold text-clinical-charcoal group-hover:text-clinical-blue transition-colors">Bandpass 0.5-40Hz</span>
                                                        <input type="checkbox" checked={filterConfig.bandpass} onChange={() => {
                                                            const newVal = !filterConfig.bandpass;
                                                            setFilterConfig(p => ({...p, bandpass: newVal}));
                                                            if (isFilterOn !== newVal) toggleFilter();
                                                        }} className="accent-clinical-blue w-4 h-4 rounded" />
                                                    </label>
                                                    
                                                    <label className="flex items-center justify-between cursor-pointer group">
                                                        <span className="text-xs font-bold text-clinical-charcoal group-hover:text-clinical-blue transition-colors">Z-Score Norm</span>
                                                        <input type="checkbox" checked={filterConfig.zScoreNorm} onChange={() => setFilterConfig(p => ({...p, zScoreNorm: !p.zScoreNorm}))} className="accent-clinical-blue w-4 h-4 rounded" />
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="ml-2 flex flex-col justify-center">
                                        <span className="text-[9px] font-bold text-clinical-charcoal/40 uppercase tracking-wider leading-none">
                                            WAKTU REKAMAN
                                        </span>
                                        <span className="font-mono-data text-xs font-bold text-clinical-charcoal mt-1">
                                            {(visibleCount / 250).toFixed(1)}s / {(paths.I.length / 250).toFixed(1)}s
                                        </span>
                                    </div>
                                </div>

                                {/* Center: Progress Slider */}
                                <div className="flex-1 flex items-center gap-3 w-full px-2">
                                    <input 
                                        type="range"
                                        min={0}
                                        max={TOTAL_SAMPLES}
                                        value={visibleCount}
                                        onChange={handleSliderChange}
                                        className="flex-1 h-1.5 bg-clinical-charcoal/10 rounded-full appearance-none cursor-pointer accent-clinical-blue focus:outline-none transition-all"
                                        style={{
                                            background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(visibleCount / TOTAL_SAMPLES) * 100}%, rgba(0, 0, 0, 0.1) ${(visibleCount / TOTAL_SAMPLES) * 100}%, rgba(0, 0, 0, 0.1) 100%)`
                                        }}
                                    />
                                    <span className="text-xs font-bold text-clinical-charcoal/50 w-10 text-right font-mono-data">
                                        {Math.round((visibleCount / TOTAL_SAMPLES) * 100)}%
                                    </span>
                                </div>

                                {/* Right: Medical Configurations (Gain, Paper Speed, Playback Speed) */}
                                <div className="flex items-center gap-3 flex-wrap justify-end w-full xl:w-auto">
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
                                            onClick={() => setSpeed(12.5)}
                                            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${speed === 12.5 ? 'bg-white text-clinical-blue shadow-xs' : 'text-clinical-charcoal/60 hover:text-clinical-charcoal'}`}
                                        >
                                            12.5
                                        </button>
                                        <button
                                            onClick={() => setSpeed(25)}
                                            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${speed === 25 ? 'bg-white text-clinical-blue shadow-xs' : 'text-clinical-charcoal/60 hover:text-clinical-charcoal'}`}
                                        >
                                            25
                                        </button>
                                        <button
                                            onClick={() => setSpeed(50)}
                                            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${speed === 50 ? 'bg-white text-clinical-blue shadow-xs' : 'text-clinical-charcoal/60 hover:text-clinical-charcoal'}`}
                                        >
                                            50
                                        </button>
                                    </div>

                                    {/* Playback Speed Multiplier */}
                                    <div className="flex items-center gap-1 bg-clinical-surface p-1 rounded-full border border-clinical-charcoal/5">
                                        <span className="text-[9px] font-bold text-clinical-charcoal/40 uppercase tracking-wider px-2 select-none">
                                            Playback
                                        </span>
                                        <button
                                            onClick={() => setPlaybackSpeed(1)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${playbackSpeed === 1 ? 'bg-white text-clinical-blue shadow-xs' : 'text-clinical-charcoal/60 hover:text-clinical-charcoal'}`}
                                        >
                                            1x
                                        </button>
                                        <button
                                            onClick={() => setPlaybackSpeed(2)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${playbackSpeed === 2 ? 'bg-white text-clinical-blue shadow-xs' : 'text-clinical-charcoal/60 hover:text-clinical-charcoal'}`}
                                        >
                                            2x
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <TimelineBar events={timeline} currentIdx={currentSegmentIndex} onSegmentSelect={handleSegmentSelect} />
                    </section>

                    <aside className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
                        <VitalCard heartRate={heartRate} clinicalStatus={clinicalStatus} stressTest={stressTest} createdAt={createdAt} />
                        <AiCard sessionId={sessionId} rawClassification={rawClassification} />
                        <DeviceCard deviceId={displayDeviceId} aiMetrics={aiMetrics} />
                    </aside>
                </main>
            </div>
            
            <ActionModal 
                isOpen={actionModal.isOpen}
                type={actionModal.type}
                title={actionModal.title}
                message={actionModal.message}
                onConfirm={actionModal.onConfirm}
                onClose={closeActionModal}
                isLoading={isCommandLoading}
            />
        </div>
    );
};