import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const handleReturnToOriginalProfile = (navigate: any) => {
    const adminToken = localStorage.getItem('admin_auth_token');
    const docToken = localStorage.getItem('doctor_auth_token');
    const originalRole = localStorage.getItem('original_role');

    if (adminToken && originalRole === 'admin') {
        localStorage.setItem('auth_token', adminToken);
        localStorage.setItem('user_id', localStorage.getItem('admin_user_id') || '');
        localStorage.setItem('user_role', 'admin');
        localStorage.removeItem('admin_auth_token');
        localStorage.removeItem('admin_user_id');
        localStorage.removeItem('original_role');
        sessionStorage.removeItem('is_impersonating');
        navigate('/admin/dashboard');
    } else if (docToken && originalRole === 'dokter') {
        localStorage.setItem('auth_token', docToken);
        localStorage.setItem('user_id', localStorage.getItem('doctor_user_id') || '');
        localStorage.setItem('user_role', 'dokter');
        localStorage.removeItem('doctor_auth_token');
        localStorage.removeItem('doctor_user_id');
        localStorage.removeItem('original_role');
        sessionStorage.removeItem('is_impersonating');
        navigate('/doctor/dashboard');
    }
};
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

export const PatientHeader: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const userId = localStorage.getItem('user_id') || '1';
    const { data: profileData } = useCachedFetch<PatientProfile>(`/api/patients/${userId}`);
    const profile = profileData || null;

    const patientName = profile ? `${profile.patient.first_name} ${profile.patient.last_name}` : t('dashboard.loading');

    const getInitials = (firstName: string, lastName: string) => {
        if (!firstName && !lastName) return '';
        return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();
    };

    return (
        <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-clinical-charcoal/5 h-16 w-full shadow-sm transition-colors duration-700">
            <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop h-full flex justify-between items-center">
                <div className="flex items-center gap-3">
                    {location.pathname !== '/patient/dashboard' && (
                        <button onClick={() => navigate(-1)} className="material-symbols-outlined text-clinical-charcoal hover:text-clinical-blue transition-colors cursor-pointer text-[24px] mr-1" title="Kembali">
                            arrow_back
                        </button>
                    )}
                    <div onClick={() => navigate('/patient/dashboard')} className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                        <img alt="ecgrhythmia logo" className="h-8 w-auto" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBVHX00UF6lwM6kjDUMgD4Jv6lMMp5h2u1ZBPFlnvJJNam11nmTsrGtn_y5NNHv61wLHc3plhgbJeduSWPWMT-xKDKHnnifesb9pERppu-cGEHZODeFvF8XLLfRKpP1GdLDV5iINEmqPsbVTFdQZhAPCXP6aHQm-ecIuBbV0YG8GByhRtVQ6xZQrpQpUmXqjqW6DWiEZHDW8D81u4xSnTtsE-7HlTKrn6GuXcYUOYjdpCvaEqIKW1ghrNjEt5sTxTf_o6esUGi3HzNB" />
                        <div className="text-xl font-bold font-display text-clinical-charcoal tracking-tight flex">
                            <span className="text-clinical-red">ecg</span><span className="text-clinical-charcoal">rhythmia</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {(localStorage.getItem('admin_auth_token') || localStorage.getItem('doctor_auth_token')) && (
                        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-red-100 border border-red-200 rounded-full">
                            <span className="material-symbols-outlined text-red-600 text-sm">admin_panel_settings</span>
                            <span className="text-xs font-bold text-red-700">
                                {localStorage.getItem('admin_auth_token') ? 'Admin Login' : 'Dokter Login'}
                            </span>
                            <button onClick={() => handleReturnToOriginalProfile(navigate)} className="ml-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 transition-colors">
                                KEMBALI
                            </button>
                        </div>
                    )}
                    <div onClick={() => navigate('/patient/profile')} className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-sm font-bold text-clinical-charcoal">{patientName}</span>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-clinical-charcoal/60">{t('dashboard.patientRole')}</span>
                        </div>
                        <div className="w-10 h-10 rounded-full border border-clinical-charcoal/10 overflow-hidden bg-clinical-surface flex items-center justify-center font-bold text-clinical-blue text-sm shrink-0">
                            {profile?.patient.profile_photo ? (
                                <img className="w-full h-full object-cover" data-alt="Patient Profile" src={profile.patient.profile_photo} />
                            ) : (
                                <span>{profile ? getInitials(profile.patient.first_name, profile.patient.last_name) : ''}</span>
                            )}
                        </div>
                    </div>
                    {location.pathname !== '/patient/settings' && (
                        <button onClick={() => navigate('/patient/settings')} className="material-symbols-outlined text-clinical-charcoal/60 hover:text-clinical-blue transition-colors cursor-pointer text-[22px]">settings</button>
                    )}
                </div>
            </div>
        </nav>
    );
};
