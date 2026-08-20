import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { PatientHeader } from '../../components/layout/PatientHeader';
import { useTranslation } from '../../../application/hooks/useTranslation';
import { API_URL } from '../../../config/env';
import { fetchWithAuth } from '../../../config/api';
import { useCachedFetch } from '../../../application/hooks/useCachedFetch';

interface PatientProfile {
  patient: {
    id: number;
    first_name: string;
    last_name: string;
    profile_photo: string | null;
  };
}

export const PatientQrSyncPage: React.FC = () => {
  const navigate = useNavigate();
  const userId = localStorage.getItem('user_id') || '1';
  const { data: profile } = useCachedFetch<PatientProfile>(`/api/patients/${userId}`);
  const { t } = useTranslation();

  const patientName = profile ? `${profile.patient.first_name} ${profile.patient.last_name}` : t('profile.loading');
  const patientIdFormatted = profile ? `PAT-${profile.patient.id.toString().padStart(4, '0')}-XYZ` : t('profile.loading');

  const getInitials = (firstName: string, lastName: string) => {
    if (!firstName && !lastName) return '';
    return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();
  };

  return (
    <div className="text-clinical-charcoal w-full bg-clinical-surface/30 min-h-screen flex flex-col relative">
      <div className="absolute inset-0 ecg-grid opacity-[0.15] z-0 pointer-events-none"></div>
      {/* Top Navigation Bar */}
      <PatientHeader />

      {/* Main Content Area */}
      <main className="max-w-5xl w-full mx-auto px-gutter py-8 md:py-12 flex flex-col flex-grow justify-center relative z-10">


        {/* Sync Card Two-Column Layout */}
        <div className="bg-white rounded-[2rem] border border-clinical-charcoal/5 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] transition-all duration-700 flex flex-col md:flex-row w-full relative overflow-hidden group">

          {/* Left Side: QR Code Area */}
          <div className="md:w-1/2 p-6 md:p-12 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-clinical-charcoal/10 relative bg-white z-10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-clinical-blue/5 rounded-bl-[100px] -z-0 transition-transform group-hover:scale-110"></div>


            <h1 className="text-3xl font-extrabold font-display text-clinical-charcoal mb-2 z-10 text-center">{t('qrSync.title')}</h1>
            <p className="text-[13px] font-medium text-clinical-charcoal/60 mb-8 z-10 text-center max-w-sm">
              {t('qrSync.desc')}
            </p>

            {/* Real QR Code Display */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-clinical-charcoal/10 mb-8 z-10 group-hover:shadow-md transition-shadow duration-500 hover:scale-105">
              {profile ? (
                <QRCode
                  value={`ecgrhythmia://sync/patient/${profile.patient.id}`}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#0A2540"
                  level="H"
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                />
              ) : (
                <div className="w-[200px] h-[200px] flex items-center justify-center bg-slate-50 animate-pulse rounded-2xl">
                  <span className="material-symbols-outlined text-clinical-charcoal/40 text-5xl">qr_code_2</span>
                </div>
              )}
            </div>

            {/* Patient ID Info */}
            <div className="w-full bg-clinical-surface/50 rounded-2xl p-4 flex flex-col items-center gap-1 border border-clinical-charcoal/10 z-10 shadow-inner group-hover:border-clinical-blue/30 transition-colors">
              <p className="text-[10px] font-bold text-clinical-charcoal/60 uppercase tracking-widest">{t('qrSync.yourId')}</p>
              <p className="font-mono text-lg font-bold text-clinical-charcoal tracking-[0.1em]">
                {patientIdFormatted}
              </p>
            </div>
          </div>

          {/* Right Side: Instructions & Security */}
          <div className="md:w-1/2 p-6 md:p-12 bg-slate-50 z-10 relative flex flex-col justify-center">
            <h2 className="text-xl font-bold font-display text-clinical-charcoal mb-6">{t('qrSync.howToSync')}</h2>

            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-clinical-blue/10 flex items-center justify-center text-clinical-blue font-bold shrink-0 shadow-sm border border-clinical-blue/20">1</div>
                <div>
                  <h3 className="font-bold text-[15px] text-clinical-charcoal mb-1">{t('qrSync.step1Title')}</h3>
                  <p className="text-[13px] font-medium text-clinical-charcoal/60 leading-relaxed">{t('qrSync.step1Desc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-clinical-blue/10 flex items-center justify-center text-clinical-blue font-bold shrink-0 shadow-sm border border-clinical-blue/20">2</div>
                <div>
                  <h3 className="font-bold text-[15px] text-clinical-charcoal mb-1">{t('qrSync.step2Title')}</h3>
                  <p className="text-[13px] font-medium text-clinical-charcoal/60 leading-relaxed">{t('qrSync.step2Desc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-clinical-blue/10 flex items-center justify-center text-clinical-blue font-bold shrink-0 shadow-sm border border-clinical-blue/20">3</div>
                <div>
                  <h3 className="font-bold text-[15px] text-clinical-charcoal mb-1">{t('qrSync.step3Title')}</h3>
                  <p className="text-[13px] font-medium text-clinical-charcoal/60 leading-relaxed">{t('qrSync.step3Desc')}</p>
                </div>
              </div>
            </div>

            <hr className="border-clinical-charcoal/10 my-8" />

            {/* Security Badge */}
            <div className="bg-status-green/5 border border-status-green/20 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-status-green/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-status-green text-2xl">verified_user</span>
              </div>
              <div>
                <h4 className="font-bold text-status-green text-sm mb-1 flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-green opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-status-green"></span>
                  </span>
                  {t('qrSync.encrypted')}
                </h4>
                <p className="text-xs text-clinical-charcoal/60">{t('qrSync.encryptedDesc')}</p>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
};
