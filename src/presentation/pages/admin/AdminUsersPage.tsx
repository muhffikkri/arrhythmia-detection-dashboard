import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from '../../components/layout/AdminSidebar';
import { useSidebar } from '../../../application/context/SidebarContext';
import { supabase } from '../../../config/supabaseClient';
import { API_URL } from '../../../config/env';
import { Pagination } from '../../components/shared/Pagination';
import { useStickyState } from '../../../application/hooks/useStickyState';
import { useCachedFetch } from '../../../application/hooks/useCachedFetch';
import { fetchWithAuth } from '../../../config/api';
import { ActionModal } from '../../components/shared/ActionModal';

interface AdminUser {
    id: string;
    account_id: string;
    name: string;
    role: string;
    status: string;
    registered_at: string;
    connected_doctor_id?: string | null;
    connected_device_id?: string | null;
    profile_photo?: string | null;
}

interface DeviceRecord {
    id: string;
    name: string;
    assigned_to: string | null;
}

export const AdminUsersPage: React.FC = () => {
    const navigate = useNavigate();
    const { isOpen, toggleSidebar } = useSidebar();
    const [activeTab, setActiveTab] = useStickyState<'pasien' | 'dokter'>('pasien', 'adminUsersTab');
    const [currentPage, setCurrentPage] = useStickyState(1, 'adminUsersPage');
    const itemsPerPage = 10;
    
    const [tokenRestored, setTokenRestored] = useState(false);

    useEffect(() => {
        // Jika kembali (Back) dari impersonasi, pulihkan sesi admin
        const adminToken = localStorage.getItem('admin_auth_token');
        if (adminToken && localStorage.getItem('user_role') !== 'admin') {
            localStorage.setItem('auth_token', adminToken);
            localStorage.setItem('user_role', 'admin');
            const adminId = localStorage.getItem('admin_user_id');
            if (adminId) localStorage.setItem('user_id', adminId);
        }
        setTokenRestored(true);
    }, []);

    const { data: usersResponse, isLoading: loadingUsers, mutate: mutateUsers } = useCachedFetch(tokenRestored ? `/api/admin/users?page=${currentPage}&limit=${itemsPerPage}&role=${activeTab}` : null);
    const { data: devicesResponse, mutate: mutateDevices } = useCachedFetch(tokenRestored ? `/api/admin/devices` : null);
    const { data: doctorsResponse } = useCachedFetch(tokenRestored ? `/api/admin/users?role=dokter&limit=1000` : null);

    const users = usersResponse?.data || (Array.isArray(usersResponse) ? usersResponse : []);
    const totalUsers = usersResponse?.pagination?.total || users.length;
    const totalPages = usersResponse?.pagination?.total_pages || Math.ceil(totalUsers / itemsPerPage);
    const devices = Array.isArray(devicesResponse) ? devicesResponse : (devicesResponse?.data || []);
    const allDoctors = doctorsResponse?.data || (Array.isArray(doctorsResponse) ? doctorsResponse : []);
    const { data: allPatientsResponse } = useCachedFetch(tokenRestored ? `/api/admin/users?role=pasien&limit=1000` : null);
    const allPatients = allPatientsResponse?.data || (Array.isArray(allPatientsResponse) ? allPatientsResponse : []);
    
    const loading = loadingUsers;
    
    const testUser = activeTab === 'pasien' 
        ? allPatients.find((u: any) => u.name === 'Patient Test') 
        : allDoctors.find((u: any) => u.name === 'Doctor Test');

    // Add Modal State
    const [showAddModal, setShowAddModal] = useState(false);

    const [addEmail, setAddEmail] = useState('');
    const [addPassword, setAddPassword] = useState('');
    const [addRole, setAddRole] = useState<'dokter' | 'pasien'>('dokter');
    const [addFirstName, setAddFirstName] = useState('');
    const [addLastName, setAddLastName] = useState('');
    const [addAge, setAddAge] = useState<number | ''>('');
    const [addGender, setAddGender] = useState('L');
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    // Detail Modal State
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [userDetail, setUserDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Sync states
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

    // Action Modal States
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
    const [actionLoading, setActionLoading] = useState(false);

    const closeActionModal = () => {
        if (!actionLoading) setActionModal(prev => ({ ...prev, isOpen: false }));
    };

    // Cleanup old useEffect that was restoring tokens too late
    
    // For when a modal adds/updates a user and we just want to refresh the current list
    const fetchUsersAndDevices = () => {
        mutateUsers();
        mutateDevices();
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddLoading(true);
        setAddError(null);
        try {
            const res = await fetchWithAuth(`/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: addEmail,
                    password: addPassword,
                    role: addRole,
                    first_name: addFirstName,
                    last_name: addLastName,
                    age: addAge || 0,
                    gender: addGender
                })
            });
            const data = await res.json();
            if (data.success || res.ok) {
                setShowAddModal(false);
                setAddEmail('');
                setAddPassword('');
                setAddFirstName('');
                setAddLastName('');
                setAddAge('');
                setAddGender('L');
                fetchUsersAndDevices();
            } else {
                setAddError(data.message || 'Gagal mendaftarkan akun.');
            }
        } catch (err) {
            setAddError('Terjadi kesalahan jaringan.');
        }
        setAddLoading(false);
    };

    const handleViewDetail = async (user: AdminUser) => {
        setSelectedUser(user);
        setUserDetail(null);
        setLoadingDetail(true);
        try {
            const endpoint = user.role === 'dokter' ? `/api/doctors/${user.id}` : `/api/patients/${user.id}`;
            const res = await fetchWithAuth(`${endpoint}`);
            if (res.ok) {
                const data = await res.json();
                setUserDetail(data);
                if (user.role === 'pasien') {
                    // pre-fill selected options
                    setSelectedDoctorId(data.patient?.primary_doctor_id || '');
                    const assignedDevice = devices.find((d: any) => d.assigned_to === user.id);
                    setSelectedDeviceId(assignedDevice?.id || '');
                }
            }
        } catch (err) {
            console.error("Failed to fetch user detail", err);
        }
        setLoadingDetail(false);
    };

    const closeDetailModal = () => {
        setSelectedUser(null);
        setUserDetail(null);
    };

    const handleSyncDoctor = () => {
        if (!selectedUser) return;
        setActionModal({
            isOpen: true,
            type: 'confirm',
            title: 'Konfirmasi Tautkan Dokter',
            message: `Tautkan pasien ${selectedUser.name} dengan dokter yang dipilih?`,
            onConfirm: executeSyncDoctor
        });
    };

    const executeSyncDoctor = async () => {
        if (!selectedUser) return;
        setActionLoading(true);
        try {
            const res = await fetchWithAuth(`/api/patients/${selectedUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ primary_doctor_id: selectedDoctorId || null })
            });
            
            if (!res.ok) {
                const text = await res.text();
                try {
                    const errorData = JSON.parse(text);
                    throw new Error(errorData.message || 'Gagal sinkronisasi');
                } catch (e) {
                    throw new Error(text || 'Gagal sinkronisasi');
                }
            }
            setSelectedUser({ ...selectedUser, connected_doctor_id: selectedDoctorId || null });
            fetchUsersAndDevices();
            setActionModal({
                isOpen: true,
                type: 'success',
                title: 'Berhasil',
                message: 'Berhasil mengupdate dokter utama pasien.',
                onConfirm: closeActionModal
            });
        } catch (err: any) {
            console.error("Failed to sync doctor", err);
            setActionModal({
                isOpen: true,
                type: 'error',
                title: 'Gagal',
                message: `Error: ${err.message}`,
                onConfirm: closeActionModal
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleSyncDevice = () => {
        if (!selectedUser) return;
        setActionModal({
            isOpen: true,
            type: 'confirm',
            title: 'Konfirmasi Tautkan Perangkat',
            message: `Tautkan pasien ${selectedUser.name} dengan perangkat yang dipilih?`,
            onConfirm: executeSyncDevice
        });
    };

    const executeSyncDevice = async () => {
        if (!selectedUser) return;
        setActionLoading(true);
        try {
            if (selectedUser.connected_device_id && selectedUser.connected_device_id !== selectedDeviceId) {
                await fetchWithAuth(`/api/devices/${selectedUser.connected_device_id}/assign`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ patient_id: null })
                });
            }
            
            if (selectedDeviceId) {
                const response = await fetchWithAuth(`/api/devices/${selectedDeviceId}/assign`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ patient_id: selectedUser.id })
                });
                if (!response.ok) throw new Error(await response.text());
            }
            setSelectedUser({ ...selectedUser, connected_device_id: selectedDeviceId || null });
            fetchUsersAndDevices();
            setActionModal({
                isOpen: true,
                type: 'success',
                title: 'Berhasil',
                message: 'Berhasil menautkan perangkat ke pasien.',
                onConfirm: closeActionModal
            });
        } catch (err: any) {
            console.error("Failed to sync device", err);
            setActionModal({
                isOpen: true,
                type: 'error',
                title: 'Gagal',
                message: `Error: ${err.message}`,
                onConfirm: closeActionModal
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleImpersonate = (user: AdminUser) => {
        setActionModal({
            isOpen: true,
            type: 'confirm',
            title: 'Konfirmasi Login',
            message: `Apakah Anda yakin ingin login ke dasbor ${user.name}? Anda akan dialihkan.`,
            onConfirm: () => executeImpersonate(user)
        });
    };

    const executeImpersonate = async (user: AdminUser) => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetchWithAuth(`/api/admin/impersonate/${user.account_id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();

            if (data.success && data.user_id) {
                const currentRole = localStorage.getItem('user_role');
                if (currentRole === 'admin') {
                    localStorage.setItem('admin_auth_token', token || '');
                    localStorage.setItem('admin_user_id', localStorage.getItem('user_id') || '');
                    localStorage.setItem('original_role', 'admin');
                }
                sessionStorage.setItem('is_impersonating', 'true');
                localStorage.removeItem('connectedPatients');
                localStorage.removeItem('connectedDoctor');
                localStorage.removeItem('mock_patient_profile');
                localStorage.setItem('user_id', data.user_id.toString());
                localStorage.setItem('user_role', data.role);
                if (data.token) {
                    localStorage.setItem('auth_token', data.token);
                }
                sessionStorage.setItem('return_url', '/admin/users');
                
                setActionModal({
                    isOpen: true,
                    type: 'success',
                    title: 'Berhasil',
                    message: `Berhasil login sebagai ${user.name}. Mengalihkan...`,
                    onConfirm: () => {
                        if (data.role === 'pasien') {
                            navigate('/patient/dashboard');
                        } else {
                            navigate('/doctor/dashboard');
                        }
                    }
                });
            } else {
                setActionModal({
                    isOpen: true,
                    type: 'error',
                    title: 'Gagal',
                    message: data.message || 'Gagal melakukan impersonate.',
                    onConfirm: closeActionModal
                });
            }
        } catch (err) {
            console.error("Gagal impersonate", err);
            setActionModal({
                isOpen: true,
                type: 'error',
                title: 'Gagal',
                message: 'Koneksi ke server gagal.',
                onConfirm: closeActionModal
            });
        } finally {
            setActionLoading(false);
        }
    };

    const paginatedUsers = [...users].sort((a, b) => new Date(b.registered_at || 0).getTime() - new Date(a.registered_at || 0).getTime());
    const doctorsList = allDoctors;

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        const d = new Date(dateString);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${dd}-${mm}-${yy} ${hh}:${min}`;
    };

    const renderUserRow = (u: any) => (
        <tr key={u.id} className="hover:bg-clinical-surface/50 transition-colors border-b border-clinical-charcoal/5 last:border-0 bg-white group">
            <td className="p-4 font-mono text-xs text-clinical-blue font-bold">{u.id.substring(0, 9)}</td>
            <td className="p-4 text-sm font-bold text-clinical-charcoal">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-clinical-surface border border-clinical-charcoal/5 shadow-sm overflow-hidden flex items-center justify-center text-clinical-charcoal/60 shrink-0">
                        {u.profile_photo ? (
                            <img src={u.profile_photo} alt={u.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="material-symbols-outlined text-[18px]">person</span>
                        )}
                    </div>
                    {u.name}
                </div>
            </td>
            {activeTab === 'pasien' && (
                <td className="p-4 text-xs font-mono font-bold text-clinical-blue">
                    {u.connected_doctor_id ? (allDoctors.find((d: any) => d.id === u.connected_doctor_id)?.name || u.connected_doctor_id) : <span className="text-clinical-charcoal/50 italic font-normal">Kosong</span>}
                </td>
            )}
            {activeTab === 'pasien' && (
                <td className="p-4 text-xs font-mono font-bold text-clinical-blue">
                    {u.connected_device_id ? u.connected_device_id : <span className="text-clinical-charcoal/50 italic font-normal">Kosong</span>}
                </td>
            )}
            <td className="p-4 text-xs text-clinical-charcoal/70">{formatDate(u.registered_at)}</td>
            <td className="p-4">
                <div className="flex items-center gap-4 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button onClick={() => handleViewDetail(u)} className="text-clinical-charcoal hover:text-clinical-blue text-xs font-bold flex items-center gap-1 transition-colors">
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        Detail & Sync
                    </button>
                    <button onClick={() => handleImpersonate(u)} className="text-clinical-charcoal hover:text-clinical-blue text-xs font-bold flex items-center gap-1 transition-colors">
                        <span className="material-symbols-outlined text-[16px]">login</span>
                        Login
                    </button>
                </div>
            </td>
        </tr>
    );

    return (
        <div className="bg-clinical-surface text-clinical-charcoal antialiased overflow-x-hidden w-full min-h-screen relative font-sans">
            <div className="absolute inset-0 ecg-grid opacity-10 pointer-events-none z-0"></div>
            <AdminSidebar />

            <main id="main-content" className={`pb-24 md:pb-12 transition-all duration-300 min-h-screen flex flex-col relative z-10 md:ml-[260px] ${isOpen ? '' : 'ml-0'}`}>
                <header className="sticky top-0 bg-clinical-surface/80 backdrop-blur-xl border-b border-clinical-charcoal/5 z-40 px-4 md:px-6 py-4 flex items-center gap-4 max-w-container-max mx-auto w-full transition-all duration-300">
                    <button onClick={toggleSidebar} className="md:hidden flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-white-container text-clinical-charcoal/70 transition-colors outline-none" title="Sembunyikan / Tampilkan Menu Utama">
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-clinical-charcoal">Manajemen Pengguna</h1>
                        <p className="text-xs md:text-sm font-medium text-clinical-charcoal/60 mt-0.5">Daftar semua pengguna terdaftar di sistem.</p>
                    </div>
                </header>

                <div className="px-4 md:px-6 max-w-container-max mx-auto mt-6 w-full flex-1 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                        <div className="flex bg-white/50 backdrop-blur-sm border border-clinical-charcoal/5 rounded-xl p-1 shadow-sm">
                            <button
                                onClick={() => { setActiveTab('pasien'); setCurrentPage(1); }}
                                className={`px-5 py-2.5 font-bold text-sm transition-all relative rounded-lg ${activeTab === 'pasien' ? 'text-clinical-blue bg-white shadow-md' : 'text-clinical-charcoal/60 hover:text-clinical-charcoal'}`}
                            >Pasien</button>
                            <button
                                onClick={() => { setActiveTab('dokter'); setCurrentPage(1); }}
                                className={`px-5 py-2.5 font-bold text-sm transition-all relative rounded-lg ${activeTab === 'dokter' ? 'text-clinical-blue bg-white shadow-md' : 'text-clinical-charcoal/60 hover:text-clinical-charcoal'}`}
                            >Dokter</button>
                        </div>
                        <div className="flex-1"></div>
                        <button onClick={() => setShowAddModal(true)} className="bg-clinical-blue text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-md flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all">
                            <span className="material-symbols-outlined text-[18px]">add</span> Tambah Manual
                        </button>
                    </div>

                    <div className="mb-6 bg-clinical-blue/5 border border-clinical-blue/20 rounded-[1.5rem] shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 md:p-6 bg-clinical-blue/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-bold text-clinical-blue flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]">account_circle</span>
                                    Akses Cepat Akun Uji Coba ({activeTab === 'pasien' ? 'Pasien' : 'Dokter'})
                                </h3>
                                <p className="text-xs text-clinical-charcoal/70 mt-1">
                                    Gunakan profil di bawah ini untuk menguji sistem dengan menekan tombol <strong className="text-clinical-blue">Login</strong>.
                                </p>
                            </div>
                        </div>
                        {testUser ? (
                            <div className="overflow-x-auto bg-white border-t border-clinical-blue/20">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="bg-clinical-surface/50 text-clinical-charcoal/60 text-[10px] uppercase tracking-wider font-bold">
                                            <th className="p-4 border-b border-clinical-charcoal/5">User ID</th>
                                            <th className="p-4 border-b border-clinical-charcoal/5">Nama Lengkap</th>
                                            {activeTab === 'pasien' && <th className="p-4 border-b border-clinical-charcoal/5">Dokter Terhubung</th>}
                                            {activeTab === 'pasien' && <th className="p-4 border-b border-clinical-charcoal/5">Device Terhubung</th>}
                                            <th className="p-4 border-b border-clinical-charcoal/5">Tanggal Daftar</th>
                                            <th className="p-4 border-b border-clinical-charcoal/5">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {renderUserRow(testUser)}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-4 text-xs font-bold text-clinical-charcoal/50 bg-white border-t border-clinical-blue/20">
                                Memuat akun uji coba...
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-[2rem] border border-clinical-charcoal/5 shadow-sm overflow-hidden flex flex-col mb-8">
                        <div className="p-6 border-b border-clinical-charcoal/5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white/50 backdrop-blur-sm">
                            <h2 className="font-bold text-clinical-charcoal text-lg">Semua Pengguna ({activeTab === 'pasien' ? 'Pasien' : 'Dokter'})</h2>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-clinical-surface/50 text-clinical-charcoal/60 text-[10px] uppercase tracking-wider font-bold">
                                        <th className="p-4 border-b border-clinical-charcoal/5">User ID</th>
                                        <th className="p-4 border-b border-clinical-charcoal/5">Nama Lengkap</th>
                                        {activeTab === 'pasien' && <th className="p-4 border-b border-clinical-charcoal/5">Dokter Terhubung</th>}
                                        {activeTab === 'pasien' && <th className="p-4 border-b border-clinical-charcoal/5">Device Terhubung</th>}
                                        <th className="p-4 border-b border-clinical-charcoal/5">Tanggal Daftar</th>
                                        <th className="p-4 border-b border-clinical-charcoal/5">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={activeTab === 'pasien' ? 6 : 4} className="p-8 text-center text-clinical-charcoal/50">Memuat data...</td></tr>
                                    ) : users.length === 0 ? (
                                        <tr><td colSpan={activeTab === 'pasien' ? 6 : 4} className="p-8 text-center text-clinical-charcoal/50">Tidak ada data.</td></tr>
                                    ) : paginatedUsers.map((u: any) => renderUserRow(u))}
                                </tbody>
                            </table>
                        </div>
                        {users.length > 0 && (
                            <Pagination
                                currentPage={currentPage}
                                totalItems={totalUsers}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                            />
                        )}
                    </div>
                </div>
            </main>

            {/* Add User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-clinical-charcoal/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-clinical-charcoal/10 overflow-hidden flex flex-col">
                        <div className="px-6 py-5 border-b border-clinical-charcoal/5 flex items-center justify-between bg-white/50 backdrop-blur-sm">
                            <h3 className="font-bold font-display text-xl text-clinical-charcoal">Tambah Pengguna Manual</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-clinical-charcoal/50 hover:text-clinical-charcoal transition-colors"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <form onSubmit={handleAddUser} className="p-6 space-y-4">
                            {addError && <div className="bg-clinical-red/10 text-clinical-red p-3 rounded-lg text-sm font-bold">{addError}</div>}
                            <div>
                                <label className="block text-[11px] font-bold text-clinical-charcoal/60 uppercase tracking-widest mb-2">Email</label>
                                <input type="email" required value={addEmail} onChange={e => setAddEmail(e.target.value)} className="w-full bg-clinical-surface/50 border border-clinical-charcoal/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-clinical-blue focus:ring-1 focus:ring-clinical-blue transition-all" placeholder="email@contoh.com" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-clinical-charcoal/60 uppercase tracking-widest mb-2">Password (Minimal 6 karakter)</label>
                                <input type="password" required minLength={6} value={addPassword} onChange={e => setAddPassword(e.target.value)} className="w-full bg-clinical-surface/50 border border-clinical-charcoal/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-clinical-blue focus:ring-1 focus:ring-clinical-blue transition-all" placeholder="••••••" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-clinical-charcoal/60 uppercase tracking-widest mb-2">Role</label>
                                <select value={addRole} onChange={e => setAddRole(e.target.value as any)} className="w-full bg-clinical-surface/50 border border-clinical-charcoal/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-clinical-blue focus:ring-1 focus:ring-clinical-blue transition-all cursor-pointer">
                                    <option value="dokter">Dokter</option>
                                    <option value="pasien">Pasien</option>
                                </select>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-[11px] font-bold text-clinical-charcoal/60 uppercase tracking-widest mb-2">Nama Depan</label>
                                    <input type="text" required value={addFirstName} onChange={e => setAddFirstName(e.target.value)} className="w-full bg-clinical-surface/50 border border-clinical-charcoal/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-clinical-blue focus:ring-1 focus:ring-clinical-blue transition-all" placeholder="John" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[11px] font-bold text-clinical-charcoal/60 uppercase tracking-widest mb-2">Nama Belakang (Opsional)</label>
                                    <input type="text" value={addLastName} onChange={e => setAddLastName(e.target.value)} className="w-full bg-clinical-surface/50 border border-clinical-charcoal/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-clinical-blue focus:ring-1 focus:ring-clinical-blue transition-all" placeholder="Doe" />
                                </div>
                            </div>
                            {addRole === 'pasien' && (
                                <div className="flex gap-4 animate-in fade-in duration-200">
                                    <div className="flex-1">
                                        <label className="block text-[11px] font-bold text-clinical-charcoal/60 uppercase tracking-widest mb-2">Umur</label>
                                        <input type="number" required value={addAge} onChange={e => setAddAge(parseInt(e.target.value) || '')} className="w-full bg-clinical-surface/50 border border-clinical-charcoal/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-clinical-blue focus:ring-1 focus:ring-clinical-blue transition-all" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-[11px] font-bold text-clinical-charcoal/60 uppercase tracking-widest mb-2">Gender</label>
                                        <select value={addGender} onChange={e => setAddGender(e.target.value)} className="w-full bg-clinical-surface/50 border border-clinical-charcoal/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-clinical-blue focus:ring-1 focus:ring-clinical-blue transition-all cursor-pointer">
                                            <option value="L">Laki-laki</option>
                                            <option value="P">Perempuan</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                            <div className="pt-6 flex gap-3">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-full font-bold text-clinical-charcoal bg-clinical-charcoal/5 hover:bg-clinical-charcoal/10 active:scale-95 transition-all outline-none">Batal</button>
                                <button type="submit" disabled={addLoading} className="flex-1 py-3 rounded-full font-bold text-white bg-clinical-blue hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 outline-none">
                                    {addLoading && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                                    {addLoading ? 'Menyimpan...' : 'Simpan Akun'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail & Sync Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-clinical-charcoal/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-clinical-charcoal/10 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-5 border-b border-clinical-charcoal/5 flex items-center justify-between bg-white/50 backdrop-blur-sm shrink-0">
                            <h3 className="font-bold font-display text-xl text-clinical-charcoal">Detail & Sinkronisasi Pengguna</h3>
                            <button onClick={closeDetailModal} className="text-clinical-charcoal/50 hover:text-clinical-charcoal transition-colors"><span className="material-symbols-outlined">close</span></button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            {loadingDetail ? (
                                <div className="text-center py-12 flex flex-col items-center gap-3">
                                    <span className="material-symbols-outlined text-4xl animate-spin text-clinical-blue">progress_activity</span>
                                    <p className="text-clinical-charcoal/50 font-bold text-sm">Memuat informasi profil...</p>
                                </div>
                            ) : userDetail ? (
                                <div className="space-y-6">
                                    {/* Profile Header */}
                                    <div className="flex items-center gap-6">
                                        <div className="w-24 h-24 rounded-[1.5rem] bg-clinical-surface border-4 border-white shadow-md overflow-hidden flex items-center justify-center text-clinical-charcoal/50 shrink-0">
                                            {userDetail.patient?.profile_photo || userDetail.profile_photo ? (
                                                <img src={userDetail.patient?.profile_photo || userDetail.profile_photo} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="material-symbols-outlined text-5xl">person</span>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-bold text-clinical-charcoal mb-1">
                                                {selectedUser.name}
                                            </h4>
                                            <p className="text-sm text-clinical-blue font-mono bg-clinical-blue/10 px-3 py-1.5 rounded-lg inline-block font-bold">{selectedUser.id}</p>
                                            <p className="text-xs text-clinical-charcoal/50 mt-2 font-medium">Terdaftar sejak: {selectedUser.registered_at.split('T')[0]}</p>
                                        </div>
                                    </div>

                                    {/* Detailed Data */}
                                    <div className="grid grid-cols-2 gap-4 bg-clinical-surface/50 p-5 rounded-2xl border border-clinical-charcoal/5">
                                        <div>
                                            <p className="text-[10px] text-clinical-charcoal/60 uppercase tracking-widest font-bold mb-1">Jenis Kelamin</p>
                                            <p className="font-bold text-clinical-charcoal text-sm">{userDetail.gender || userDetail.doctor?.gender || userDetail.patient?.gender || 'Belum diatur'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-clinical-charcoal/60 uppercase tracking-widest font-bold mb-1">Umur</p>
                                            <p className="font-bold text-clinical-charcoal text-sm">{userDetail.age || userDetail.doctor?.age || userDetail.patient?.age || 'Belum diatur'}</p>
                                        </div>
                                    </div>

                                    {/* Sync Actions (Only for Patient) */}
                                    {selectedUser.role === 'pasien' && (
                                        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                                            <h4 className="font-bold text-clinical-charcoal text-sm flex items-center gap-2 pb-2 border-b border-clinical-charcoal/5 mt-6">
                                                <span className="material-symbols-outlined text-clinical-blue text-[18px]">sync_alt</span>
                                                Manajemen Sinkronisasi
                                            </h4>

                                            {/* Sync Doctor */}
                                            <div className="bg-white p-4 rounded-2xl border border-clinical-charcoal/5 shadow-sm flex flex-col sm:flex-row sm:items-end gap-3">
                                                <div className="flex-1">
                                                    <label className="block text-[11px] font-bold text-clinical-charcoal/60 uppercase tracking-widest mb-2">Dokter Penanggung Jawab</label>
                                                    <select value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)} className="w-full bg-clinical-surface/50 border border-clinical-charcoal/10 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-clinical-blue focus:ring-1 focus:ring-clinical-blue shadow-sm transition-all text-clinical-charcoal cursor-pointer">
                                                        <option value="">-- Kosong (Tidak Terhubung) --</option>
                                                        {doctorsList.map((d: any) => (
                                                            <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <button onClick={handleSyncDoctor} className="bg-clinical-blue text-white px-6 py-3 rounded-xl text-sm font-bold shadow-sm hover:brightness-110 active:scale-95 transition-all whitespace-nowrap flex items-center justify-center gap-2 outline-none">
                                                    <span className="material-symbols-outlined text-[18px]">save</span>
                                                    Terapkan
                                                </button>
                                            </div>

                                            {/* Sync Device */}
                                            <div className="bg-white p-4 rounded-2xl border border-clinical-charcoal/5 shadow-sm flex flex-col sm:flex-row sm:items-end gap-3">
                                                <div className="flex-1">
                                                    <label className="block text-[11px] font-bold text-clinical-charcoal/60 uppercase tracking-widest mb-2">Alat ECG Terpasang</label>
                                                    <select value={selectedDeviceId} onChange={e => setSelectedDeviceId(e.target.value)} className="w-full bg-clinical-surface/50 border border-clinical-charcoal/10 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-clinical-blue focus:ring-1 focus:ring-clinical-blue shadow-sm transition-all text-clinical-charcoal cursor-pointer">
                                                        <option value="">-- Kosong (Tidak Terhubung) --</option>
                                                        {devices.map((d: any) => (
                                                            <option key={d.id} value={d.id} disabled={d.assigned_to !== null && d.assigned_to !== selectedUser.id}>
                                                                {d.name} {d.assigned_to && d.assigned_to !== selectedUser.id ? '(Sedang dipakai pasien lain)' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <button onClick={handleSyncDevice} className="bg-clinical-blue text-white px-6 py-3 rounded-xl text-sm font-bold shadow-sm hover:brightness-110 active:scale-95 transition-all whitespace-nowrap flex items-center justify-center gap-2 outline-none">
                                                    <span className="material-symbols-outlined text-[18px]">save</span>
                                                    Terapkan
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-clinical-charcoal/50 font-medium">Gagal mengambil detail.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Detail & Sync Modal */}
            {/* ... other modals ... */}

            <ActionModal 
                isOpen={actionModal.isOpen}
                type={actionModal.type}
                title={actionModal.title}
                message={actionModal.message}
                onConfirm={actionModal.onConfirm}
                onClose={closeActionModal}
                isLoading={actionLoading}
            />
        </div>
    );
};
