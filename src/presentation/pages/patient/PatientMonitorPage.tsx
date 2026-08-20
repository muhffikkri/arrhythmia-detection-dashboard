/**
 * @fileoverview Halaman UI: Monitor Page
 * Mengorkestrasi Custom Hook (useECGStream) dan mendistribusikan
 * state ke komponen-komponen UI modular (Clean Architecture).
 * 
 * UPDATE: Penambahan fitur Bypass Filter (ON/OFF) untuk komparasi sinyal mentah.
 */

import React, { useState, useEffect } from 'react';
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

    const [speed] = useState<25 | 50>(25);
    const [showAlert, setShowAlert] = useState<boolean>(false);

    const { scale } = useECGScale();
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
                    startStream(); // Only reconnect WebSocket, do not send START command
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
                        {/* Top Control Panel */}
                        <div className="bg-white rounded-[2rem] px-8 py-4 flex flex-wrap justify-between items-center shadow-[0px_20px_40px_rgba(0,0,0,0.04)] border border-clinical-charcoal/5 gap-4 group hover:-translate-y-1 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] transition-all duration-700">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2 text-clinical-charcoal">
                                    <span className="material-symbols-outlined text-clinical-blue group-hover:scale-110 transition-transform duration-700">tune</span>
                                    <span className="text-[12px] font-bold uppercase tracking-[0.2em] hidden sm:block opacity-80">
                                        Kecepatan: <span className="font-mono-data text-clinical-blue font-bold ml-1">{speed} mm/s</span>
                                    </span>
                                </div>

                                <div className="h-6 w-px bg-clinical-charcoal/10 hidden sm:block"></div>

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

                                {/* TOMBOL BYPASS FILTER BARU */}
                                <button
                                    onClick={toggleFilter}
                                    className={`${isFilterOn ? 'bg-blue-50 text-clinical-blue border-blue-100' : 'bg-clinical-surface text-clinical-charcoal/60 border-clinical-charcoal/5'} border px-5 py-2.5 rounded-full font-bold uppercase tracking-wider text-[10px] transition-all duration-300 flex items-center gap-2 outline-none hover:-translate-y-0.5 hover:shadow-sm`}
                                    title="Matikan untuk melihat sinyal mentah asli (Raw Data) dari perangkat"
                                >
                                    <span className="material-symbols-outlined text-[16px]">
                                        {isFilterOn ? 'filter_alt' : 'filter_alt_off'}
                                    </span>
                                    <span className="hidden sm:inline">Filter: {isFilterOn ? 'ON' : 'OFF'}</span>
                                </button>
                                
                            </div>
                        </div>

                        <div className="relative flex-1 min-h-[560px] md:min-h-[600px] group">
                            <div className="absolute inset-0 z-0 bg-white border border-clinical-charcoal/5 rounded-[2rem] overflow-y-auto overflow-x-hidden shadow-[0px_20px_40px_rgba(0,0,0,0.04)] flex flex-col transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1">
                                <ECGCanvas
                                    paths={paths}
                                    rPeaks={rPeaks}
                                    speed={speed}
                                    isAnomaly={clinicalStatus?.isAnomaly}
                                    classResult={aiClassResult}
                                    scale={scale}
                                />
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