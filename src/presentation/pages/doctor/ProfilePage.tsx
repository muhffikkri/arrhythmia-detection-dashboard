import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DoctorSidebar } from '../../components/layout/DoctorSidebar';
import { useSidebar } from '../../../application/context/SidebarContext';
import { LogoutModal } from '../../components/shared/LogoutModal';
import { useConnection } from '../../../application/context/ConnectionContext';
import { API_URL } from '../../../config/env';
import { fetchWithAuth } from '../../../config/api';
import { useCachedFetch } from '../../../application/hooks/useCachedFetch';
import { ActionModal } from '../../components/shared/ActionModal';

interface DoctorProfile {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    profile_photo: string | null;
}

export const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const { isOpen, toggleSidebar } = useSidebar();
    const { connectedDoctor, setConnectedDoctor } = useConnection();

    const userId = localStorage.getItem('user_id');
    const { data: profile, isLoading, error: swrError, mutate } = useCachedFetch<DoctorProfile>(userId ? `/api/doctors/${userId}` : null);

    const [error, setError] = useState(swrError?.message || '');
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        first_name: '',
        last_name: '',
        profile_photo: ''
    });

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
        if (!userId) {
            navigate('/auth/login');
        }
    }, [userId, navigate]);

    useEffect(() => {
        if (profile && !isEditing) {
            setEditForm({
                first_name: profile.first_name || '',
                last_name: profile.last_name || '',
                profile_photo: profile.profile_photo || ''
            });

            if (connectedDoctor && (connectedDoctor.name !== `Dr. ${profile.first_name} ${profile.last_name}` || connectedDoctor.photo !== profile.profile_photo)) {
                setConnectedDoctor({
                    ...connectedDoctor,
                    name: `Dr. ${profile.first_name} ${profile.last_name}`,
                    photo: profile.profile_photo || undefined
                });
            }
        }
    }, [profile, isEditing, connectedDoctor, setConnectedDoctor]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditForm({ ...editForm, profile_photo: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;
        setActionModal({
            isOpen: true,
            type: 'confirm',
            title: 'Konfirmasi Simpan',
            message: 'Apakah Anda yakin ingin menyimpan perubahan profil ini?',
            onConfirm: executeSave
        });
    };

    const executeSave = async () => {
        if (!profile) return;
        setIsSaving(true);
        setError('');

        try {
            const response = await fetchWithAuth(`/api/doctors/${profile.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: editForm.first_name,
                    last_name: editForm.last_name,
                    profile_photo: editForm.profile_photo || null
                })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Gagal menyimpan profil');
            }

            const data = await response.json();
            if (data.success) {
                setIsEditing(false);
                mutate(); // Refresh SWR data
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
                    message: data.message || 'Gagal menyimpan profil',
                    onConfirm: closeActionModal
                });
            }
        } catch (err: any) {
            setActionModal({
                isOpen: true,
                type: 'error',
                title: 'Error',
                message: err.message || 'Koneksi ke server gagal saat menyimpan profil',
                onConfirm: closeActionModal
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-clinical-surface text-clinical-charcoal antialiased overflow-hidden flex h-screen w-full font-sans relative">
            <div className="absolute inset-0 ecg-grid opacity-10 pointer-events-none z-0"></div>
            <DoctorSidebar />

            <div className={`flex-1 flex flex-col min-w-0 relative z-10 transition-all duration-300 ${isOpen ? 'md:ml-[260px]' : 'ml-0'}`}>

                <header className="sticky top-0 bg-clinical-surface/80 backdrop-blur-xl border-b border-clinical-charcoal/5 z-40 px-4 md:px-6 py-4 flex justify-between items-center w-full">
                    <div className="flex items-center gap-3">
                        <button onClick={toggleSidebar} id="toggle-sidebar-btn" className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-white-container text-clinical-charcoal/70 transition-colors outline-none" title="Menu Utama">
                            <span className="material-symbols-outlined">menu</span>
                        </button>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-clinical-charcoal">Pengaturan Akun</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => {
                            setIsLogoutModalOpen(true);
                        }} className="bg-white border border-clinical-charcoal/5 hover:bg-red-50 text-alert-red px-4 py-2 md:py-2.5 rounded-full font-bold flex items-center gap-2 transition-all active:scale-[0.98] shadow-sm text-xs md:text-sm">
                            <span className="material-symbols-outlined text-[16px] md:text-[18px]">logout</span>
                            <span className="hidden sm:inline">Keluar</span>
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto custom-scrollbar relative animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
                    {/* Decorative Abstract Backgrounds */}
                    <div className="absolute -top-40 -left-40 w-96 h-96 bg-clinical-blue/20 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-pulse pointer-events-none z-0"></div>
                    <div className="absolute top-20 -right-20 w-80 h-80 bg-red-400/10 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 pointer-events-none z-0"></div>
                    <div className="absolute -bottom-40 left-20 w-96 h-96 bg-clinical-blue/10 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-pulse pointer-events-none z-0"></div>

                    <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12 relative z-10">
                        <div className="bg-white/60 backdrop-blur-2xl rounded-[1.5rem] md:rounded-[2rem] shadow-[0px_20px_40px_rgba(0,0,0,0.05)] border border-white/50 overflow-hidden flex flex-col lg:flex-row transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.1)]">

                            {/* Profile Info Section */}
                            <div className="p-6 md:p-8 lg:p-12 lg:w-1/3 border-b lg:border-b-0 lg:border-r border-white/40 bg-white/30 flex flex-col justify-center items-center text-center relative overflow-hidden group">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none z-0 group-hover:scale-110 transition-transform duration-700 text-clinical-blue">
                                    <span className="material-symbols-outlined text-[150px] md:text-[200px]">manage_accounts</span>
                                </div>
                                <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-white shadow-xl bg-white flex items-center justify-center mb-5 md:mb-6 z-10 group-hover:shadow-2xl transition-all duration-700">
                                    {profile?.profile_photo ? (
                                        <img alt="Profile" className="w-full h-full object-cover" src={profile.profile_photo} />
                                    ) : (
                                        <span className="material-symbols-outlined text-4xl md:text-6xl text-clinical-charcoal/70">person</span>
                                    )}
                                </div>
                                <h2 className="text-xl md:text-2xl font-bold text-clinical-charcoal tracking-tight mb-1 relative z-10 group-hover:text-clinical-blue transition-colors duration-700">
                                    {isLoading ? 'Memuat...' : (profile ? `${profile.first_name} ${profile.last_name}` : 'Tidak Ditemukan')}
                                </h2>
                                <p className="text-[9px] md:text-[10px] font-bold text-clinical-blue uppercase tracking-[0.2em] mb-6 relative z-10">
                                    {profile?.role === 'doctor' ? 'Kardiolog Utama' : profile?.role}
                                </p>

                                {!isEditing && (
                                    <button onClick={() => setIsEditing(true)} disabled={isLoading || !profile} className="w-full bg-clinical-charcoal text-white hover:bg-black font-bold py-3.5 rounded-[2rem] transition-all duration-700 shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2 relative z-10">
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                        Edit Profil
                                    </button>
                                )}

                            </div>

                            {/* Details & Form Section */}
                            <div className="p-6 md:p-8 lg:p-12 lg:w-2/3 bg-transparent z-10">
                                <h3 className="text-xl font-bold text-clinical-charcoal mb-6 md:mb-8 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-clinical-blue text-3xl">manage_accounts</span>
                                    {isEditing ? 'Perbarui Informasi' : 'Detail Akun'}
                                </h3>

                                {error && (
                                    <div className="mb-6 p-4 bg-red-50 border-l-4 border-alert-red text-alert-red text-sm font-body-sm font-headline-md rounded-r-lg flex items-center gap-3">
                                        <span className="material-symbols-outlined">error</span>
                                        {error}
                                    </div>
                                )}

                                {!isEditing ? (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="bg-white/50 backdrop-blur-sm p-6 rounded-[1.5rem] border border-white/60 transition-all duration-700 hover:border-clinical-blue/30 hover:shadow-md hover:bg-white/80 group">
                                                <p className="text-[10px] text-clinical-charcoal/50 uppercase font-bold tracking-widest mb-1 group-hover:text-clinical-blue transition-colors duration-700">Nama Depan</p>
                                                <p className="text-lg font-bold text-clinical-charcoal">{isLoading ? '---' : profile?.first_name}</p>
                                            </div>
                                            <div className="bg-white/50 backdrop-blur-sm p-6 rounded-[1.5rem] border border-white/60 transition-all duration-700 hover:border-clinical-blue/30 hover:shadow-md hover:bg-white/80 group">
                                                <p className="text-[10px] text-clinical-charcoal/50 uppercase font-bold tracking-widest mb-1 group-hover:text-clinical-blue transition-colors duration-700">Nama Belakang</p>
                                                <p className="text-lg font-bold text-clinical-charcoal">{isLoading ? '---' : profile?.last_name}</p>
                                            </div>
                                        </div>

                                        <div className="bg-white/50 backdrop-blur-sm p-6 rounded-[1.5rem] border border-white/60 transition-all duration-700 hover:border-clinical-blue/30 hover:shadow-md hover:bg-white/80 group">
                                            <p className="text-[10px] text-clinical-charcoal/50 uppercase font-bold tracking-widest mb-1 group-hover:text-clinical-blue transition-colors duration-700">Email Registrasi (Read-only)</p>
                                            <div className="flex items-center justify-between">
                                                <p className="text-lg font-bold text-clinical-charcoal">{isLoading ? '---' : profile?.email}</p>
                                                <span className="material-symbols-outlined text-clinical-blue" title="Email Terverifikasi">verified</span>
                                            </div>
                                        </div>

                                        <div className="bg-white/50 backdrop-blur-sm p-6 rounded-[1.5rem] border border-white/60 transition-all duration-700 hover:border-clinical-blue/30 hover:shadow-md hover:bg-white/80 group">
                                            <p className="text-[10px] text-clinical-charcoal/50 uppercase font-bold tracking-widest mb-1 group-hover:text-clinical-blue transition-colors duration-700">ID Pengguna (Read-only)</p>
                                            <p className="text-sm font-mono text-clinical-charcoal/70 font-bold">{isLoading ? '---' : profile?.id}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSave} className="space-y-5">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-body-sm font-headline-md text-clinical-charcoal uppercase tracking-wider">Nama Depan</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={editForm.first_name}
                                                    onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                                                    className="w-full px-5 py-4 bg-clinical-surface/50 border border-clinical-charcoal/10 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-clinical-blue/20 focus:border-clinical-blue text-clinical-charcoal font-medium transition-all duration-700"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-body-sm font-headline-md text-clinical-charcoal uppercase tracking-wider">Nama Belakang</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={editForm.last_name}
                                                    onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                                                    className="w-full px-5 py-4 bg-clinical-surface/50 border border-clinical-charcoal/10 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-clinical-blue/20 focus:border-clinical-blue text-clinical-charcoal font-medium transition-all duration-700"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-body-sm font-headline-md text-clinical-charcoal uppercase tracking-wider">Unggah Foto Profil</label>
                                            <div className="flex items-center gap-4">
                                                {editForm.profile_photo && (
                                                    <div className="w-12 h-12 rounded-full overflow-hidden border border-clinical-blue/20 shrink-0">
                                                        <img src={editForm.profile_photo} alt="Preview" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handlePhotoChange}
                                                    className="w-full text-sm font-body-sm text-clinical-charcoal/70 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm font-body-sm file:font-headline-md file:bg-clinical-blue/10 file:text-clinical-blue hover:file:bg-clinical-blue/20 transition-all cursor-pointer"
                                                />
                                            </div>
                                            <p className="text-[10px] text-clinical-charcoal/70">Pilih foto berformat JPG/PNG (opsional). Maks. 1MB direkomendasikan.</p>
                                        </div>

                                        <div className="flex gap-3 pt-4 border-t border-clinical-blue/20/30 mt-6">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsEditing(false);
                                                    setError('');
                                                    if (profile) {
                                                        setEditForm({
                                                            first_name: profile.first_name,
                                                            last_name: profile.last_name,
                                                            profile_photo: profile.profile_photo || ''
                                                        });
                                                    }
                                                }}
                                                className="flex-1 px-6 py-3.5 border border-clinical-charcoal/10 text-clinical-charcoal font-bold rounded-[2rem] hover:bg-clinical-surface transition-all duration-700"
                                            >
                                                Batal
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSaving}
                                                className="flex-1 px-6 py-3.5 bg-clinical-blue text-white font-bold rounded-[2rem] hover:brightness-110 transition-all duration-700 shadow-md hover:shadow-lg active:scale-95 disabled:opacity-70 flex justify-center items-center gap-2"
                                            >
                                                {isSaving ? (
                                                    <><span className="material-symbols-outlined animate-spin text-[18px]">sync</span> Menyimpan...</>
                                                ) : (
                                                    <><span className="material-symbols-outlined text-[18px]">save</span> Simpan</>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>


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
