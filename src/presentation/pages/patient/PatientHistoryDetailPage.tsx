import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PatientHeader } from '../../components/layout/PatientHeader';
import { EcgViewer } from '../../components/dashboard/EcgViewer';
import { TimelineBar } from '../../components/shared/TimelineBar';
import { VitalCard } from '../../components/dashboard/VitalCard';
import { AiCard } from '../../components/dashboard/AiCard';
import { DeviceCard } from '../../components/dashboard/DeviceCard';
import type { ECGPaths, TimelineEvent } from '../../../core/types/ecgTypes';
import { calculateEinthovenPoint } from '../../../core/algorithms/einthoven';
import { PanTompkins } from '../../../core/algorithms/panTompkins';
import { DCBlocker } from '../../../core/algorithms/dcBlocker';
import { evaluateIrregularity } from '../../../core/clinical/ruleBasedEngine';
import type { ClinicalExplanation } from '../../../core/clinical/ruleBasedEngine';
import { useTranslation } from '../../../application/hooks/useTranslation';
import { useECGScale } from '../../../application/hooks/useECGScale';
import { API_URL } from '../../../config/env';
import { fetchWithAuth } from '../../../config/api';
import { supabase } from '../../../config/supabaseClient';

interface PatientProfile {
    patient: {
        first_name: string;
        last_name: string;
        profile_photo: string | null;
    }
}

export const PatientHistoryDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { sessionId } = useParams<{ sessionId: string }>();
    const [profile, setProfile] = useState<PatientProfile | null>(null);
    const { t } = useTranslation();

    // Analytics states
    const [speed, setSpeed] = useState<25 | 50>(25);
    const [selectedIdx, setSelectedIdx] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [segments, setSegments] = useState<Record<number, any>>({});
    
    const { scale } = useECGScale();
    const getInitials = (firstName: string, lastName: string) => {
        if (!firstName && !lastName) return '';
        return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();
    };

    useEffect(() => {
        const userId = localStorage.getItem('user_id') || '1';
        fetchWithAuth(`/api/patients/${userId}`)
            .then(res => res.json())
            .then(data => setProfile(data))
            .catch(console.error);

        setIsLoading(true);
        setIsLoading(true);
        Promise.all([
            fetchWithAuth(`/api/records/${sessionId}`).then(res => res.json()),
            supabase.from('frame_records').select('start_time, label, hidden').eq('session_id', sessionId)
        ])
            .then(([rawData, { data: frameRecords }]) => {
                let data = rawData;
                if (data && data.length > 0) {
                    // Filter payloads to only show one recording session (handles merged mockup files)
                    const targetSessionId = data[data.length - 1].session_id;
                    if (targetSessionId) {
                        data = data.filter((p: any) => p.session_id === targetSessionId);
                    }
                }

                const loadedEvents: TimelineEvent[] = [];
                const loadedSegments: Record<number, any> = {};

                const pt = new PanTompkins(250);
                const globalDcBlocker = new DCBlocker(); // Jalur Matematis: Kontinu
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

                    const evalResult = evaluateIrregularity(rrIntervals);
                    const calculatedHR = evalResult.hr > 0 ? evalResult.hr : (payload.validation?.hr || payload.heart_rate || (i > 0 ? loadedSegments[i-1].heartRate : "--"));

                        loadedSegments[i] = {
                            payload, // Store the raw payload so EcgViewer can parse it lazily
                            rPeaks: [],
                            isAnomaly,
                            diagnosis: isAnomaly ? "Anomali Terdeteksi pada rekaman." : "Normal Sinus Rhythm. Variasi stabil.",
                            heartRate: calculatedHR,
                        frameId: payload.message_id || payload.frame_id || "---",
                        deviceId: payload.device_id || "---",
                        createdAt: payload.created_at || "---",
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
            })
            .catch(err => {
                console.error("Error fetching mock records:", err);
                setIsLoading(false);
            });
    }, [sessionId]);

    const patientName = profile ? `${profile.patient.first_name} ${profile.patient.last_name}` : t('profile.loading');

    const currentSegment = segments[selectedIdx];
    const currentEvent = events.find(e => e.index === selectedIdx);

    const clinicalStatus: ClinicalExplanation | null = currentSegment ? {
        isAnomaly: currentSegment.isAnomaly,
        fullExplanation: `${currentSegment.isAnomaly ? 'Anomali Terdeteksi' : 'Normal'} - ${currentEvent?.classResult}. ${currentSegment.diagnosis}`,
        severity: currentSegment.isAnomaly ? "CRITICAL" : "NORMAL"
    } : null;

    const heartRate = currentSegment?.heartRate || "--";
    const stressTest = currentSegment?.stressTest || null;
    let createdAt = currentSegment?.createdAt || new Date().toISOString();
    const aiProbabilities = currentSegment?.aiProbabilities || null;
    const deviceId = currentSegment?.deviceId || "---";
    const aiMetrics = currentSegment?.aiMetrics || null;

    return (
        <div className="bg-clinical-surface/30 text-clinical-charcoal min-h-screen w-full flex flex-col transition-colors duration-700 relative">
            <div className="absolute inset-0 ecg-grid opacity-[0.15] z-0 pointer-events-none"></div>

            <div className="relative z-10 flex flex-col flex-1">
                {/* Top Navigation Bar */}
                <PatientHeader />


                {/* Main Canvas Content */}
                <main className="flex-1 w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-8">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                        {/* KOLOM KIRI: GRAFIK & TIMELINE */}
                        <section className="lg:col-span-3 flex flex-col gap-6">

                            {/* Control Bar */}
                            <div className="bg-white border border-clinical-charcoal/5 rounded-[2rem] px-6 py-3 flex flex-wrap justify-between items-center shadow-[0px_20px_40px_rgba(0,0,0,0.04)] gap-4 transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1">
                                <div className="flex items-center gap-4">
                                    <div className="bg-clinical-blue/10 p-2.5 rounded-full text-clinical-blue">
                                        <span className="material-symbols-outlined block text-[24px]">schedule</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-clinical-charcoal/60 uppercase tracking-widest">{t('history.recordingTime')}</p>
                                        <p className="text-sm font-bold text-clinical-charcoal mt-0.5">
                                            {currentEvent ? `${currentEvent.timeStr} - ${events[selectedIdx + 1]?.timeStr || t('history.end')}` : '--'}
                                        </p>
                                    </div>
                                </div>
                                
                            </div>

                            {/* Pembungkus Kanvas 7-Lead */}
                            <div className="relative flex-1 min-h-[400px]">
                                <div className="absolute inset-0 z-0 bg-white border border-clinical-blue/20 rounded-[2rem] overflow-y-auto overflow-x-hidden shadow-[0px_20px_40px_rgba(0,0,0,0.04)] flex flex-col">
                                    <EcgViewer 
                                        segment={currentSegment}
                                        speed={speed} 
                                        classResult={currentEvent?.classResult} 
                                        timeOffset={selectedIdx * 10}
                                    />
                                    {isLoading && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-md z-50 transition-all duration-300">
                                        <span className="material-symbols-outlined text-clinical-blue text-4xl animate-spin">sync</span>
                                        <p className="mt-3 text-sm font-bold text-clinical-charcoal">{t('history.loadingSegment')}</p>
                                    </div>
                                    )}
                                </div>
                            </div>

                            {/* Timeline Multi-Aritmia */}
                            {events.length > 0 && (
                                <div className="flex-shrink-0">
                                    <TimelineBar
                                        events={events}
                                        currentIdx={selectedIdx}
                                        onSegmentSelect={(idx: number) => {
                                            setIsLoading(true);
                                            setTimeout(() => {
                                                setSelectedIdx(idx);
                                                setIsLoading(false);
                                            }, 300);
                                        }}
                                    />
                                </div>
                            )}

                        </section>

                        {/* KOLOM KANAN: DETAIL ANALISIS HISTORIS */}
                        <aside className="lg:col-span-1 flex flex-col gap-5 h-fit">
                            <VitalCard heartRate={heartRate} clinicalStatus={clinicalStatus} stressTest={stressTest} createdAt={createdAt} hideTechnicalDetails={true} />

                            {/* Kesimpulan Analisis (Patient Friendly) */}
                            <div className="bg-white border border-clinical-charcoal/5 rounded-[2rem] p-6 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-clinical-blue text-[20px]">psychiatry</span>
                                    <h3 className="font-bold text-clinical-charcoal text-sm">{t('history.conclusion')}</h3>
                                </div>

                                {!clinicalStatus ? (
                                    <p className="text-sm text-clinical-charcoal/60 italic">{t('history.processing')}</p>
                                ) : clinicalStatus.severity === 'NORMAL' ? (
                                    <div className="space-y-3">
                                        <p className="text-sm text-clinical-charcoal leading-relaxed">
                                            {t('history.normalDesc')}<strong className="text-status-green">{t('history.normalStatus')}</strong>{t('history.normalDesc2')}
                                        </p>
                                        <p className="text-sm text-clinical-charcoal leading-relaxed mt-2 bg-green-50 p-3 rounded-lg border border-green-100">
                                            {t('history.normalTip')}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 mb-2">
                                            <p className="text-sm text-clinical-red font-bold flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[18px]">warning</span>
                                                {t('history.anomalyDetected')}
                                            </p>
                                        </div>
                                        <p className="text-sm text-clinical-charcoal leading-relaxed">
                                            {t('history.anomalyDesc1')}<strong className="text-clinical-red">{currentEvent?.classResult || 'Aritmia'}</strong>{t('history.anomalyDesc2')}
                                        </p>
                                        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mt-2">
                                            <p className="text-sm text-clinical-charcoal leading-relaxed font-bold">
                                                {t('history.anomalyTip')}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </aside>

                    </div>
                </main>

                {/* Bottom Navigation Shell (Sembunyikan sepenuhnya sesuai permintaan pengguna) */}
                <nav className="hidden fixed bottom-0 left-0 w-full flex justify-around items-center h-20 bg-white border-t border-clinical-charcoal/10 z-50">
                </nav>
            </div>
        </div>
    );
};
