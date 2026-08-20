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
import { AdminSidebar } from '../../components/layout/AdminSidebar';
import { Pagination } from '../../components/shared/Pagination';
import { useStickyState } from '../../../application/hooks/useStickyState';
import { useSidebar } from '../../../application/context/SidebarContext';
import { useConnection } from '../../../application/context/ConnectionContext';
import { VitalCard } from '../../components/dashboard/VitalCard';
import { AiCard } from '../../components/dashboard/AiCard';
import { DeviceCard } from '../../components/dashboard/DeviceCard';
import type { ClinicalExplanation } from '../../../core/clinical/ruleBasedEngine';
import { API_URL } from '../../../config/env';
import { fetchWithAuth } from '../../../config/api';
import { supabase } from '../../../config/supabaseClient';

const useQuery = () => new URLSearchParams(useLocation().search);

export const AdminAnalyticsPage: React.FC = () => {
    const query = useQuery();
    const sessionId = query.get('sessionId') || '';
    const navigate = useNavigate();

    const [patientPhotos, setPatientPhotos] = useState<Record<string, string>>({});

    const [speed, setSpeed] = useState<25 | 50>(25);
    const [selectedIdx, setSelectedIdx] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [showPatientSelector, setShowPatientSelector] = useState(!sessionId);
    const [selectedPatientFilter, setSelectedPatientFilter] = useState<string>('ALL');

    const { isOpen, toggleSidebar } = useSidebar();
    const { connectedPatients } = useConnection();

    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [segments, setSegments] = useState<Record<number, any>>({});
    
    const [sessionValidations, setSessionValidations] = useState<Record<string, { total: number, validated: number }>>({});
    
    // Session Note States
    const [sessionDevNote, setSessionDevNote] = useState<string | null>(null);
    const [isEditingSessionNote, setIsEditingSessionNote] = useState(false);
    const [editSessionNoteValue, setEditSessionNoteValue] = useState('');
    const [isSubmittingSessionNote, setIsSubmittingSessionNote] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useStickyState(1, 'adminAnalyticsSidebarPage');
    const itemsPerPage = 10;

    const role = localStorage.getItem('user_role');
    const userId = localStorage.getItem('user_id');
    const sessionsUrl = selectedPatientFilter === 'ALL'
        ? (role === 'dokter' ? `/api/sessions?doctor_id=${userId}&page=${currentPage}&limit=${itemsPerPage}` : `/api/sessions?page=${currentPage}&limit=${itemsPerPage}`)
        : `/api/patients/${selectedPatientFilter}/sessions?page=${currentPage}&limit=${itemsPerPage}`;

    const { data: sessionsResponse, isLoading: loadingSessions } = useCachedFetch(sessionId ? null : sessionsUrl);
    
    // Derived state
    const allSessions = sessionsResponse?.data || sessionsResponse?.sessions || (Array.isArray(sessionsResponse) ? sessionsResponse : []);
    const totalSessions = sessionsResponse?.pagination?.total || sessionsResponse?.total_sessions || allSessions.length;

    useEffect(() => {
        if (allSessions.length > 0) {
            const uniquePatientIds = Array.from(new Set(allSessions.map((s: any) => s.patient_id).filter(Boolean)));
            
            uniquePatientIds.forEach(id => {
                // Hindari fetch berulang jika sudah ada di state
                setPatientPhotos(prev => {
                    if (prev[id as string]) return prev;
                    
                    fetchWithAuth(`/api/patients/${id}`)
                        .then(res => res.json())
                        .then(data => {
                            if (data && data.patient && data.patient.profile_photo) {
                                setPatientPhotos(p => ({
                                    ...p,
                                    [id as string]: data.patient.profile_photo
                                }));
                            }
                        })
                        .catch(e => console.error("Error fetching patient", id, e));
                        
                    return prev;
                });
            });

                // Hitung persentase validasi menggunakan RPC Supabase
                const sessionIds = allSessions.map((s: any) => s.id);
                if (sessionIds.length > 0) {
                    supabase.rpc('get_sessions_validation_counts', { session_ids: sessionIds })
                        .then(({ data: stats, error }) => {
                            if (!error && stats) {
                                const counts: Record<string, { total: number, validated: number }> = {};
                                sessionIds.forEach((id: string) => {
                                    counts[id] = { total: 0, validated: 0 };
                                });
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
    
    const { data: frameRecordsData, isLoading: loadingFrames } = useSWR(
        sessionId ? `supabase_frame_records_${sessionId}` : null, 
        async () => {
            const { data } = await supabase.from('frame_records').select('*').eq('session_id', sessionId);
            return data;
        },
        { revalidateOnFocus: false }
    );

    const { data: sessionDataObj } = useSWR(
        sessionId ? `supabase_session_note_${sessionId}` : null,
        async () => {
            const { data } = await supabase.from('sessions').select('dev_note').eq('id', sessionId).single();
            return data;
        },
        { revalidateOnFocus: false }
    );

    useEffect(() => {
        if (!sessionId) {
            setIsLoading(false);
            return;
        }

        if (!recordsData || !frameRecordsData || sessionDataObj === undefined) {
            setIsLoading(true);
            return;
        }

        const data = recordsData;
        const frameRecords = frameRecordsData;
        const sessionData = sessionDataObj;
                if (sessionData) {
                    setSessionDevNote(sessionData.dev_note);
                }
                
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

                // In Admin, do NOT exclude hidden frames, but pass the hidden status to segment
                const validData = Array.isArray(data) ? data : (data.data || []);

                validData.forEach((payload: any, i: number) => {
                    const originalIndex = i;
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
                            runtime: payload.prediction?.runtime || "---",
                            confidence_percent: payload.prediction?.confidence_percent || null,
                            status: payload.prediction?.status || null
                        },
                        hidden: hiddenMap.get(startTime) || false,
                        stressTest: payload.stress_test || null,
                        system: payload.system || null,
                        network: payload.network || null,
                    };
                });
                
                setEvents(loadedEvents);
                setSegments(loadedSegments);
                setIsLoading(false);
    }, [sessionId, recordsData, frameRecordsData, sessionDataObj]);

    const saveSessionNote = async () => {
        setIsSubmittingSessionNote(true);
        try {
            const { error } = await supabase.from('sessions').update({ dev_note: editSessionNoteValue }).eq('id', sessionId);
            if (!error) {
                setSessionDevNote(editSessionNoteValue);
                setIsEditingSessionNote(false);
            } else {
                console.error("Gagal menyimpan note sesi:", error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmittingSessionNote(false);
        }
    };

    const deleteSessionNote = async () => {
        setIsSubmittingSessionNote(true);
        try {
            const { error } = await supabase.from('sessions').update({ dev_note: null }).eq('id', sessionId);
            if (!error) {
                setSessionDevNote(null);
                setIsEditingSessionNote(false);
            } else {
                console.error("Gagal menghapus note sesi:", error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmittingSessionNote(false);
        }
    };

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

    const formatTimeDetailed = (ts: string | null) => {
        if (!ts || ts === "---") return "--:--:--";
        try {
            const d = new Date(ts);
            if (isNaN(d.getTime())) return ts;
            const pad = (n: number, w: number = 2) => n.toString().padStart(w, '0');
            return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
        } catch {
            return ts;
        }
    };

    return (
        <div className="bg-clinical-surface text-clinical-charcoal antialiased overflow-x-hidden min-h-screen relative font-sans">
            <div className="absolute inset-0 ecg-grid opacity-10 pointer-events-none z-0"></div>
            <AdminSidebar />
            
            <main className={`flex flex-col transition-all duration-300 min-h-screen pb-12 w-full relative z-10 md:ml-[260px] md:w-[calc(100%-260px)] ${isOpen ? '' : 'ml-0'}`}>
            {/* --- HEADER KOMPONEN --- */}
            <header className="sticky top-0 bg-clinical-surface/80 backdrop-blur-xl border-b border-clinical-charcoal/5 z-40 px-4 md:px-6 py-4 flex justify-between items-center max-w-container-max mx-auto w-full transition-all duration-300">
                
                <div className="flex items-center gap-3">
                    <button onClick={toggleSidebar} className="md:hidden flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-white-container text-clinical-charcoal/70 transition-colors outline-none" title="Sembunyikan / Tampilkan Menu Utama">
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                    <div>
                        <h1 className="text-2xl font-headline-md tracking-tight text-clinical-charcoal">Riwayat Klinis</h1>
                        <p className="text-xs font-body-sm text-clinical-charcoal/70 mt-0.5">Peninjauan rekam historis EKG dan AI Analytics</p>
                    </div>
                </div>

            </header>

            {/* --- TOOLBAR INFORMASI --- */}
            <div className="max-w-container-max mx-auto px-4 md:px-6 pt-4 w-full z-30 relative animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
                <div className="bg-white/80 backdrop-blur-md rounded-[1.5rem] border border-clinical-charcoal/5 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-700 hover:shadow-md">
                <div className="flex items-center gap-3">
                    <div className="bg-clinical-blue/10 p-2 rounded-lg text-clinical-blue">
                        <span className="material-symbols-outlined text-[20px]">folder_managed</span>
                    </div>
                    <div>
                        <h2 className="text-sm font-body-sm font-headline-md text-clinical-charcoal">{!sessionId ? 'Daftar Seluruh Riwayat Sesi' : 'Mode Peninjauan Sesi'}</h2>
                        <p className="text-[11px] text-clinical-charcoal/70">
                            {!sessionId ? 'Pilih sesi dari daftar di bawah untuk melihat detail rekaman.' : (currentSessionMeta ? `Pasien: ${currentSessionMeta.patient_name || 'Anonim'} | Mulai: ${new Date(currentSessionMeta.started_at).toLocaleString('id-ID')} | Sesi: ${sessionId}` : `Menampilkan detail rekaman EKG untuk Sesi: ${sessionId}`)}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {!sessionId && (
                        <select
                            value={selectedPatientFilter}
                            onChange={(e) => { setSelectedPatientFilter(e.target.value); setCurrentPage(1); }}
                            className="text-xs font-body-sm text-clinical-charcoal border border-clinical-blue/20 px-3 py-2 rounded-lg bg-white outline-none focus:border-clinical-blue transition-all cursor-pointer"
                        >
                            <option value="ALL">Semua Pasien</option>
                            {connectedPatients.map(p => (
                                <option key={p.id || p.raw_id} value={p.id || p.raw_id}>{p.name}</option>
                            ))}
                        </select>
                    )}
                    <button onClick={() => navigate(-1)} className="text-xs font-body-sm font-headline-md text-clinical-charcoal/70 hover:text-clinical-blue border border-clinical-blue/20 px-4 py-2 rounded-lg hover:border-clinical-blue transition-all">
                        Kembali
                    </button>
                </div>
                </div>
            </div>

            {/* --- KONTEN UTAMA --- */}
            {!sessionId ? (() => {
                if (connectedPatients.length === 0) {
                    return (
                        <div className="mt-6 mx-auto w-full max-w-container-max px-4 md:px-6 flex-1">
                            <div className="bg-white border border-clinical-blue/20/60 p-5 rounded-xl flex items-center justify-center shadow-sm">
                                <p className="text-sm font-body-sm text-clinical-charcoal/70">
                                    Sambungkan ke pasien untuk melihat riwayat rekaman.
                                </p>
                            </div>
                        </div>
                    );
                }

                return (
                <div className="mt-4 mx-auto w-full max-w-container-max px-4 md:px-6 flex-1 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 ease-out fill-mode-both">
                    <div className="space-y-4">
                        {allSessions.length === 0 ? (
                            <div className="bg-white border border-clinical-blue/20/60 p-5 rounded-xl flex items-center justify-center shadow-sm">
                                <p className="text-sm font-body-sm text-clinical-charcoal/70">
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
                                <div key={session.id} className="bg-white border border-clinical-charcoal/5 p-4 md:p-5 rounded-[1.5rem] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-lg hover:border-clinical-blue/20 transition-all duration-500 cursor-pointer group" onClick={() => navigate(`/admin/analytics?sessionId=${session.id}`)}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-white-container-low flex items-center justify-center font-headline-md text-outline uppercase overflow-hidden flex-shrink-0">
                                            {session.patient_id && patientPhotos[session.patient_id] ? (
                                                <img src={patientPhotos[session.patient_id]} alt={session.patient_name || ''} className="w-full h-full object-cover" />
                                            ) : (
                                                session.patient_name ? session.patient_name.substring(0, 2) : 'UK'
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-headline-md text-sm font-body-sm text-clinical-charcoal truncate max-w-[200px]">{session.patient_name || 'Pasien Anonim'}</h4>
                                            <p className="text-xs font-body-sm text-clinical-charcoal/70 font-mono-data mt-0.5">Sesi: {session.id.substring(0, 8)}... • SN: {session.device_id}</p>
                                            <p className="text-[10px] text-clinical-charcoal/70 mt-1 font-headline-md">{new Date(session.started_at).toLocaleString('id-ID')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${validationClass}`}>
                                            {validationStatus}
                                        </div>
                                        <button className="border border-clinical-blue/20 text-clinical-charcoal/70 hover:text-clinical-blue hover:border-clinical-blue px-3 py-1.5 rounded-lg text-xs font-body-sm font-label-md bg-white transition-all flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">history</span>
                                            Buka Detail
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {totalSessions > itemsPerPage && (
                        <div className="mt-4 mb-12">
                            <Pagination 
                                currentPage={currentPage}
                                totalItems={totalSessions}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    )}
                </div>
                );})() : (
            <div className="mt-6 mx-auto w-full max-w-container-max px-4 md:px-6 flex flex-col lg:flex-row gap-6 flex-1">
                
                {/* KOLOM KIRI: GRAFIK & TIMELINE */}
                <section className="w-full lg:w-9/12 flex flex-col gap-4">
                    
                    {/* Session Note Form / Display */}
                    <div className="bg-white border border-outline-variant/60 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold text-charcoal uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-clinical-blue">note_alt</span>
                                Catatan Sesi
                            </h3>
                        </div>
                        {isEditingSessionNote ? (
                            <div className="flex flex-col gap-3">
                                <textarea 
                                    value={editSessionNoteValue}
                                    onChange={(e) => setEditSessionNoteValue(e.target.value)}
                                    className="w-full text-sm font-body-sm p-3 border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-blue/20 focus:border-clinical-blue transition-all"
                                    placeholder="Tulis catatan sesi di sini..."
                                    rows={3}
                                />
                                <div className="flex justify-end gap-2">
                                    <button 
                                        onClick={() => setIsEditingSessionNote(false)}
                                        className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-variant/30 rounded-lg transition-colors"
                                        disabled={isSubmittingSessionNote}
                                    >
                                        Batal
                                    </button>
                                    {sessionDevNote && (
                                        <button 
                                            onClick={deleteSessionNote}
                                            className="px-4 py-2 text-xs font-bold text-white bg-alert-red hover:bg-alert-red/90 rounded-lg transition-colors flex items-center gap-1"
                                            disabled={isSubmittingSessionNote}
                                        >
                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                            Hapus
                                        </button>
                                    )}
                                    <button 
                                        onClick={saveSessionNote}
                                        className="px-4 py-2 text-xs font-bold text-white bg-clinical-blue hover:bg-clinical-blue/90 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                                        disabled={isSubmittingSessionNote}
                                    >
                                        {isSubmittingSessionNote ? (
                                            <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                                        ) : (
                                            <span className="material-symbols-outlined text-[14px]">save</span>
                                        )}
                                        {isSubmittingSessionNote ? "Menyimpan..." : "Simpan"}
                                    </button>
                                </div>
                            </div>
                        ) : sessionDevNote ? (
                            <div className="flex items-start justify-between gap-4 p-3 bg-slate-50 border border-outline-variant/30 rounded-lg">
                                <p className="text-sm font-body-sm text-charcoal italic leading-relaxed">"{sessionDevNote}"</p>
                                <button 
                                    onClick={() => { setEditSessionNoteValue(sessionDevNote); setIsEditingSessionNote(true); }}
                                    className="text-clinical-blue hover:bg-clinical-blue/10 p-2 rounded-lg transition-colors flex-shrink-0"
                                    title="Edit Catatan"
                                >
                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between gap-4 p-3 border border-dashed border-outline-variant/60 rounded-lg bg-surface-container-lowest">
                                <p className="text-xs text-on-surface-variant italic">Belum ada catatan yang diinput pada sesi ini.</p>
                                <button 
                                    onClick={() => { setEditSessionNoteValue(''); setIsEditingSessionNote(true); }}
                                    className="text-xs font-bold text-clinical-blue border border-clinical-blue/30 px-3 py-1.5 rounded-lg hover:bg-clinical-blue/5 transition-colors flex items-center gap-1.5"
                                >
                                    <span className="material-symbols-outlined text-[14px]">add</span>
                                    Tambahkan Catatan
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {/* Control Bar (Speed & Info Segmen) */}
                    <div className="bg-white border border-clinical-blue/20 rounded-xl p-3 flex flex-wrap justify-between items-center shadow-sm gap-3">
                        <div className="flex items-center gap-4">
                            <span className="material-symbols-outlined text-clinical-blue hidden sm:block">history</span>
                            <span className="text-sm font-body-sm font-headline-md text-clinical-charcoal flex items-center gap-2">
                                Waktu Rekaman: 
                                <span className="px-2 py-1 bg-white-container-high rounded text-clinical-blue font-mono-data text-xs font-body-sm">
                                    {currentEvent ? `${currentEvent.timeStr} - ${events[selectedIdx + 1]?.timeStr || 'Akhir'}` : '--'}
                                </span>
                            </span>
                        </div>
                        <div className="ml-auto flex items-center">
                            {currentSegment?.confirmation !== null && currentSegment?.confirmation !== undefined ? (
                                <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-signal-green/10 text-signal-green border border-signal-green/20">
                                    Sudah Divalidasi
                                </div>
                            ) : (
                                <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-clinical-surface text-clinical-charcoal/60 border border-outline-variant">
                                    Belum Divalidasi
                                </div>
                            )}
                        </div>
                    </div>

                            {/* Pembungkus Kanvas 7-Lead */}
                            <div className="relative flex-1 min-h-[400px]">
                                <div className="absolute inset-0 z-0 bg-white-container-lowest border border-clinical-blue/20 rounded-xl overflow-y-auto overflow-x-hidden shadow-sm flex flex-col">
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
                    {/* Timestamp Card */}
                    <div className="bg-white border border-outline-variant/60 rounded-xl p-4 shadow-sm flex flex-col gap-2">
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">device_thermostat</span> Created At (IoT)</span>
                            <span className="text-xs font-mono mt-1 text-charcoal font-bold">{formatTimeDetailed(createdAt)}</span>
                         </div>
                    </div>

                    {/* Edge AI Performance (Prediction) */}
                    <div className="bg-charcoal text-white rounded-xl p-5 shadow-xl flex flex-col gap-4">
                        <h3 className="text-sm font-bold flex items-center gap-2 border-b border-white/20 pb-2">
                            <span className="material-symbols-outlined text-[18px] text-brand-red">psychology</span>
                            Edge AI Prediction
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/10 p-3 rounded-lg border border-white/5">
                                <p className="text-[9px] text-white/60 uppercase">Validation</p>
                                <p className={`text-sm font-bold ${aiMetrics?.status === 'PASS' ? 'text-green-400' : 'text-alert-red'}`}>{aiMetrics?.status || '--'}</p>
                            </div>
                            <div className="bg-white/10 p-3 rounded-lg border border-white/5">
                                <p className="text-[9px] text-white/60 uppercase">Confidence</p>
                                <p className="text-sm font-bold text-brand-red">{aiMetrics?.confidence_percent ? `${aiMetrics.confidence_percent.toFixed(2)}%` : '--'}</p>
                            </div>
                            <div className="col-span-2 bg-white/10 p-3 rounded-lg border border-white/5 flex justify-between items-center">
                                <div>
                                    <p className="text-[9px] text-white/60 uppercase">Result Label</p>
                                    <p className="text-lg font-extrabold text-medical-teal">{currentEvent?.classResult || '--'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] text-white/60 uppercase">Latency</p>
                                    <p className="text-sm font-bold font-mono text-white">{aiMetrics?.latency_ms ? `${aiMetrics.latency_ms.toFixed(1)} ms` : '--'}</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Probabilities */}
                        {aiProbabilities && (
                            <div className="bg-white/5 p-3 rounded-lg border border-white/5 mt-1 space-y-2">
                                <div className="flex justify-between items-center border-b border-white/10 pb-1 mb-2">
                                    <p className="text-[9px] font-bold text-white/80 uppercase tracking-widest">Probabilities</p>
                                </div>
                                {Object.entries(aiProbabilities).map(([key, val]) => (
                                    <div key={key} className="flex justify-between items-center">
                                        <span className="text-[10px] text-white/80 font-medium">{key}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div className={`h-full ${key === currentEvent?.classResult ? 'bg-medical-teal' : 'bg-white/30'}`} style={{ width: `${(val as number)}%` }}></div>
                                            </div>
                                            <span className="text-[10px] font-mono w-8 text-right text-white/90">{(val as number).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="text-[9px] text-white/40 text-center uppercase tracking-widest mt-1">
                            Runtime: {aiMetrics?.runtime || 'UNKNOWN'}
                        </div>
                    </div>

                    {/* Status Validasi Medis (Read-Only) */}
                    <div className="bg-clinical-surface border border-clinical-blue/20 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-clinical-charcoal flex items-center gap-2 border-b border-clinical-blue/10 pb-2">
                            <span className="material-symbols-outlined text-[18px] text-clinical-blue">stethoscope</span>
                            Status Validasi Medis
                        </h3>
                        
                        <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-outline-variant/30 shadow-sm">
                            <div>
                                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Status Konfirmasi</p>
                                <p className="text-sm font-bold mt-0.5">
                                    {currentSegment?.confirmation === true ? <span className="text-signal-green">Benar</span> : 
                                     currentSegment?.confirmation === false ? <span className="text-alert-red">Salah</span> : 
                                     <span className="text-on-surface-variant">Belum Divalidasi</span>}
                                </p>
                            </div>
                        </div>

                        {currentSegment?.confirmation !== undefined && currentSegment?.confirmation !== null && (
                            <div className="bg-white p-3 rounded-lg border border-outline-variant/30 shadow-sm">
                                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Klasifikasi Akhir</p>
                                <p className="text-lg font-extrabold text-clinical-blue mt-0.5">
                                    {currentSegment?.docClassification || '--'}
                                </p>
                            </div>
                        )}

                        <div className="bg-white p-3 rounded-lg border border-outline-variant/30 shadow-sm">
                            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-1.5">Catatan Dokter</p>
                            <p className={`text-sm ${currentSegment?.docNote ? 'text-charcoal italic' : 'text-on-surface-variant/50'}`}>
                                {currentSegment?.docNote ? `"${currentSegment.docNote}"` : 'Tidak ada catatan.'}
                            </p>
                        </div>
                    </div>

                    {/* System Health */}
                    {system && (
                    <div className="bg-white border border-outline-variant/60 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-charcoal flex items-center gap-2 border-b border-outline-variant/50 pb-2">
                            <span className="material-symbols-outlined text-[18px] text-medical-teal">memory</span>
                            Hardware Health
                        </h3>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                            <div>
                                <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">CPU Usage</p>
                                <p className="text-sm font-mono font-semibold text-charcoal">{system.cpu_usage_percent?.toFixed(1) || '--'}%</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Memory</p>
                                <p className="text-sm font-mono font-semibold text-charcoal">{system.memory_usage_mb ? `${system.memory_usage_mb} MB` : '--'} <span className="text-xs text-on-surface-variant font-normal">({system.memory_usage_percent?.toFixed(1) || '--'}%)</span></p>
                            </div>
                            <div>
                                <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Temperature</p>
                                <p className="text-sm font-mono font-semibold text-charcoal">{system.cpu_temperature_c?.toFixed(1) || '--'} °C</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Uptime</p>
                                <p className="text-sm font-mono font-semibold text-charcoal">{system.uptime_s ? `${system.uptime_s} s` : '--'}</p>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Network Metrics */}
                    {network && (
                    <div className="bg-white border border-outline-variant/60 rounded-xl p-5 shadow-sm flex flex-col gap-3">
                        <h3 className="text-sm font-bold text-charcoal flex items-center gap-2 border-b border-outline-variant/50 pb-2">
                            <span className="material-symbols-outlined text-[18px] text-medical-teal">cell_tower</span>
                            Network Metrics
                        </h3>
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-on-surface-variant font-medium">WiFi RSSI</p>
                            <p className="text-sm font-mono font-semibold text-charcoal">{network.wifi_rssi_dbm || '--'} dBm</p>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-on-surface-variant font-medium">MQTT Latency</p>
                            <p className="text-sm font-mono font-semibold text-charcoal">{network.mqtt_publish_latency_ms ? `${network.mqtt_publish_latency_ms.toFixed(1)} ms` : '--'}</p>
                        </div>
                    </div>
                    )}
                    
                    {/* Hide Frame Button (Admin Only) */}
                    {currentSegment && (
                    <div className="mt-4 bg-white border border-outline-variant/60 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-bold text-charcoal">Visibilitas Frame</h4>
                                <p className="text-xs text-on-surface-variant mt-1">Status saat ini: {currentSegment.hidden ? <span className="text-alert-red font-bold">Disembunyikan (Hidden)</span> : <span className="text-signal-green font-bold">Terlihat (Visible)</span>}</p>
                            </div>
                            <button
                                onClick={async () => {
                                    if (!currentSegment.dbId) {
                                        alert("Frame tidak ditemukan di database.");
                                        return;
                                    }
                                    const newHiddenStatus = !currentSegment.hidden;
                                    const { error } = await supabase.from('frame_records').update({ hidden: newHiddenStatus }).eq('id', currentSegment.dbId);
                                    if (error) {
                                        alert("Gagal mengubah status: " + error.message);
                                    } else {
                                        setSegments(prev => ({
                                            ...prev,
                                            [selectedIdx]: {
                                                ...prev[selectedIdx],
                                                hidden: newHiddenStatus
                                            }
                                        }));
                                    }
                                }}
                                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${currentSegment.hidden ? 'bg-signal-green/10 text-signal-green border-signal-green/30 hover:bg-signal-green/20' : 'bg-alert-red/10 text-alert-red border-alert-red/30 hover:bg-alert-red/20'}`}
                            >
                                {currentSegment.hidden ? 'Unhide Frame' : 'Hide Frame'}
                            </button>
                        </div>
                    </div>
                    )}

                    <div className="mt-auto">
                        <DeviceCard deviceId={deviceId} aiMetrics={aiMetrics} isLive={false} />
                    </div>

                </aside>
            </div>
            )}
            </main>
        </div>
    );
};