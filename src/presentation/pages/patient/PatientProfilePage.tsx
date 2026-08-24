import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogoutModal } from '../../components/shared/LogoutModal';
import { PatientHeader } from '../../components/layout/PatientHeader';
import { useTranslation } from '../../../application/hooks/useTranslation';
import { API_URL } from '../../../config/env';
import { fetchWithAuth } from '../../../config/api';
import { useCachedFetch } from '../../../application/hooks/useCachedFetch';
import { ActionModal } from '../../components/shared/ActionModal';

export const PatientProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const { t } = useTranslation();

    // Profile data state
    const userId = localStorage.getItem('user_id') || '1';
    const { data: profileResponse, isLoading, error: swrError, mutate: mutateProfile } = useCachedFetch(`/api/patients/${userId}`);
    const profile = profileResponse || null;
    const [error, setError] = useState(swrError?.message || '');

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        age: 0,
        profile_photo: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    
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
        if (!isSaving) setActionModal(prev => ({ ...prev, isOpen: false }));
    };

    useEffect(() => {
        if (profile && profile.patient && !isEditing) {
            setFormData({
                first_name: profile.patient.first_name || '',
                last_name: profile.patient.last_name || '',
                age: profile.patient.age || 0,
                profile_photo: profile.patient.profile_photo || ''
            });
        }
    }, [profile, isEditing]);

    const handleSaveProfile = (e: React.FormEvent) => {
        e.preventDefault();
        setActionModal({
            isOpen: true,
            type: 'confirm',
            title: 'Konfirmasi Simpan',
            message: 'Apakah Anda yakin ingin menyimpan perubahan profil ini?',
            onConfirm: executeSaveProfile
        });
    };

    const executeSaveProfile = async () => {
        setIsSaving(true);
        setError('');
        const userId = localStorage.getItem('user_id') || '1';

        try {
            const response = await fetchWithAuth(`/api/patients/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    age: String(formData.age),
                    profile_photo: formData.profile_photo || null
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || t('profile.saveError'));
            }

            const data = await response.json();
            if (data.success) {
                setIsEditing(false);
                mutateProfile(); // Refresh SWR data
                window.dispatchEvent(new Event('patient_profile_updated')); // Notify other components
                setActionModal({
                    isOpen: true,
                    type: 'success',
                    title: 'Berhasil',
                    message: 'Profil berhasil diperbarui.',
                    onConfirm: closeActionModal
                });
            } else {
                setActionModal({
                    isOpen: true,
                    type: 'error',
                    title: 'Gagal',
                    message: data.message || t('profile.saveFailed'),
                    onConfirm: closeActionModal
                });
            }
        } catch (err: any) {
            setActionModal({
                isOpen: true,
                type: 'error',
                title: 'Error',
                message: err.message || t('profile.serverError'),
                onConfirm: closeActionModal
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, profile_photo: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const calculateAge = (dobString: string) => {
        if (!dobString) return null;
        const dob = new Date(dobString);
        const diffMs = Date.now() - dob.getTime();
        const ageDate = new Date(diffMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };

    return (
        <div className="bg-clinical-surface/30 text-clinical-charcoal antialiased overflow-hidden flex flex-col h-screen w-full">
            <PatientHeader />

            <main className="flex-1 overflow-y-auto custom-scrollbar relative">
                <div className="absolute inset-0 ecg-grid opacity-[0.15] z-0 pointer-events-none"></div>
                {/* Premium Banner */}
                <div className="w-full h-48 bg-clinical-blue relative overflow-hidden shrink-0 z-0">
                    <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]"></div>
                </div>

                <div className="max-w-4xl mx-auto px-6 lg:px-8 pb-12 -mt-20 relative z-10 space-y-6">
                    <div className="bg-white rounded-[2rem] shadow-[0px_20px_40px_rgba(0,0,0,0.04)] border border-clinical-charcoal/5 overflow-hidden flex flex-col lg:flex-row transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)]">

                        {/* Profile Info Section */}
                        <div className="p-8 lg:p-12 lg:w-1/3 border-b lg:border-b-0 lg:border-r border-clinical-charcoal/10 flex flex-col items-center text-center">
                            <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-sm bg-clinical-surface flex items-center justify-center mb-6 ring-4 ring-clinical-blue/20">
                                {profile?.patient?.profile_photo ? (
                                    <img alt="Profile" className="w-full h-full object-cover" src={profile.patient.profile_photo} />
                                ) : (
                                    <span className="material-symbols-outlined text-6xl text-clinical-charcoal/30">person</span>
                                )}
                            </div>
                            <h2 className="text-2xl font-extrabold text-clinical-charcoal tracking-tight mb-1">
                                {isLoading ? t('profile.loading') : (profile ? `${profile.patient.first_name} ${profile.patient.last_name}` : t('profile.notFound'))}
                            </h2>
                            <p className="text-xs font-bold text-clinical-blue uppercase tracking-[0.2em] mb-6 flex items-center gap-1 justify-center">
                                <span className="material-symbols-outlined text-[14px]">badge</span>
                                {profile?.patient?.id ? `PAT-${profile.patient.id.toString().padStart(4, '0')}` : '---'}
                            </p>

                            {!isEditing && (
                                <button onClick={() => setIsEditing(true)} disabled={isLoading || !profile} className="w-full bg-clinical-charcoal text-white hover:brightness-110 font-bold py-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                    {t('profile.editProfile')}
                                </button>
                            )}
                        </div>

                        {/* Details & Form Section */}
                        <div className="p-8 lg:p-12 lg:w-2/3 bg-white">
                            <h3 className="text-lg font-bold text-clinical-charcoal mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-clinical-blue">manage_accounts</span>
                                {isEditing ? t('profile.updateInfo') : t('profile.accountDetails')}
                            </h3>

                            {error && (
                                <div className="mb-6 p-4 bg-red-50 border-l-4 border-clinical-red text-clinical-red text-sm font-bold rounded-r-lg flex items-center gap-3">
                                    <span className="material-symbols-outlined">error</span>
                                    {error}
                                </div>
                            )}

                            {!isEditing ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="bg-clinical-surface p-5 rounded-2xl border border-clinical-charcoal/5 transition-all hover:border-clinical-blue/30 hover:shadow-sm">
                                            <p className="text-[10px] text-clinical-charcoal/60 uppercase font-bold tracking-widest mb-1">{t('profile.firstName')}</p>
                                            <p className="text-base font-bold text-clinical-charcoal">{isLoading ? '---' : profile?.patient?.first_name}</p>
                                        </div>
                                        <div className="bg-clinical-surface p-5 rounded-2xl border border-clinical-charcoal/5 transition-all hover:border-clinical-blue/30 hover:shadow-sm">
                                            <p className="text-[10px] text-clinical-charcoal/60 uppercase font-bold tracking-widest mb-1">{t('profile.lastName')}</p>
                                            <p className="text-base font-bold text-clinical-charcoal">{isLoading ? '---' : profile?.patient?.last_name}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        
                                        <div className="bg-clinical-surface p-5 rounded-2xl border border-clinical-charcoal/5 transition-all hover:border-clinical-blue/30 hover:shadow-sm">
                                            <p className="text-[10px] text-clinical-charcoal/60 uppercase font-bold tracking-widest mb-1">{t('profile.age')}</p>
                                            <p className="text-base font-bold text-clinical-charcoal">
                                                {isLoading ? '---' : (profile?.patient?.age ? `${profile.patient.age} ${t('profile.yearsOld')}` : '-')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleSaveProfile} className="space-y-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-clinical-charcoal uppercase tracking-wider">{t('profile.firstName')}</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.first_name}
                                                onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border border-clinical-charcoal/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-clinical-blue focus:border-transparent text-clinical-charcoal font-medium transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-clinical-charcoal uppercase tracking-wider">{t('profile.lastName')}</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.last_name}
                                                onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border border-clinical-charcoal/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-clinical-blue focus:border-transparent text-clinical-charcoal font-medium transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-clinical-charcoal uppercase tracking-wider">{t('profile.age')}</label>
                                        <input
                                            type="number"
                                            min="0" max="150"
                                            value={formData.age || ''}
                                            onChange={e => setFormData({ ...formData, age: Number(e.target.value) })}
                                            className="w-full px-4 py-3 bg-white border border-clinical-charcoal/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-clinical-blue focus:border-transparent text-clinical-charcoal font-medium transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-clinical-charcoal uppercase tracking-wider">{t('profile.uploadPhoto')}</label>
                                        <div className="flex items-center gap-4">
                                            {formData.profile_photo && (
                                                <div className="w-12 h-12 rounded-full overflow-hidden border border-clinical-charcoal/10 shrink-0">
                                                    <img src={formData.profile_photo} alt="Preview" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handlePhotoChange}
                                                className="w-full text-sm text-clinical-charcoal/60 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-clinical-blue/10 file:text-clinical-blue hover:file:bg-clinical-blue/20 transition-all cursor-pointer"
                                            />
                                        </div>
                                        <p className="text-[10px] text-clinical-charcoal/60">{t('profile.uploadHint')}</p>
                                    </div>

                                    <div className="flex gap-3 pt-4 border-t border-clinical-charcoal/10 mt-6">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsEditing(false);
                                                setError('');
                                                if (profile && profile.patient) {
                                                    setFormData({
                                                        first_name: profile.patient.first_name,
                                                        last_name: profile.patient.last_name,
                                                        age: profile.patient.age,
                                                        profile_photo: profile.patient.profile_photo || ''
                                                    });
                                                }
                                            }}
                                            className="flex-1 px-6 py-3 border-2 border-clinical-charcoal/10 text-clinical-charcoal font-bold rounded-xl hover:bg-clinical-surface transition-all"
                                        >
                                            {t('profile.cancel')}
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSaving}
                                            className="flex-1 px-6 py-3 bg-clinical-blue text-white font-bold rounded-xl hover:brightness-110 transition-all shadow-md active:scale-95 disabled:opacity-70 flex justify-center items-center gap-2 hover:shadow-[0px_10px_20px_rgba(23,107,206,0.2)]"
                                        >
                                            {isSaving ? (
                                                <><span className="material-symbols-outlined animate-spin text-[18px]">sync</span> {t('profile.saving')}</>
                                            ) : (
                                                <><span className="material-symbols-outlined text-[18px]">save</span> {t('profile.save')}</>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* Section: Izin Akses Dokter */}
                    {!isLoading && profile?.doctor && !isEditing && (
                        <div className="bg-white rounded-[2rem] shadow-[0px_20px_40px_rgba(0,0,0,0.04)] border border-clinical-charcoal/5 overflow-hidden transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)]">
                            <div className="p-6 border-b border-clinical-charcoal/10 flex items-center gap-3">
                                <span className="material-symbols-outlined text-clinical-blue text-[24px]">verified_user</span>
                                <h3 className="text-lg font-bold text-clinical-charcoal">{t('profile.doctorAccess')}</h3>
                            </div>
                            <div className="p-6 md:p-8">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex items-center gap-5">
                                        <div className="relative">
                                            <div className="w-16 h-16 rounded-full overflow-hidden border-2 p-0.5 bg-slate-50 border-clinical-blue">
                                                {profile.doctor.profile_photo ? (
                                                    <img className="w-full h-full rounded-full object-cover" src={profile.doctor.profile_photo} alt={`Dr. ${profile.doctor.first_name}`} />
                                                ) : (
                                                    <span className="material-symbols-outlined text-[32px] w-full h-full flex items-center justify-center text-clinical-charcoal/30 bg-slate-50">person</span>
                                                )}
                                            </div>
                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 border-2 border-white rounded-full bg-status-green shadow-sm"></div>
                                        </div>
                                        <div>
                                            <h4 className="text-lg text-clinical-charcoal font-bold font-display">Dr. {profile.doctor.first_name} {profile.doctor.last_name}</h4>
                                            <p className="text-sm font-medium text-clinical-charcoal/60">{t('profile.doctorRole')} <span className="text-clinical-charcoal/20 mx-1">•</span> {profile.doctor.hospital || 'Klinik Jantung Sehat'}</p>

                                            <span className="inline-flex items-center mt-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-widest border border-green-200">
                                                <span className="w-1.5 h-1.5 rounded-full bg-status-green mr-1.5"></span>
                                                {t('profile.accessActive')}
                                            </span>
                                        </div>
                                    </div>

                                    <button onClick={() => alert(t('profile.revokeAlert'))} className="w-full md:w-auto px-6 py-2.5 rounded-full border border-clinical-red text-clinical-red font-bold text-[13px] hover:bg-clinical-red hover:text-white transition-all shadow-sm focus:ring-4 focus:ring-red-100">
                                        {t('profile.revokeAccess')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Logout Section */}
                    {!isEditing && (
                        <div className="pt-4">
                            <button onClick={() => setIsLogoutModalOpen(true)} className="w-full bg-white p-6 rounded-[2rem] border border-clinical-red/20 text-clinical-red hover:bg-red-50/50 hover:border-clinical-red/40 transition-all font-bold flex items-center justify-center gap-3 group shadow-[0px_20px_40px_rgba(0,0,0,0.04)] hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] outline-none">
                                <span className="material-symbols-outlined text-[24px] group-hover:scale-110 group-hover:-translate-x-1 transition-transform">logout</span>
                                <span className="text-lg">{t('profile.logout')}</span>
                            </button>
                        </div>
                    )}
                </div>
            </main>

            <LogoutModal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} />

            <ActionModal 
                isOpen={actionModal.isOpen}
                type={actionModal.type}
                title={actionModal.title}
                message={actionModal.message}
                onConfirm={actionModal.onConfirm}
                onClose={closeActionModal}
                isLoading={isSaving}
            />
        </div>
    );
};
