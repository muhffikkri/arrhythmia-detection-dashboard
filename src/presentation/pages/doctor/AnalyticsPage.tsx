/**
 * @fileoverview Halaman UI: Analytics & History Page
 * Berfungsi untuk meninjau ulang rekaman EKG pasien dari masa lalu (Historical Review).
 * Dokter dapat menavigasi segmen 10-detik spesifik menggunakan Timeline Bar.
 */

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { EcgViewer } from '../../components/dashboard/EcgViewer';
import { useCachedFetch } from '../../../application/hooks/useCachedFetch';
import { TimelineBar } from '../../components/shared/TimelineBar';
import type { ECGPaths, RPeakMarker, TimelineEvent } from '../../../core/types/ecgTypes';
import { calculateEinthovenPoint } from '../../../core/algorithms/einthoven';
import { PanTompkins } from '../../../core/algorithms/panTompkins';
import { DCBlocker } from '../../../core/algorithms/dcBlocker';
import { evaluateIrregularity } from '../../../core/clinical/ruleBasedEngine';
import { DoctorSidebar } from '../../components/layout/DoctorSidebar';
import { useSidebar } from '../../../application/context/SidebarContext';
import { useConnection } from '../../../application/context/ConnectionContext';
import { Pagination } from '../../components/shared/Pagination';
import { useStickyState } from '../../../application/hooks/useStickyState';
import { VitalCard } from '../../components/dashboard/VitalCard';
import { AiCard } from '../../components/dashboard/AiCard';
import { DeviceCard } from '../../components/dashboard/DeviceCard';
import type { ClinicalExplanation } from '../../../core/clinical/ruleBasedEngine';
import { API_URL } from '../../../config/env';
import { fetchWithAuth } from '../../../config/api';
import { supabase } from '../../../config/supabaseClient';

const useQuery = () => new URLSearchParams(useLocation().search);

const SessionPatientAvatar: React.FC<{ patientId: string | number, patientName: string }> = ({ patientId, patientName }) => {
    const { data: profile } = useCachedFetch<any>(`/api/patients/${patientId}`);
    const photo = profile?.patient?.profile_photo || profile?.profile_photo || null;
    return photo ? (
        <img src={photo} alt={patientName || ''} className="w-full h-full object-cover" />
    ) : (
        <>{patientName ? patientName.substring(0, 2) : 'UK'}</>
    );
};

export const AnalyticsPage: React.FC = () => {
    const query = useQuery();
    const sessionId = query.get('sessionId') || '';
    const navigate = useNavigate();

    const [speed, setSpeed] = useState<25 | 50>(25);
    const [selectedIdx, setSelectedIdx] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [showPatientSelector, setShowPatientSelector] = useState(!sessionId);
    const [selectedPatientFilter, setSelectedPatientFilter] = useState<string>('ALL');

    const { isOpen, toggleSidebar } = useSidebar();
    const { connectedPatients } = useConnection();

    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loadingAI, setLoadingAI] = useState<Record<string, boolean>>({});

    // Pagination
    const [currentPage, setCurrentPage] = useStickyState(1, 'doctorAnalyticsSidebarPage');
    const itemsPerPage = 10;
    
    const [segments, setSegments] = useState<Record<number, any>>({});
    
    const [sessionValidations, setSessionValidations] = useState<Record<string, { total: number, validated: number }>>({});
    
    // ECG Paper state
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const role = localStorage.getItem('user_role');
    const userId = localStorage.getItem('user_id');
    const sessionsUrl = selectedPatientFilter === 'ALL'
        ? (role === 'dokter' ? `/api/sessions?doctor_id=${userId}&page=${currentPage}&limit=${itemsPerPage}` : `/api/sessions?page=${currentPage}&limit=${itemsPerPage}`)
        : `/api/patients/${selectedPatientFilter}/sessions?page=${currentPage}&limit=${itemsPerPage}`;

    const { data: sessionsResponse, isLoading: loadingSessions } = useCachedFetch(sessionId ? null : sessionsUrl, { keepPreviousData: true });
    
    // Derived state
    const allSessionsFetched = sessionsResponse?.data || sessionsResponse?.sessions || (Array.isArray(sessionsResponse) ? sessionsResponse : []);
    const totalSessions = sessionsResponse?.pagination?.total || sessionsResponse?.total_sessions || allSessionsFetched.length;
    const totalPages = Math.ceil(totalSessions / itemsPerPage) || 1;
    // Paginasi manual (client-side) jika selectedPatientFilter !== 'ALL'
    const allSessions = allSessionsFetched;

    useEffect(() => {
        if (!loadingSessions && totalPages > 0 && currentPage > totalPages) {
            setCurrentPage(1);
        }
    }, [totalPages, currentPage, setCurrentPage, loadingSessions]);

    useEffect(() => {
        if (allSessions.length > 0) {
            const sessionIds = allSessions.map((s: any) => s.id);
            if (sessionIds.length > 0) {
                supabase.rpc('get_sessions_validation_counts', { session_ids: sessionIds })
                    .then(({ data: stats, error }) => {
                        if (!error && stats) {
                            const counts: Record<string, { total: number, validated: number }> = {};
                            sessionIds.forEach((id: any) => counts[id] = { total: 0, validated: 0 });
                            stats.forEach((st: any) => {
                                counts[st.session_id] = {
                                    total: Number(st.total_frames) || 0,
                                    validated: Number(st.validated_frames) || 0
                                };
                            });
                            setSessionValidations(counts);
                        } else {
                            console.error("RPC Error:", error);
                        }
                    });
            }
        }
    }, [allSessions]);

    const { data: recordsData, isLoading: loadingRecords } = useCachedFetch(sessionId ? `/api/records/${sessionId}` : null);
    
    // Gunakan SWR manual untuk Supabase agar ikut ter-cache
    const { data: frameRecordsData, isLoading: loadingFrames } = useSWR(
        sessionId ? `supabase_frame_records_${sessionId}` : null, 
        async () => {
            const { data } = await supabase.from('frame_records').select('*').eq('session_id', sessionId);
            return data;
        },
        { revalidateOnFocus: false } // Hindari refetch query supabase terus menerus
    );

    useEffect(() => {
        if (!sessionId) {
            setIsLoading(false);
            return;
        }

        if (!recordsData || !frameRecordsData) {
            setIsLoading(true);
            return;
        }

        const data = recordsData;
        const frameRecords = frameRecordsData;

        const loadedEvents: TimelineEvent[] = [];
                const loadedSegments: Record<number, any> = {};
                
                const pt = new PanTompkins(250);
                const globalDcBlocker = new DCBlocker(); // Jalur Matematis: Kontinu tanpa reset antar-frame
                let lastPeakIndex = -1;
                let absoluteIndexOffset = 0;
                
                const labelMap = new Map();
                const hiddenMap = new Map();
                if (frameRecords) {
                    frameRecords.forEach(fr => {
                        labelMap.set(fr.start_time, fr.label);
                        hiddenMap.set(fr.start_time, fr.hidden);
                    });
                }

                // Filter data to exclude hidden frames
                const validData = data.filter((payload: any, originalIndex: number) => {
                    const startTime = originalIndex * 10;
                    return !hiddenMap.get(startTime);
                });

                validData.forEach((payload: any, i: number) => {
                    const originalIndex = data.indexOf(payload);
                    const startTime = originalIndex * 10;
                    const dbLabel = labelMap.get(startTime);
                    
                    const isDbLabelAnomaly = dbLabel && dbLabel !== "Normal" && dbLabel !== "NORM" && dbLabel !== "NSR";
                    const isPayloadAnomaly = (payload.anomaly_indices && payload.anomaly_indices.length > 0) ||
                        (payload.prediction?.label && payload.prediction.label !== "Normal" && payload.prediction.label !== "NORM") || false;
                    
                    const isAnomaly = dbLabel ? isDbLabelAnomaly : isPayloadAnomaly;
                    const classResult = dbLabel || payload.prediction?.label || payload.classification_result || "NORM";

                    loadedEvents.push({
                        index: i,
                        timeStr: `${Math.floor(i / 6).toString().padStart(2, '0')}:${((i % 6) * 10).toString().padStart(2, '0')}`,
                        isAnomaly,
                        classResult
                    });
                    
                    let xIndex = 0;
                    const TOTAL_POINTS = 2500;
                    const X_STEP = 2000 / TOTAL_POINTS;
                    const samples = payload.ecg?.samples || payload.raw?.ch1 || [];
                    const ch2 = payload.raw?.ch2 || [];
                    const ch3 = payload.raw?.ch3 || [];

                    const rrIntervals: number[] = [];
                    for (let j = 0; j < samples.length; j++) {
                        let finalI, finalII, finalIII;
                        if (Array.isArray(samples[j])) {
                            finalI = samples[j][0] || 0;
                            finalII = samples[j][1] || 0;
                            finalIII = samples[j][2] || 0;
                        } else {
                            finalI = samples[j] || 0;
                            finalII = ch2[j] || 0;
                            finalIII = ch3[j] || 0;
                        }

                        // JALUR MATEMATIS (KONTINU): Hitung DC Blocker kontinu lalu umpankan ke PanTompkins
                        const mathCleaned = globalDcBlocker.process(finalI, finalII);
                        let absoluteJ = absoluteIndexOffset + j;
                        if (pt.detectRealTime(mathCleaned.cleanII, absoluteJ)) {
                            if (lastPeakIndex !== -1) {
                                rrIntervals.push((absoluteJ - lastPeakIndex) / 250);
                            }
                            lastPeakIndex = absoluteJ;
                        }
                    }
                    absoluteIndexOffset += samples.length;

                    const dbFrame = frameRecords?.find((f: any) => f.start_time === startTime) || {};
                    const evalResult = evaluateIrregularity(rrIntervals);
                    const calculatedHR = evalResult.hr > 0 ? evalResult.hr : (payload.validation?.hr || payload.heart_rate || (i > 0 ? loadedSegments[i-1].heartRate : "--"));
                    
                    loadedSegments[i] = {
                        payload, // Store raw payload for lazy parsing
                        rPeaks: [], 
                        isAnomaly,
                        diagnosis: isAnomaly ? "Anomali Terdeteksi pada rekaman." : "Normal Sinus Rhythm. Variasi stabil.",
                        heartRate: calculatedHR,
                        frameId: payload.message_id || payload.frame_id || "---",
                        deviceId: payload.device_id || "---",
                        createdAt: payload.created_at || "---",
                        dbId: dbFrame.id || null,
                        docNote: dbFrame.doc_note || null,
                        confirmation: dbFrame.confirmation !== undefined ? dbFrame.confirmation : null,
                        docClassification: dbFrame.doc_classification || null,
                        startTime: dbFrame.start_time || null,
                        endTime: dbFrame.end_time || null,
                        aiProbabilities: payload.prediction?.probabilities || null,
                        aiMetrics: {
                            latency_ms: payload.prediction?.latency_ms || null,
                            runtime: payload.prediction?.runtime || "---"
                        },
                        stressTest: payload.stress_test || null,
                        system: payload.system || null,
                        network: payload.network || null,
                    };
                });
                
                setEvents(loadedEvents);
                setSegments(loadedSegments);
                setIsLoading(false);
    }, [sessionId, recordsData, frameRecordsData]);

    const currentSegment = segments[selectedIdx];
    const currentEvent = events.find(e => e.index === selectedIdx);
    
    const currentSessionMeta = allSessions.find((s: any) => s.id === sessionId);

    // Data Pasien dan Sesi diambil dari Dashboard, AnalyticsPage difokuskan untuk viewer

    // Derive props for the cards from currentSegment
    const clinicalStatus: ClinicalExplanation | null = currentSegment ? {
        isAnomaly: currentSegment.isAnomaly,
        fullExplanation: `${currentSegment.isAnomaly ? 'Anomali Terdeteksi' : 'Normal'} - ${currentEvent?.classResult}. ${currentSegment.diagnosis}`,
        severity: currentSegment.isAnomaly ? "CRITICAL" : "NORMAL"
    } : null;

    const heartRate = currentSegment?.heartRate || "--";
    const stressTest = currentSegment?.stressTest || null;
    let createdAt = currentSegment?.createdAt || null;
    const aiProbabilities = currentSegment?.aiProbabilities || null;
    const deviceId = currentSegment?.deviceId || "---";
    const aiMetrics = currentSegment?.aiMetrics || null;
    const system = currentSegment?.system || null;
    const network = currentSegment?.network || null;

    const handleDownload = async (url: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `ecg_paper_${sessionId || 'download'}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error("Download failed:", err);
            window.open(url, '_blank');
        }
    };

    return (
        <div className="bg-clinical-surface text-clinical-charcoal antialiased overflow-x-hidden min-h-screen relative w-full">
            <div className="fixed inset-0 ecg-grid opacity-10 pointer-events-none z-0"></div>
            <DoctorSidebar />

            {/* ECG Photo Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] w-full p-4 flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-3 mb-4">
                            <button onClick={() => window.open(previewImage, '_blank')} className="flex items-center gap-2 px-4 py-2 bg-clinical-charcoal/50 hover:bg-clinical-charcoal/80 text-white rounded-full font-bold text-xs transition-colors backdrop-blur-md">
                                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                Buka di Tab Lain
                            </button>
                            <button onClick={() => handleDownload(previewImage)} className="flex items-center gap-2 px-4 py-2 bg-clinical-blue/80 hover:bg-clinical-blue text-white rounded-full font-bold text-xs transition-colors backdrop-blur-md">
                                <span className="material-symbols-outlined text-[16px]">download</span>
                                Download
                            </button>
                            <button onClick={() => setPreviewImage(null)} className="flex items-center justify-center w-8 h-8 bg-clinical-red/80 hover:bg-clinical-red text-white rounded-full transition-colors backdrop-blur-md">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        <div className="flex-grow overflow-auto flex items-center justify-center">
                            <img src={previewImage} alt="ECG Paper" className="w-full h-auto object-contain rounded-xl shadow-2xl" />
                        </div>
                    </div>
                </div>
            )}
            


            <main className={`flex flex-col transition-all duration-300 min-h-screen pb-12 w-full ${isOpen ? 'md:ml-[260px] md:w-[calc(100%-260px)]' : 'ml-0'}`}>
            {/* --- HEADER KOMPONEN --- */}
            <header className="sticky top-0 bg-clinical-surface/80 backdrop-blur-xl border-b border-clinical-charcoal/5 z-40 px-4 md:px-6 py-4 flex justify-between items-center max-w-container-max mx-auto w-full">
                
                <div className="flex items-center gap-3">
                    <button onClick={toggleSidebar} className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-white-container text-clinical-charcoal/70 transition-colors outline-none" title="Sembunyikan / Tampilkan Menu Utama">
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-clinical-charcoal">Riwayat Klinis</h1>
                        <p className="text-xs md:text-sm font-medium text-clinical-charcoal/60 mt-0.5">Peninjauan rekam historis EKG dan AI Analytics</p>
                    </div>
                </div>


            </header>

            {/* --- TOOLBAR INFORMASI --- */}
            <div className="max-w-container-max mx-auto px-4 md:px-6 pt-6 z-30 relative w-full">
                <div className="bg-white rounded-[2rem] border border-clinical-charcoal/5 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] p-4 md:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-clinical-surface text-clinical-blue p-3 rounded-[1rem] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[24px]">folder_managed</span>
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-clinical-charcoal">{!sessionId ? 'Daftar Seluruh Riwayat Sesi' : 'Mode Peninjauan Sesi'}</h2>
                        <p className="text-[11px] font-medium text-clinical-charcoal/60 mt-0.5">
                            {!sessionId ? 'Pilih sesi dari daftar di bawah untuk melihat detail rekaman.' : (currentSessionMeta ? `Pasien: ${currentSessionMeta.patient_name || 'Anonim'} | Mulai: ${new Date(currentSessionMeta.started_at).toLocaleString('id-ID')} | Sesi: ${sessionId}` : `Menampilkan detail rekaman EKG untuk Sesi: ${sessionId}`)}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 justify-end w-full md:w-auto">
                    {!sessionId && (
                        <div className="relative">
                            <select
                                value={selectedPatientFilter}
                                onChange={(e) => { setSelectedPatientFilter(e.target.value); setCurrentPage(1); }}
                                className="appearance-none text-[11px] font-bold uppercase tracking-wider text-clinical-charcoal bg-clinical-surface border border-clinical-charcoal/5 px-5 py-2.5 pr-10 rounded-full outline-none focus:border-clinical-blue/30 transition-all duration-700 cursor-pointer shadow-sm hover:shadow-md hover:border-clinical-blue/20"
                            >
                                <option value="ALL">Semua Pasien</option>
                                {connectedPatients.map(p => (
                                    <option key={p.id || p.raw_id} value={p.raw_id || p.id}>{p.name}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined text-[16px] text-clinical-charcoal/50 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">expand_more</span>
                        </div>
                    )}
                    {sessionId && (
                        <button onClick={() => navigate(-1)} className="text-[11px] font-bold uppercase tracking-wider text-clinical-charcoal/70 hover:text-clinical-blue bg-clinical-surface border border-clinical-charcoal/5 hover:border-clinical-blue/20 px-5 py-2.5 rounded-full transition-all duration-700 flex items-center gap-2 shadow-sm hover:shadow-md">
                            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                            Kembali
                        </button>
                    )}
                </div>
                </div>
            </div>

            {/* --- KONTEN UTAMA --- */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out w-full flex-1 flex flex-col">
            {!sessionId ? (() => {
                if (connectedPatients.length === 0) {
                    return (
                        <div className="mt-6 mx-auto w-full max-w-container-max px-4 md:px-6 flex-1">
                            <div className="bg-white border border-clinical-charcoal/5 p-8 rounded-[2rem] flex flex-col items-center justify-center shadow-[0px_20px_40px_rgba(0,0,0,0.04)] text-center">
                                <span className="material-symbols-outlined text-4xl text-clinical-charcoal/20 mb-3">link_off</span>
                                <p className="text-sm font-medium text-clinical-charcoal/60">
                                    Sambungkan ke pasien untuk melihat riwayat rekaman.
                                </p>
                            </div>
                        </div>
                    );
                }

                return (
                <div className="mt-6 mx-auto w-full max-w-container-max px-4 md:px-6 flex-1">
                    <div className="space-y-3">
                        {allSessions.length === 0 ? (
                            <div className="bg-white border border-clinical-charcoal/5 p-8 rounded-[2rem] flex flex-col items-center justify-center shadow-[0px_20px_40px_rgba(0,0,0,0.04)] text-center">
                                <span className="material-symbols-outlined text-4xl text-clinical-charcoal/20 mb-3">folder_off</span>
                                <p className="text-sm font-medium text-clinical-charcoal/60">
                                    {totalSessions === 0 ? 'Belum ada riwayat sesi yang tersimpan.' : 'Tidak ada sesi untuk pasien yang dipilih.'}
                                </p>
                            </div>
                        ) : allSessions.map((session: any) => {
                            const validation = sessionValidations[session.id] || { total: 0, validated: 0 };
                            let validationStatus = "Belum Divalidasi";
                            let validationClass = "bg-clinical-surface text-clinical-charcoal/60 border border-outline-variant";
                            
                            if (validation.total > 0) {
                                if (validation.validated === validation.total) {
                                    validationStatus = "Sudah Divalidasi";
                                    validationClass = "bg-signal-green/10 text-signal-green border border-signal-green/20";
                                } else if (validation.validated > 0) {
                                    const percentage = Math.round((validation.validated / validation.total) * 100);
                                    validationStatus = `Tervalidasi ${percentage}%`;
                                    validationClass = "bg-clinical-blue/10 text-clinical-blue border border-clinical-blue/20";
                                }
                            }

                            return (
                                <div key={session.id} className="bg-white border border-clinical-charcoal/5 p-6 rounded-[2rem] flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1 group cursor-pointer overflow-hidden relative" onClick={() => navigate(`/doctor/analytics?sessionId=${session.id}`)}>
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 rounded-full bg-clinical-surface group-hover:bg-clinical-blue/10 transition-colors duration-700 flex items-center justify-center text-lg font-bold text-clinical-blue uppercase overflow-hidden flex-shrink-0 relative z-10">
                                            {session.patient_id ? (
                                                <SessionPatientAvatar patientId={session.patient_id} patientName={session.patient_name || ''} />
                                            ) : (
                                                session.patient_name ? session.patient_name.substring(0, 2) : 'UK'
                                            )}
                                        </div>
                                        <div className="relative z-10">
                                            <h4 className="font-bold text-lg text-clinical-charcoal group-hover:text-clinical-blue transition-colors duration-700 truncate max-w-[200px]">{session.patient_name || 'Pasien Anonim'}</h4>
                                            <p className="text-xs font-medium text-clinical-charcoal/60 mt-0.5">Sesi: {session.id.substring(0, 8)}... • SN: {session.device_id}</p>
                                            <p className="text-[10px] text-clinical-charcoal/60 mt-1.5 font-bold uppercase tracking-widest">{new Date(session.started_at).toLocaleString('id-ID')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider relative z-10 ${validationClass}`}>
                                            {validationStatus}
                                        </div>
                                        {session.ecg_paper ? (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setPreviewImage(API_URL + session.ecg_paper); }} 
                                                className="border border-clinical-charcoal/10 text-clinical-charcoal hover:bg-clinical-surface px-5 py-2 rounded-[2rem] text-xs font-bold bg-white transition-all duration-700 flex items-center gap-1.5 relative z-10 active:scale-95"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">image</span>
                                                Foto
                                            </button>
                                        ) : (
                                            <div className="px-3 py-1.5 text-[10px] text-clinical-charcoal/40 italic font-medium flex items-center gap-1 relative z-10">
                                                <span className="material-symbols-outlined text-[14px]">image_not_supported</span>
                                                Tidak Ada Foto
                                            </div>
                                        )}
                                        <button className="bg-clinical-blue text-white hover:brightness-110 px-5 py-2 rounded-[2rem] text-xs font-bold transition-all duration-700 flex items-center gap-1.5 relative z-10 shadow-md hover:shadow-lg active:scale-95">
                                            <span className="material-symbols-outlined text-[16px]">history</span>
                                            Detail
                                        </button>
                                    </div>
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none z-0 group-hover:scale-110 transition-transform duration-700 text-clinical-charcoal">
                                        <span className="material-symbols-outlined text-[120px] translate-x-1/4">folder_open</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {totalSessions > itemsPerPage && (
                        <div className="mt-8 mb-4">
                            <Pagination
                                currentPage={currentPage}
                                totalItems={totalSessions}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    )}
                </div>
            )})() : (
            <div className="mt-6 mx-auto w-full max-w-container-max px-4 md:px-6 flex flex-col lg:flex-row gap-6 flex-1">
                
                {/* KOLOM KIRI: GRAFIK & TIMELINE */}
                <section className="w-full lg:w-9/12 flex flex-col gap-4">
                    
                    {/* Control Bar (Speed & Info Segmen) */}
                    <div className="bg-white border border-clinical-charcoal/5 rounded-[2rem] p-5 flex flex-wrap justify-between items-center shadow-[0px_20px_40px_rgba(0,0,0,0.04)] gap-4">
                        <div className="flex items-center gap-4">
                            <span className="material-symbols-outlined text-clinical-blue hidden sm:block">history</span>
                            <span className="text-sm font-body-sm font-headline-md text-clinical-charcoal flex items-center gap-2">
                                Waktu Rekaman: 
                                <span className="px-2 py-1 bg-white-container-high rounded text-clinical-blue font-mono-data text-xs font-body-sm">
                                    {currentEvent ? `${currentEvent.timeStr} - ${events[selectedIdx + 1]?.timeStr || 'Akhir'}` : '--'}
                                </span>
                            </span>
                            {currentSessionMeta?.ecg_paper && (
                                <button 
                                    onClick={() => setPreviewImage(API_URL + currentSessionMeta.ecg_paper)} 
                                    className="ml-2 flex items-center gap-1.5 px-5 py-2.5 bg-clinical-blue text-white rounded-[2rem] text-xs font-bold hover:brightness-110 active:scale-95 transition-all duration-700 shadow-md hover:shadow-lg"
                                >
                                    <span className="material-symbols-outlined text-[16px]">image</span>
                                    Lihat Foto EKG
                                </button>
                            )}
                        </div>
                        <div className="ml-auto flex items-center">
                            {currentSegment?.confirmation !== null && currentSegment?.confirmation !== undefined ? (
                                <div className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-signal-green/10 text-signal-green border border-signal-green/20">
                                    Sudah Divalidasi
                                </div>
                            ) : (
                                <div className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-clinical-surface text-clinical-charcoal/60 border border-clinical-charcoal/10">
                                    Belum Divalidasi
                                </div>
                            )}
                        </div>
                    </div>

                            {/* Pembungkus Kanvas 7-Lead */}
                            <div className="relative flex-1 min-h-[400px]">
                                <div className="absolute inset-0 z-0 bg-white border border-clinical-charcoal/5 rounded-[2rem] overflow-y-auto overflow-x-hidden shadow-[0px_20px_40px_rgba(0,0,0,0.04)] flex flex-col">
                                    <EcgViewer 
                                        segment={currentSegment}
                                        speed={speed} 
                                        classResult={currentEvent?.classResult} 
                                        timeOffset={selectedIdx * 10} 
                                    />
                                    {isLoading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-50">
                                    <span className="material-symbols-outlined text-clinical-blue text-4xl animate-spin">sync</span>
                                    <p className="mt-2 text-sm font-body-sm font-headline-md text-clinical-charcoal">Menarik Arsip Segmen...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Timeline Multi-Aritmia (Klik untuk melompat ke waktu tertentu) */}
                    {events.length > 0 && (
                        <TimelineBar 
                            events={events} 
                            currentIdx={selectedIdx} 
                            onSegmentSelect={(idx: number) => {
                                setIsLoading(true);
                                setTimeout(() => {
                                    setSelectedIdx(idx);
                                    setIsLoading(false);
                                }, 300); // Simulasi jeda tarik data
                            }} 
                        />
                    )}
                    
                </section>

                {/* KOLOM KANAN: DETAIL ANALISIS HISTORIS */}
                <aside className="w-full lg:w-3/12 flex flex-col gap-6">
                    
                    <VitalCard heartRate={heartRate} clinicalStatus={clinicalStatus} stressTest={stressTest} createdAt={createdAt} />
                    <AiCard 
                        sessionId={sessionId} 
                        rawClassification={currentEvent?.classResult || null} 
                        isDoctorReview={true}
                        timeInterval={currentEvent ? `${currentEvent.timeStr} - ${events[selectedIdx + 1]?.timeStr || 'Akhir'}` : undefined}
                        frameId={currentSegment?.dbId}
                        initialDocNote={currentSegment?.docNote}
                        initialConfirmation={currentSegment?.confirmation}
                        initialDocClassification={currentSegment?.docClassification}
                        startTime={currentSegment?.startTime}
                        endTime={currentSegment?.endTime}
                        onViewEcgPaper={(() => {
                            const currentSession = allSessions.find((s: any) => s.id === sessionId);
                            return currentSession?.ecg_paper ? () => setPreviewImage(API_URL + currentSession.ecg_paper) : undefined;
                        })()}
                        onGoToNext={() => {
                            if (selectedIdx < events.length - 1) {
                                setIsLoading(true);
                                setTimeout(() => {
                                    setSelectedIdx(selectedIdx + 1);
                                    setIsLoading(false);
                                }, 300);
                            }
                        }}
                        isLastFrame={selectedIdx >= events.length - 1}
                        onGoToList={() => navigate('/doctor/analytics')}
                        onValidationSuccess={(updatedFrame) => {
                            // Update the frame record in local state so the badge turns green instantly
                            setSegments(prev => {
                                const currentSeg = prev[selectedIdx];
                                const wasValidated = currentSeg?.confirmation !== null && currentSeg?.confirmation !== undefined;
                                const isValidatedNow = updatedFrame.confirmation !== null && updatedFrame.confirmation !== undefined;
                                
                                // Update session validation counts locally
                                setSessionValidations(prevCounts => {
                                    const currentCount = prevCounts[sessionId] || { total: 0, validated: 0 };
                                    let newValidated = currentCount.validated;
                                    
                                    if (!wasValidated && isValidatedNow) {
                                        newValidated += 1;
                                    } else if (wasValidated && !isValidatedNow) {
                                        newValidated = Math.max(0, newValidated - 1);
                                    }
                                    
                                    return {
                                        ...prevCounts,
                                        [sessionId]: {
                                            ...currentCount,
                                            validated: newValidated
                                        }
                                    };
                                });

                                return {
                                    ...prev,
                                    [selectedIdx]: {
                                        ...currentSeg,
                                        confirmation: updatedFrame.confirmation,
                                        docClassification: updatedFrame.docClassification,
                                        docNote: updatedFrame.docNote,
                                        isAnomaly: updatedFrame.confirmation ? (updatedFrame.docClassification !== 'Normal' && updatedFrame.docClassification !== 'NORM') : currentSeg.isAnomaly
                                    }
                                };
                            });
                        }}
                    />
                    <div className="mt-auto">
                        <DeviceCard deviceId={deviceId} aiMetrics={aiMetrics} isLive={false} />
                    </div>

                </aside>
            </div>
            )}
            </div>
            </main>
        </div>
    );
};
