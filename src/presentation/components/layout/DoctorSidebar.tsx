import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSidebar } from '../../../application/context/SidebarContext';
import { LogoutModal } from '../shared/LogoutModal';
import { API_URL } from '../../../config/env';
import { fetchWithAuth } from '../../../config/api';
import { useCachedFetch } from '../../../application/hooks/useCachedFetch';

const handleReturnToOriginalProfile = (navigate: any) => {
    const adminToken = localStorage.getItem('admin_auth_token');
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
    }
};

export const DoctorSidebar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isOpen, closeSidebar } = useSidebar();
    const userId = localStorage.getItem('user_id');
    const { data: profileData } = useCachedFetch(userId ? `/api/doctors/${userId}` : null);
    const profile = profileData || null;
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

    const handleNavClick = () => {
        if (window.innerWidth < 768) {
            closeSidebar();
        }
    };

    const isActive = (path: string) => location.pathname === path;

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-40 md:hidden transition-opacity" 
                    onClick={closeSidebar}
                />
            )}
            <aside id="main-sidebar" className={`
                z-50 flex-col transition-all duration-500 ease-in-out
                md:fixed md:top-0 md:h-screen md:w-[260px] md:bg-white-container-lowest md:border-r md:border-clinical-blue/20 md:translate-y-0 md:flex md:rounded-none md:shadow-none
                fixed top-[72px] left-0 right-0 w-full bg-white/95 backdrop-blur-xl rounded-b-[2rem] shadow-2xl border-b border-clinical-charcoal/5 overflow-hidden pb-6 md:pb-0
                ${isOpen ? 'translate-y-0 opacity-100 flex md:translate-x-0 md:opacity-100' : '-translate-y-[150%] opacity-0 pointer-events-none flex md:-translate-x-full md:opacity-0 md:translate-y-0'}
            `}>
                <div className="hidden md:flex p-6 items-center gap-3 border-b border-clinical-blue/20/30 cursor-pointer" onClick={() => { navigate('/doctor/dashboard'); handleNavClick(); }}>
                    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDJfACqMSzy6S1S81otlvrhfNIHr526OT9XlgCl04PJNewQysO-szQBYwNy1CAVfF851GuVn5qSOMjNWQdVGWANcLFnC4v9hdbnEGw6a6zjZHiO-z3KrczLQUpmNPbJBK3DPcvSUNAMyxXlVaN3XK5XqDW2MwFfclgdHRXsKHmF-u3QnVmzkBpw6dRTGNCyHk4YD526zmZNozyix_CMqEgOacA2M9LUFTaMDhBfigT5e7htUaxvw6bZCKeoVwqQgtQxho0qkC32iy0g"
                        alt="ecgrhythmia logo" className="w-8 h-8 object-contain" />
                    <div className="text-xl font-headline-lg tracking-tight select-none flex">
                        <span className="text-clinical-red">ecg</span><span className="text-clinical-charcoal">rhythmia</span>
                    </div>
                </div>


                <nav className="flex-1 px-4 mt-6 space-y-1">
                    <Link onClick={handleNavClick} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-label-md shadow-sm transition-all ${isActive('/doctor/dashboard') ? 'bg-clinical-blue text-white' : 'text-clinical-charcoal/70 hover:bg-white-container-low group'}`} to="/doctor/dashboard">
                        <span className={`material-symbols-outlined ${isActive('/doctor/dashboard') ? '' : 'text-outline group-hover:text-clinical-blue'}`}>dashboard</span>
                        <span className="text-sm font-body-sm">Dashboard</span>
                    </Link>
                    <Link onClick={handleNavClick} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-label-md shadow-sm transition-all ${isActive('/doctor/qr-scanner') ? 'bg-clinical-blue text-white' : 'text-clinical-charcoal/70 hover:bg-white-container-low group'}`} to="/doctor/qr-scanner">
                        <span className={`material-symbols-outlined ${isActive('/doctor/qr-scanner') ? '' : 'text-outline group-hover:text-clinical-blue'}`}>qr_code_scanner</span>
                        <span className="text-sm font-body-sm">Pasien Baru (QR)</span>
                    </Link>

                    <Link onClick={handleNavClick} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-label-md shadow-sm transition-all ${isActive('/doctor/analytics') ? 'bg-clinical-blue text-white' : 'text-clinical-charcoal/70 hover:bg-white-container-low group'}`} to="/doctor/analytics">
                        <span className={`material-symbols-outlined ${isActive('/doctor/analytics') ? '' : 'text-outline group-hover:text-clinical-blue'}`}>history</span>
                        <span className="text-sm font-body-sm">Riwayat Klinis</span>
                    </Link>
                </nav>

                {localStorage.getItem('admin_auth_token') && (
                    <div className="mx-4 mb-2 px-3 py-2 bg-red-100 border border-red-200 rounded-lg flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-red-600 text-[18px]">admin_panel_settings</span>
                            <span className="text-xs font-bold text-red-700">Admin Login</span>
                        </div>
                        <button onClick={() => handleReturnToOriginalProfile(navigate)} className="text-[10px] bg-red-600 text-white px-2 py-1.5 rounded hover:bg-red-700 transition-colors w-full uppercase font-bold tracking-wider">
                            Kembali ke Admin
                        </button>
                    </div>
                )}

                <div className="p-4 mt-4 md:mt-0 border-t border-clinical-blue/20/40 md:bg-white-container-low/50">
                    <div className="flex bg-white border border-clinical-blue/20/50 p-3 rounded-lg items-center gap-3 transition-all group hover:border-clinical-blue cursor-pointer" onClick={() => { navigate('/doctor/profile'); handleNavClick(); }}>
                        <div className="w-9 h-9 rounded-full overflow-hidden border border-clinical-blue/20 flex items-center justify-center bg-white-container">
                            {profile?.profile_photo ? (
                                <img className="w-full h-full object-cover" alt="Profile" src={profile.profile_photo} />
                            ) : (
                                <span className="material-symbols-outlined text-clinical-charcoal/70 text-xl">person</span>
                            )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="font-headline-md text-xs font-body-sm text-clinical-charcoal truncate group-hover:text-clinical-blue transition-colors">
                                {profile ? `Dr. ${profile.first_name} ${profile.last_name}` : 'Memuat...'}
                            </p>
                            <p className="text-[10px] text-clinical-charcoal/70 truncate uppercase tracking-wider font-medium">
                                {profile?.role === 'doctor' ? 'Dokter / Kardiolog' : profile?.role || '---'}
                            </p>
                        </div>
                        <button onClick={(e) => {
                            e.stopPropagation();
                            setIsLogoutModalOpen(true);
                        }}>
                            <span className="material-symbols-outlined text-outline text-lg hover:text-alert-red transition-colors">logout</span>
                        </button>
                    </div>
                </div>
            </aside>
            <LogoutModal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} />
        </>
    );
};
