import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnection } from '../../../application/context/ConnectionContext';
import { PatientHeader } from '../../components/layout/PatientHeader';
import { useTranslation } from '../../../application/hooks/useTranslation';
import { API_URL } from '../../../config/env';
import { fetchWithAuth } from '../../../config/api';
import { useCachedFetch } from '../../../application/hooks/useCachedFetch';
import { supabase } from '../../../config/supabaseClient';

interface PatientProfile {
  patient: {
    id: number;
    first_name: string;
    last_name: string;
    age: number;
    gender: string;
    primary_doctor_id: number | null;
    profile_photo: string | null;
    device_id: string | null;
  };
  doctor: {
    id: number;
    first_name: string;
    last_name: string;
    profile_photo: string | null;
  } | null;
}


export const PatientDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { connectedDoctor, setConnectedDoctor, disconnectAll } = useConnection();
  const { t, tArray } = useTranslation();
  
  const userId = localStorage.getItem('user_id') || '1';
  const { data: profileData, mutate: mutateProfile, error: profileError } = useCachedFetch(`/api/patients/${userId}`);
  const { data: sessionsResponse } = useCachedFetch(`/api/patients/${userId}/sessions`);
  const { data: doctorData } = useCachedFetch(profileData?.patient?.primary_doctor_id ? `/api/doctors/${profileData.patient.primary_doctor_id}` : null);

  const profile: PatientProfile | null = profileData || null;
  const sessions = sessionsResponse?.data || sessionsResponse?.sessions || (Array.isArray(sessionsResponse) ? sessionsResponse : []);

  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showUnsyncModal, setShowUnsyncModal] = useState(false);
  const [error, setError] = useState<string | null>(profileError?.message || null);
  
  const [syncedDeviceId, setSyncedDeviceId] = useState<string | null>(localStorage.getItem('synced_device_id'));
  const [localRecordingStopped, setLocalRecordingStopped] = useState(localStorage.getItem('web_recording_stopped') === 'true');

  useEffect(() => {
    if (profile?.patient?.device_id) {
        localStorage.setItem('synced_device_id', profile.patient.device_id);
        setSyncedDeviceId(profile.patient.device_id);
    } else if (profile) {
        localStorage.removeItem('synced_device_id');
        setSyncedDeviceId(null);
    }
  }, [profile]);

  useEffect(() => {
    const handleUpdate = () => mutateProfile();
    window.addEventListener('patient_profile_updated', handleUpdate);
    return () => window.removeEventListener('patient_profile_updated', handleUpdate);
  }, [mutateProfile]);

  const activeSession = sessions.find((s: any) => !s.ended_at);
  const isRecording = !!activeSession && !localRecordingStopped;

  useEffect(() => {
    if (doctorData) {
      const newName = `Dr. ${doctorData.first_name} ${doctorData.last_name}`;
      const newPhoto = doctorData.profile_photo || undefined;
      const docIdToFetch = doctorData.id;
      if (connectedDoctor) {
        if (newName !== connectedDoctor.name || newPhoto !== connectedDoctor.photo || docIdToFetch !== connectedDoctor.id) {
          setConnectedDoctor({
            id: docIdToFetch.toString(),
            name: newName,
            hospital: "",
            photo: newPhoto
          });
        }
      } else {
        setConnectedDoctor({
          id: docIdToFetch.toString(),
          name: newName,
          hospital: "",
          photo: newPhoto
        });
      }
    }
  }, [doctorData, connectedDoctor, setConnectedDoctor]);

  const greetings = tArray('dashboard.greetingsArray');
  const healthTips = tArray('dashboard.healthTipsListArray');

  const randomGreetingText = useMemo(() => {
    if (!greetings.length) return '';
    return greetings[Math.floor(Math.random() * greetings.length)];
  }, [greetings]);

  const randomHealthTipText = useMemo(() => {
    if (!healthTips.length) return '';
    return healthTips[Math.floor(Math.random() * healthTips.length)];
  }, [healthTips]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return t('dashboard.greetingMorning');
    if (hour >= 11 && hour < 15) return t('dashboard.greetingAfternoon');
    if (hour >= 15 && hour < 18) return t('dashboard.greetingEvening');
    return t('dashboard.greetingNight');
  };

  const getInitials = (firstName: string, lastName: string) => {
    if (!firstName && !lastName) return '';
    return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();
  };

  const patientName = profile ? `${profile.patient.first_name} ${profile.patient.last_name}` : t('dashboard.loading');

  if (error) {
    return (
      <div className="min-h-screen bg-clinical-surface/30 flex items-center justify-center p-8">
        <div className="bg-white p-8 rounded-2xl border border-red-100 shadow-xl max-w-md text-center text-clinical-charcoal">
            <span className="material-symbols-outlined text-5xl text-clinical-red mb-4">error</span>
            <h2 className="text-xl font-bold mb-2">Gagal Memuat Dasbor</h2>
            <p className="text-clinical-charcoal/60 mb-6">{error}</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => window.location.reload()} className="bg-clinical-blue hover:brightness-110 active:scale-95 text-white px-6 py-2.5 rounded-lg font-bold transition-all w-full">
                Coba Lagi
              </button>
              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  localStorage.clear();
                  window.location.href = '/auth/login';
                }} 
                className="bg-red-50 text-alert-red hover:bg-red-100 active:scale-95 px-6 py-2.5 rounded-lg font-bold transition-all w-full border border-red-100"
              >
                Keluar (Log Out)
              </button>
            </div>
        </div>
      </div>
    );
  }

  const displayDoctor = profile?.doctor ? {
    name: `Dr. ${profile.doctor.first_name} ${profile.doctor.last_name}`,
    hospital: t('dashboard.doctorRole'),
    photo: profile.doctor.profile_photo,
    isLive: !!connectedDoctor
  } : connectedDoctor ? {
    name: connectedDoctor.name,
    hospital: connectedDoctor.hospital || '',
    photo: connectedDoctor.photo || null,
    isLive: true
  } : null;

  return (
    <div className="bg-clinical-surface/30 text-clinical-charcoal w-full min-h-screen flex flex-col font-medium transition-colors duration-700 relative">
      <div className="absolute inset-0 ecg-grid opacity-[0.15] z-0 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col flex-1">
      {/* Top Navigation Bar */}
      <PatientHeader />
      {/* Main Content Area */}
      <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Main Patient Monitoring */}
          <div className="lg:col-span-8 flex flex-col h-full gap-8">
            {/* Live Device Status */}
            {isRecording && (
              <section className="bg-white border border-clinical-charcoal/5 rounded-[2rem] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1 relative group z-10">
                <div className="flex items-start gap-5">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center border border-clinical-charcoal/5 group-hover:scale-110 transition-transform duration-700 ${isRecording ? 'bg-blue-50/50 text-clinical-blue' : 'bg-slate-50 text-clinical-charcoal/40'}`}>
                    <span className={`material-symbols-outlined text-[26px] ${isRecording ? 'text-clinical-blue animate-pulse' : 'text-clinical-charcoal/40'}`}>sensors</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold font-display text-clinical-charcoal">{isRecording ? t('dashboard.deviceRecording') : t('dashboard.deviceInactive')}</h2>
                      <div className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-clinical-blue shadow-[0_0_10px_rgba(23,107,206,0.5)] animate-pulse' : 'bg-slate-300'}`}></div>
                    </div>
                    <p className="text-sm font-medium text-clinical-charcoal/60 mt-1">{isRecording ? t('dashboard.deviceRecordingDesc') : t('dashboard.deviceInactiveDesc')}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 md:gap-6 bg-white border border-clinical-charcoal/5 p-4 rounded-2xl">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-clinical-charcoal/80">
                    <span className="material-symbols-outlined text-clinical-blue text-[18px]">battery_very_low</span>
                    <span>85% - {t('dashboard.batteryGood')}</span>
                  </div>
                  <div className="hidden md:block w-px h-6 bg-clinical-charcoal/10"></div>
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-clinical-charcoal/80">
                    <span className="material-symbols-outlined text-clinical-blue text-[18px]">wifi</span>
                    <span>{t('dashboard.cloudSync')}</span>
                  </div>
                  <div className="hidden md:block w-px h-6 bg-clinical-charcoal/10"></div>
                  <button 
                    onClick={() => {
                        setLocalRecordingStopped(true);
                        localStorage.setItem('web_recording_stopped', 'true');
                    }}
                    className="flex items-center gap-2 text-clinical-red hover:bg-red-50/50 px-4 py-2 rounded-full transition-colors font-bold uppercase tracking-widest text-[10px]"
                  >
                    <span className="material-symbols-outlined text-[16px]">stop_circle</span>
                    Hentikan Rekaman
                  </button>
                </div>
              </section>
            )}
            {/* Daily Trend Visualization */}
            <div className="bg-white p-8 md:p-10 rounded-[2rem] shadow-[0px_20px_40px_rgba(0,0,0,0.04)] border border-clinical-charcoal/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1">
              <div className="z-10 flex flex-col">
                <h2 className="text-2xl md:text-3xl font-bold font-display text-clinical-charcoal mb-2 flex items-center flex-wrap gap-2">
                  {getGreeting()}, <span className="text-clinical-blue">{profile?.patient.first_name || 'Memuat...'}</span>
                  <span className="inline-block origin-bottom-right hover:rotate-12 transition-transform cursor-default">👋</span>
                </h2>
                <p className="text-base md:text-lg text-clinical-charcoal/70 max-w-2xl leading-relaxed">{randomGreetingText}</p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-clinical-surface flex items-center justify-center shrink-0 z-10 border border-clinical-charcoal/5 shadow-sm hidden md:flex hover:scale-105 active:scale-95 transition-transform duration-300 group cursor-pointer" title="Jaga kesehatan jantung Anda!">
                <span className="material-symbols-outlined text-4xl text-clinical-red transition-transform duration-300 group-hover:scale-125 group-active:scale-90" style={{ fontVariationSettings: '"FILL" 1' }}>favorite</span>
              </div>
            </div>

            <h3 className="text-xl font-bold font-display text-clinical-charcoal mb-0 mt-auto">{t('dashboard.menuAccess')}</h3>
            <div className="flex flex-col gap-4 flex-1">
              <div onClick={() => navigate('/patient/monitor')} className="bg-white text-clinical-charcoal border border-clinical-charcoal/5 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] p-6 rounded-[2rem] flex items-center gap-4 md:gap-6 cursor-pointer hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-700 group overflow-hidden relative flex-1">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-5 group-hover:scale-110 transition-transform duration-700 pointer-events-none text-clinical-blue">
                  <span className="material-symbols-outlined text-[160px] translate-x-1/4">monitor_heart</span>
                </div>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 z-10 transition-colors bg-clinical-surface text-clinical-blue group-hover:bg-clinical-blue group-hover:text-white duration-700">
                  <span className="material-symbols-outlined text-3xl">monitor_heart</span>
                </div>
                <div className="flex flex-col z-10">
                  <p className="text-xl font-bold font-display mb-1 text-clinical-charcoal group-hover:text-clinical-blue transition-colors duration-700">Live Monitor</p>
                  <p className="text-sm text-clinical-charcoal/60">Pantau gelombang jantung Anda secara real-time</p>
                </div>
              </div>

              <div onClick={() => navigate('/patient/qr-sync')} className="bg-white text-clinical-charcoal border border-clinical-charcoal/5 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] p-6 rounded-[2rem] flex items-center gap-4 md:gap-6 cursor-pointer hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-700 group overflow-hidden relative flex-1">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-5 group-hover:scale-110 transition-transform duration-700 pointer-events-none text-clinical-blue">
                  <span className="material-symbols-outlined text-[160px] translate-x-1/4">qr_code_2</span>
                </div>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 z-10 transition-colors bg-clinical-surface text-clinical-blue group-hover:bg-clinical-blue group-hover:text-white duration-700">
                  <span className="material-symbols-outlined text-3xl">qr_code_2</span>
                </div>
                <div className="flex flex-col z-10">
                  <p className="text-xl font-bold font-display mb-1 text-clinical-charcoal group-hover:text-clinical-blue transition-colors duration-700">{t('dashboard.qrSyncTitle')}</p>
                  <p className="text-sm text-clinical-charcoal/60">{t('dashboard.qrSyncDesc')}</p>
                </div>
              </div>

              <div onClick={() => navigate('/patient/device-scanner')} className="bg-white text-clinical-charcoal border border-clinical-charcoal/5 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] p-6 rounded-[2rem] flex items-center gap-4 md:gap-6 cursor-pointer hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-700 group overflow-hidden relative flex-1">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-5 group-hover:scale-110 transition-transform duration-700 pointer-events-none text-clinical-blue">
                  <span className="material-symbols-outlined text-[160px] translate-x-1/4">sensors</span>
                </div>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 z-10 transition-colors bg-clinical-surface text-clinical-blue group-hover:bg-clinical-blue group-hover:text-white duration-700">
                  <span className="material-symbols-outlined text-3xl">sensors</span>
                </div>
                <div className="flex flex-col z-10">
                  <p className="text-xl font-bold font-display mb-1 text-clinical-charcoal group-hover:text-clinical-blue transition-colors duration-700">Sinkronisasi Alat</p>
                  <p className="text-sm text-clinical-charcoal/60">Pindai kode QR dari alat fisik EKG Anda</p>
                </div>
              </div>

              <div onClick={() => navigate('/patient/history')} className="bg-white text-clinical-charcoal border border-clinical-charcoal/5 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] p-6 rounded-[2rem] flex items-center gap-4 md:gap-6 cursor-pointer hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-700 group overflow-hidden relative flex-1">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-5 group-hover:scale-110 transition-transform duration-700 pointer-events-none text-clinical-blue">
                  <span className="material-symbols-outlined text-[160px] translate-x-1/4">history</span>
                </div>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 z-10 transition-colors bg-clinical-surface text-clinical-blue group-hover:bg-clinical-blue group-hover:text-white duration-700">
                  <span className="material-symbols-outlined text-3xl">history</span>
                </div>
                <div className="flex flex-col z-10">
                  <p className="text-xl font-bold font-display mb-1 text-clinical-charcoal group-hover:text-clinical-blue transition-colors duration-700">{t('dashboard.historyTitle')}</p>
                  <p className="text-sm text-clinical-charcoal/60">{t('dashboard.historyDesc')}</p>
                </div>
              </div>

              <div onClick={() => navigate('/patient/settings')} className="bg-white text-clinical-charcoal border border-clinical-charcoal/5 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] p-6 rounded-[2rem] flex items-center gap-4 md:gap-6 cursor-pointer hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-700 group overflow-hidden relative flex-1">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-5 group-hover:scale-110 transition-transform duration-700 pointer-events-none text-clinical-blue">
                  <span className="material-symbols-outlined text-[160px] translate-x-1/4">person</span>
                </div>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 z-10 transition-colors bg-clinical-surface text-clinical-blue group-hover:bg-clinical-blue group-hover:text-white duration-700">
                  <span className="material-symbols-outlined text-3xl">person</span>
                </div>
                <div className="flex flex-col z-10">
                  <p className="text-xl font-bold font-display mb-1 text-clinical-charcoal group-hover:text-clinical-blue transition-colors duration-700">{t('dashboard.settingsTitle')}</p>
                  <p className="text-sm text-clinical-charcoal/60">{t('dashboard.settingsDesc')}</p>
                </div>
              </div>
            </div>
            {/* Quick Action: QR Sync */}
          </div>
          {/* Right Column: Sidebar */}
          <aside className="lg:col-span-4 space-y-8">
            {/* Connected Doctor Card */}
            {/* Connected Doctor Card */}
            <div className="bg-white rounded-[2rem] p-8 border border-clinical-charcoal/5 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] flex flex-col items-center text-center transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1">
              <div className="w-full flex justify-center border-b border-clinical-charcoal/10 pb-4 mb-6">
                <h4 className="font-bold text-[11px] text-clinical-charcoal/60 uppercase tracking-widest">{t('dashboard.connectedDoctor')}</h4>
              </div>

              {displayDoctor ? (
                <>
                  <div className="relative mb-4">
                    <div className="w-24 h-24 rounded-full border-4 border-clinical-surface overflow-hidden shadow-sm flex items-center justify-center bg-slate-50 text-3xl font-bold text-clinical-charcoal/40">
                      {displayDoctor.photo ? (
                        <img src={displayDoctor.photo} alt="Doctor" className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-5xl">person</span>
                      )}
                    </div>
                    {displayDoctor.isLive && (
                      <div className="absolute bottom-1 right-1 bg-status-green w-5 h-5 rounded-full border-4 border-white"></div>
                    )}
                  </div>
                  <h5 className="text-lg font-bold font-display text-clinical-charcoal">{displayDoctor.name}</h5>
                  {displayDoctor.hospital && (
                    <p className="text-sm font-medium text-clinical-charcoal/60 mb-4">{displayDoctor.hospital}</p>
                  )}

                  {displayDoctor.isLive ? (
                    <div className="bg-status-green/10 px-4 py-2 rounded-full mb-8">
                      <span className="text-[12px] font-bold text-status-green flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                        {t('dashboard.liveMonitoring')}
                      </span>
                    </div>
                  ) : (
                    <div className="bg-clinical-blue/10 px-4 py-2 rounded-full mb-8">
                      <span className="text-[12px] font-bold text-clinical-blue flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>verified_user</span>
                        {t('dashboard.primaryDoctor')}
                      </span>
                    </div>
                  )}

                  <div className="w-full mt-4 space-y-3">
                    <button onClick={() => alert(t('dashboard.comingSoon'))} className="w-full py-3 bg-clinical-surface hover:brightness-95 text-clinical-charcoal font-bold text-[13px] rounded-lg transition-colors flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-sm">chat</span>
                      {t('dashboard.sendMessage')}
                    </button>
                    {displayDoctor.isLive && (
                      <button onClick={() => setShowDisconnectModal(true)} className="w-full py-3 bg-red-50 hover:bg-red-100 text-clinical-red font-bold text-[13px] rounded-lg transition-colors flex items-center justify-center gap-2 border border-red-100">
                        <span className="material-symbols-outlined text-sm">sync_disabled</span>
                        {t('dashboard.cancelSync')}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mb-6 text-clinical-charcoal/30">
                    <span className="material-symbols-outlined text-5xl">person_off</span>
                  </div>
                  <h5 className="text-lg font-bold font-display text-clinical-charcoal mb-2">{t('dashboard.notConnected')}</h5>
                  <p className="text-sm font-medium text-clinical-charcoal/60 mb-6 leading-relaxed">{t('dashboard.notConnectedDesc')}</p>

                  <div className="bg-clinical-surface px-4 py-2 rounded-full mb-8">
                    <span className="text-[12px] font-bold text-clinical-charcoal/60 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>pending</span>
                      {t('dashboard.waitingAssignment')}
                    </span>
                  </div>

                  <div className="w-full mt-2">
                    <button onClick={() => navigate('/patient/qr-sync')} className="w-full py-3 bg-clinical-blue text-white font-bold text-[13px] rounded-lg hover:brightness-110 transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow-[0px_10px_20px_rgba(23,107,206,0.2)]">
                      <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
                      Sinkronisasi Dokter
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Connected Device Card */}
            <div className="bg-white rounded-[2rem] p-8 border border-clinical-charcoal/5 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] flex flex-col items-center text-center transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1">
              <div className="w-full flex justify-center border-b border-clinical-charcoal/10 pb-4 mb-6">
                <h4 className="font-bold text-[11px] text-clinical-charcoal/60 uppercase tracking-widest">Status Perangkat</h4>
              </div>
              
              {syncedDeviceId ? (
                <>
                  <div className="relative mb-4">
                    <div className="w-24 h-24 rounded-full border-4 border-clinical-surface overflow-hidden shadow-sm flex items-center justify-center bg-slate-50 text-3xl font-bold text-clinical-charcoal/40">
                      <span className="material-symbols-outlined text-5xl">sensors</span>
                    </div>
                    <div className="absolute bottom-1 right-1 bg-status-green w-5 h-5 rounded-full border-4 border-white"></div>
                  </div>
                  
                  <h5 className="text-lg font-bold font-display text-clinical-charcoal">{syncedDeviceId}</h5>
                  <p className="text-sm font-medium text-clinical-charcoal/60 mb-6 leading-relaxed">Alat siap digunakan.</p>

                  <div className="w-full space-y-3">
                    <button onClick={() => navigate('/patient/monitor')} className="w-full py-3 bg-clinical-blue text-white font-bold text-[13px] rounded-lg hover:brightness-110 transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow-[0px_10px_20px_rgba(23,107,206,0.2)]">
                      <span className="material-symbols-outlined text-sm">monitor_heart</span>
                      Live Monitor
                    </button>
                    <button onClick={() => setShowUnsyncModal(true)} className="w-full py-3 bg-red-50 hover:bg-red-100 text-clinical-red font-bold text-[13px] rounded-lg transition-colors flex items-center justify-center gap-2 border border-red-100">
                      <span className="material-symbols-outlined text-sm">sync_disabled</span>
                      Putuskan Alat
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative mb-4 opacity-60">
                    <div className="w-24 h-24 rounded-full border-4 border-clinical-surface overflow-hidden shadow-sm flex items-center justify-center bg-slate-50 text-3xl font-bold text-clinical-charcoal/40">
                      <span className="material-symbols-outlined text-5xl">sensors_off</span>
                    </div>
                  </div>
                  
                  <h5 className="text-lg font-bold font-display text-clinical-charcoal">Belum Terhubung</h5>
                  <p className="text-sm font-medium text-clinical-charcoal/60 mb-6 leading-relaxed">Silakan sinkronisasi alat fisik EKG Anda terlebih dahulu.</p>

                  <div className="w-full">
                    <button onClick={() => navigate('/patient/device-scanner')} className="w-full py-3 bg-clinical-surface hover:brightness-95 text-clinical-charcoal font-bold text-[13px] rounded-lg transition-colors flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
                      Mulai Sinkronisasi
                    </button>
                  </div>
                </>
              )}
            </div>
            {/* System Information Card */}
            <div className="rounded-[2rem] p-8 bg-white border border-clinical-charcoal/5 overflow-hidden relative shadow-[0px_20px_40px_rgba(0,0,0,0.04)] hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] transition-all duration-700 hover:-translate-y-1 text-clinical-charcoal">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <span className="material-symbols-outlined text-6xl text-clinical-blue">favorite</span>
              </div>
              <h4 className="font-bold text-[13px] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-clinical-blue">info</span>
                {t('dashboard.healthTips')}
              </h4>
              <p className="text-sm font-medium text-clinical-charcoal/60 leading-relaxed">
                {randomHealthTipText}
              </p>
            </div>
          </aside>
        </div>
      </main>
      {/* Mobile Bottom Nav Spacer */}
      <div className="h-16 md:hidden"></div>

      {/* Disconnect Modals */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-clinical-charcoal/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm border border-clinical-charcoal/5 shadow-2xl animate-in zoom-in-50 fade-in duration-500 ease-spring">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-6 text-clinical-red mx-auto border border-red-100">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>
            <h3 className="text-xl font-bold font-display text-clinical-charcoal mb-2 text-center">{t('dashboard.cancelSyncModalTitle')}</h3>
            <p className="text-sm font-medium text-clinical-charcoal/60 mb-8 text-center">{t('dashboard.cancelSyncModalDesc')}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDisconnectModal(false)} className="flex-1 py-3 rounded-lg font-bold text-[13px] bg-clinical-surface hover:brightness-95 text-clinical-charcoal transition-colors">{t('dashboard.cancel')}</button>
              <button onClick={() => {
                disconnectAll();
                setShowDisconnectModal(false);
                setShowSuccessModal(true);
              }} className="flex-1 py-3 rounded-lg font-bold text-[13px] bg-clinical-red text-white hover:brightness-110 transition-colors shadow-sm hover:shadow-[0px_10px_20px_rgba(220,38,38,0.2)]">{t('dashboard.yesDisconnect')}</button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-clinical-charcoal/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm border border-clinical-charcoal/5 shadow-2xl text-center animate-in zoom-in-50 fade-in duration-500 ease-spring">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-6 text-clinical-blue mx-auto border border-blue-100">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <h3 className="text-xl font-bold font-display text-clinical-charcoal mb-2">{t('dashboard.successDisconnectTitle')}</h3>
            <p className="text-sm font-medium text-clinical-charcoal/60 mb-8">{t('dashboard.successDisconnectDesc')}</p>
            <button onClick={() => setShowSuccessModal(false)} className="w-full py-3 rounded-lg font-bold text-[13px] bg-clinical-blue text-white hover:brightness-110 transition-colors shadow-sm hover:shadow-[0px_10px_20px_rgba(23,107,206,0.2)]">{t('dashboard.close')}</button>
          </div>
        </div>
      )}

      {/* Unsync Confirmation Modal */}
      {showUnsyncModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-clinical-charcoal/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm border border-clinical-charcoal/5 shadow-2xl text-center animate-in zoom-in-50 fade-in duration-500 ease-spring">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-6 text-clinical-red mx-auto border border-red-100">
              <span className="material-symbols-outlined text-3xl">link_off</span>
            </div>
            <h3 className="text-xl font-bold font-display text-clinical-charcoal mb-2">Putuskan Alat?</h3>
            <p className="text-sm font-medium text-clinical-charcoal/60 mb-8 leading-relaxed">
              Anda akan memutuskan sinkronisasi dengan alat <strong>{syncedDeviceId}</strong>. Anda perlu menyinkronkan ulang untuk merekam aktivitas jantung.
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={async () => {
                  if (syncedDeviceId) {
                    try {
                      await fetchWithAuth(`/api/devices/${syncedDeviceId}/assign`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ patient_id: null })
                      });
                    } catch (e) {
                      console.error("Gagal unassign device:", e);
                    }
                  }
                  localStorage.removeItem('synced_device_id');
                  setSyncedDeviceId(null);
                  setShowUnsyncModal(false);
                }} 
                className="w-full py-3.5 rounded-lg font-bold text-[13px] bg-clinical-red text-white hover:brightness-110 transition-colors shadow-sm hover:shadow-[0px_10px_20px_rgba(220,38,38,0.2)]"
              >
                Ya, Putuskan
              </button>
              <button 
                onClick={() => setShowUnsyncModal(false)} 
                className="w-full py-3.5 rounded-lg font-bold text-[13px] bg-clinical-surface hover:brightness-95 text-clinical-charcoal transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};
