import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DoctorSidebar } from '../../components/layout/DoctorSidebar';
import { useSidebar } from '../../../application/context/SidebarContext';
import { useConnection } from '../../../application/context/ConnectionContext';
import { API_URL } from '../../../config/env';
import { fetchWithAuth } from '../../../config/api';
import { useCachedFetch } from '../../../application/hooks/useCachedFetch';

export interface SessionRecord {
    id: string;
    device_id: string;
    patient_id: string | null;
    patient_name: string | null;
    started_at: string;
    ended_at: string | null;
    file_path: string;
}

export interface DeviceRecord {
    id: string;
    name: string;
}

export const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { isOpen, toggleSidebar } = useSidebar();
    const { connectedPatients, removeConnectedPatient, disconnectAll } = useConnection();
    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [patientToDisconnect, setPatientToDisconnect] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // (Patient profile syncing removed for multi-patient support to simplify state)

    useEffect(() => {
        // Jika kembali (Back) dari impersonasi, pulihkan sesi dokter
        const docToken = localStorage.getItem('doctor_auth_token');
        if (docToken && localStorage.getItem('user_role') !== 'dokter') {
            localStorage.setItem('auth_token', docToken);
            localStorage.setItem('user_role', 'dokter');
            const docId = localStorage.getItem('doctor_user_id');
            if (docId) localStorage.setItem('user_id', docId);
        }
    }, []);

    const role = localStorage.getItem('user_role');
    const userId = localStorage.getItem('user_id');
    const sessionsUrl = role === 'dokter' ? `/api/sessions?doctor_id=${userId}` : `/api/sessions`;

    const { data: sessionsResponse } = useCachedFetch(sessionsUrl);
    const { data: devicesResponse } = useCachedFetch(`/api/devices`);

    const sessions: SessionRecord[] = sessionsResponse?.data || sessionsResponse?.sessions || (Array.isArray(sessionsResponse) ? sessionsResponse : []);
    const devices: DeviceRecord[] = devicesResponse?.devices || (Array.isArray(devicesResponse) ? devicesResponse : []);

    const activeSessions = sessions.filter(session => !session.ended_at);

    const filteredHistorySessions = sessions; // Removed specific patient filter for now, or could filter if needed

    const handleImpersonate = async (patientId: string) => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetchWithAuth(`/api/doctors/impersonate/${patientId}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            
            if (data.success && data.user_id) {
                // Backup doctor credentials sebelum impersonate
                const currentRole = localStorage.getItem('user_role');
                if (currentRole === 'dokter') {
                    localStorage.setItem('doctor_auth_token', token || '');
                    localStorage.setItem('doctor_user_id', localStorage.getItem('user_id') || '');
                    localStorage.setItem('original_role', 'dokter');
                }
                sessionStorage.setItem('is_impersonating', 'true');

                // Clear old connected state
                localStorage.removeItem('connectedPatients');
                localStorage.removeItem('connectedDoctor');
                localStorage.removeItem('mock_patient_profile');
                
                // Set new credentials
                localStorage.setItem('user_id', data.user_id.toString());
                localStorage.setItem('user_role', data.role);
                if (data.token) {
                    localStorage.setItem('auth_token', data.token);
                }
                
                // Navigate
                if (data.role === 'pasien') {
                    navigate('/patient/dashboard');
                }
            } else {
                alert(data.message || 'Gagal melakukan impersonate.');
            }
        } catch (err) {
            console.error("Gagal impersonate", err);
            alert("Koneksi ke server gagal.");
        }
    };

    return (
        <div className="bg-clinical-surface text-clinical-charcoal antialiased overflow-x-hidden w-full relative min-h-screen">
            <div className="fixed inset-0 ecg-grid opacity-10 pointer-events-none z-0"></div>
            <DoctorSidebar />
            <main id="main-content" className={`min-h-screen pb-24 md:pb-12 transition-all duration-300 w-full relative z-10 ${isOpen ? 'md:ml-[260px] md:w-[calc(100%-260px)]' : 'ml-0'}`}>

                <header className="sticky top-0 bg-clinical-surface/80 backdrop-blur-xl border-b border-clinical-charcoal/5 z-40 px-4 md:px-6 py-4 flex justify-between items-center max-w-container-max mx-auto w-full">
                    <div className="flex items-center gap-3">
                        <button onClick={toggleSidebar} id="toggle-sidebar-btn" className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-white-container text-clinical-charcoal/70 transition-colors outline-none" title="Sembunyikan / Tampilkan Menu Utama">
                            <span className="material-symbols-outlined">menu</span>
                        </button>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-clinical-charcoal">Dashboard Utama Klinis</h1>
                            <p className="text-xs md:text-sm font-medium text-clinical-charcoal/60 mt-0.5">
                                {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(currentTime)} • {new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(currentTime).replace(/\./g, ':')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/doctor/qr-scanner')} className="bg-clinical-blue hover:brightness-110 text-white px-6 py-2.5 rounded-[2rem] flex items-center gap-2 transition-all duration-700 active:scale-95 shadow-md hover:shadow-lg text-sm font-bold">
                            <span className="material-symbols-outlined text-[20px]">add</span>
                            <span className="hidden sm:inline">Pasien Baru</span>
                        </button>
                    </div>
                </header>

                <div className="px-4 md:px-6 max-w-container-max mx-auto mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
                    {activeSessions.length > 0 && (
                        <section className="mb-6">
                            <div className="bg-white border border-clinical-charcoal/5 rounded-[2rem] p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1 relative overflow-hidden group">
                                <div className="flex gap-5 relative z-10 items-center">
                                    <div className="bg-clinical-surface text-clinical-blue p-4 rounded-[1.5rem] h-fit flex items-center justify-center group-hover:bg-clinical-blue group-hover:text-white transition-colors duration-700">
                                        <span className="material-symbols-outlined text-[32px] animate-pulse shadow-[0_0_15px_rgba(23,107,206,0.5)] rounded-full">monitor_heart</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-clinical-blue mb-1">Sesi Perekaman Aktif</p>
                                        <h2 className="text-2xl font-bold text-clinical-charcoal">{activeSessions[0].patient_name || 'Tidak Diketahui'}</h2>
                                        <p className="text-sm font-medium text-clinical-charcoal/60 flex items-center gap-1.5 mt-1">
                                            <span className="material-symbols-outlined text-[16px]">router</span> Alat: {activeSessions[0].device_id}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 w-full lg:w-auto relative z-10 mt-4 lg:mt-0">
                                    <button onClick={() => navigate('/doctor/monitor')} className="w-full lg:w-auto bg-clinical-charcoal text-white px-8 py-3.5 rounded-[2rem] font-bold hover:brightness-110 shadow-md transition-all duration-700 active:scale-95 flex items-center justify-center gap-2">
                                        <span>Buka Live Monitor</span>
                                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                    </button>
                                </div>
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none z-0 group-hover:scale-110 transition-transform duration-700 text-clinical-blue">
                                    <span className="material-symbols-outlined text-[160px] translate-x-1/4">monitor_heart</span>
                                </div>
                            </div>
                        </section>
                    )}





                    <section className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-base font-body-md font-headline-md text-clinical-charcoal flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${connectedPatients.length > 0 ? 'bg-clinical-blue animate-pulse' : 'bg-clinical-blue/20'}`}></span>
                                <span>Pasien Terhubung ({connectedPatients.length})</span>
                            </h2>
                        </div>
                        <div className="space-y-3">
                            {connectedPatients.length > 0 ? (
                                connectedPatients.map(patient => (
                                    <div key={patient.id} className="bg-white border border-clinical-charcoal/5 p-6 rounded-[2rem] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1 group">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 rounded-full bg-clinical-surface group-hover:bg-clinical-blue/10 transition-colors duration-700 flex items-center justify-center text-lg font-bold text-clinical-blue uppercase border border-clinical-charcoal/5 overflow-hidden">
                                                {patient.profile_photo ? (
                                                    <img src={patient.profile_photo} alt={patient.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    patient.name.substring(0, 2).toUpperCase()
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg text-clinical-charcoal group-hover:text-clinical-blue transition-colors duration-700">{patient.name}</h4>
                                                <p className="text-xs font-medium text-clinical-charcoal/60 mt-0.5 mb-2">ID: {patient.id}</p>
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-clinical-surface text-clinical-blue text-[10px] font-bold uppercase tracking-widest border border-clinical-charcoal/5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-clinical-blue animate-pulse"></div>
                                                    Terkoneksi & Siap
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                                            <button onClick={() => navigate('/doctor/analytics')} className="flex-1 sm:flex-none border border-clinical-charcoal/10 text-clinical-charcoal hover:bg-clinical-surface px-6 py-2.5 rounded-[2rem] text-sm font-bold bg-white transition-all duration-700 flex items-center justify-center gap-2 active:scale-95">
                                                <span className="material-symbols-outlined text-[18px]">history</span>
                                                Riwayat
                                            </button>
                                            <button onClick={() => {
                                                setPatientToDisconnect(patient.id);
                                                setShowDisconnectModal(true);
                                            }} className="flex-1 sm:flex-none bg-white border border-clinical-red/20 text-clinical-red hover:bg-red-50 hover:border-clinical-red/40 px-6 py-2.5 rounded-[2rem] text-sm font-bold transition-all duration-700 flex items-center justify-center gap-2 active:scale-95 shadow-sm hover:shadow-md">
                                                <span className="material-symbols-outlined text-[18px]">person_remove</span>
                                                Putuskan
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="bg-white border border-clinical-charcoal/5 p-8 rounded-[2rem] flex flex-col items-center justify-center shadow-[0px_20px_40px_rgba(0,0,0,0.04)] text-center">
                                    <span className="material-symbols-outlined text-4xl text-clinical-charcoal/20 mb-3">group_off</span>
                                    <p className="text-sm font-medium text-clinical-charcoal/60">Tidak ada pasien yang menunggu saat ini.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-base font-body-md font-headline-md text-clinical-charcoal flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-clinical-blue/20"></span>
                                <span>Riwayat Seluruh Pasien</span>
                            </h2>
                            <button onClick={() => navigate('/doctor/analytics')} className="text-clinical-blue font-headline-md text-sm font-body-sm hover:underline flex items-center gap-1 transition-all hover:gap-2">
                                <span>Lihat Semua Arsip</span>
                                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </button>
                        </div>

                        <div className="space-y-3">
                            {connectedPatients.length === 0 ? (
                                <div className="bg-white border border-clinical-charcoal/5 p-8 rounded-[2rem] flex flex-col items-center justify-center shadow-[0px_20px_40px_rgba(0,0,0,0.04)] text-center">
                                    <span className="material-symbols-outlined text-4xl text-clinical-charcoal/20 mb-3">link_off</span>
                                    <p className="text-sm font-medium text-clinical-charcoal/60">Sambungkan ke pasien untuk melihat riwayat rekaman.</p>
                                </div>
                            ) : filteredHistorySessions.length === 0 ? (
                                <div className="bg-white border border-clinical-charcoal/5 p-8 rounded-[2rem] flex flex-col items-center justify-center shadow-[0px_20px_40px_rgba(0,0,0,0.04)] text-center">
                                    <span className="material-symbols-outlined text-4xl text-clinical-charcoal/20 mb-3">folder_off</span>
                                    <p className="text-sm font-medium text-clinical-charcoal/60">Belum ada riwayat sesi yang tersimpan.</p>
                                </div>
                            ) : (
                                <>
                                    {filteredHistorySessions.slice(0, 3).map(session => (
                                        <div key={session.id} className="bg-white border border-clinical-charcoal/5 p-6 rounded-[2rem] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1 group relative overflow-hidden">
                                            <div className="flex items-center gap-5 relative z-10">
                                                <div className="w-12 h-12 rounded-full bg-clinical-surface group-hover:bg-clinical-blue/10 transition-colors duration-700 flex items-center justify-center text-base font-bold text-clinical-charcoal/40 uppercase overflow-hidden">
                                                    {session.patient_name ? session.patient_name.substring(0, 2).toUpperCase() : 'UK'}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-base text-clinical-charcoal truncate max-w-[150px] sm:max-w-[200px] group-hover:text-clinical-blue transition-colors duration-700">{session.patient_name || 'Pasien Anonim'}</h4>
                                                    <p className="text-xs font-medium text-clinical-charcoal/60 mt-0.5">Sesi: {session.id.substring(0, 8)}... • SN: {session.device_id}</p>
                                                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-clinical-charcoal/60 font-bold uppercase tracking-widest">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-clinical-charcoal/20"></div>
                                                        Tersimpan
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0 relative z-10">
                                                <button onClick={() => navigate(`/doctor/analytics?sessionId=${session.id}`)} className="border border-clinical-charcoal/10 text-clinical-charcoal hover:bg-clinical-surface px-6 py-2.5 rounded-[2rem] text-sm font-bold bg-white transition-all duration-700 flex items-center gap-2 active:scale-95 w-full justify-center sm:w-auto">
                                                    <span className="material-symbols-outlined text-[18px]">history</span>
                                                    Lihat Arsip
                                                </button>
                                            </div>
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none z-0 group-hover:scale-110 transition-transform duration-700 text-clinical-charcoal">
                                                <span className="material-symbols-outlined text-[120px] translate-x-1/4">folder</span>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredHistorySessions.length > 3 && (
                                        <div className="text-center pt-2">
                                            <p className="text-xs font-body-sm text-clinical-charcoal/70">
                                                Menampilkan 3 riwayat terbaru. <button onClick={() => navigate('/doctor/analytics')} className="text-clinical-blue font-headline-md hover:underline">Klik Lihat Semua Arsip</button> untuk melihat {filteredHistorySessions.length - 3} rekaman lainnya.
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </section>
                </div>
            </main>



            {/* Disconnect Modals */}
            {showDisconnectModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white-container-lowest rounded-2xl p-6 w-full max-w-sm border border-clinical-blue/20 shadow-xl animate-in zoom-in-50 fade-in duration-500 ease-spring">
                        <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mb-4 text-error">
                            <span className="material-symbols-outlined text-2xl">warning</span>
                        </div>
                        <h3 className="font-headline-md text-headline-md text-clinical-charcoal mb-2">Putuskan Hubungan?</h3>
                        <p className="font-body-md text-body-md text-clinical-charcoal/70 mb-6">Apakah Anda yakin ingin memutuskan hubungan dengan pasien ini? Pemantauan live akan terhenti dan Anda harus melakukan scan QR ulang untuk memantau lagi.</p>
                        <div className="flex gap-3">
                            <button onClick={() => {
                                setShowDisconnectModal(false);
                                setPatientToDisconnect(null);
                            }} className="flex-1 py-2 rounded-lg font-label-bold text-label-bold border border-clinical-blue/20 hover:bg-white-container text-clinical-charcoal/70 transition-colors">Batal</button>
                            <button onClick={async () => {
                                if (patientToDisconnect) {
                                    await removeConnectedPatient(patientToDisconnect);
                                    setPatientToDisconnect(null);
                                } else {
                                    // Fallback if no specific patient selected (should not happen)
                                    disconnectAll();
                                }
                                setShowDisconnectModal(false);
                                setShowSuccessModal(true);
                            }} className="flex-1 py-2 rounded-lg font-label-bold text-label-bold bg-error text-white hover:bg-red-600 transition-colors shadow-sm">Ya, Putuskan</button>
                        </div>
                    </div>
                </div>
            )}

            {showSuccessModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white-container-lowest rounded-2xl p-6 w-full max-w-sm border border-clinical-blue/20 shadow-xl text-center animate-in zoom-in-50 fade-in duration-500 ease-spring">
                        <div className="w-16 h-16 rounded-full bg-status-green/10 flex items-center justify-center mb-4 text-status-green mx-auto">
                            <span className="material-symbols-outlined text-3xl">check_circle</span>
                        </div>
                        <h3 className="font-headline-md text-headline-md text-clinical-charcoal mb-2">Berhasil Terputus</h3>
                        <p className="font-body-md text-body-md text-clinical-charcoal/70 mb-6">Koneksi dengan pasien telah berhasil dibatalkan.</p>
                        <button onClick={() => setShowSuccessModal(false)} className="w-full py-3 rounded-lg font-label-bold text-label-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm">Tutup</button>
                    </div>
                </div>
            )}

        </div>
    );
};
