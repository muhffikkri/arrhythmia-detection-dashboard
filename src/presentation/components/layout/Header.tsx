import React from 'react';
import { useSidebar } from '../../../application/context/SidebarContext';
import { useNavigate } from 'react-router-dom';

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

interface HeaderProps {
    deviceId?: string;
    sessionId?: string;
}

export const Header: React.FC<HeaderProps> = ({ deviceId = "UNDIP-ECG-01", sessionId = "Sesi Aktif" }) => {
    const { isOpen, toggleSidebar } = useSidebar();
    const navigate = useNavigate();
    
    return (
        <header className={`fixed top-0 bg-background/90 backdrop-blur-md border-b border-outline-variant/30 z-40 px-4 md:px-6 py-4 flex justify-between items-center transition-all duration-300 ${isOpen ? 'md:left-[260px] md:w-[calc(100%-260px)] left-0 w-full' : 'left-0 w-full'}`}>
            <div className="flex items-center gap-3 flex-1">
                <button onClick={toggleSidebar} id="toggle-sidebar-btn" className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors outline-none" title="Sembunyikan / Tampilkan Menu Utama">
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-charcoal">Live Monitor</h1>
                    <p className="text-xs text-on-surface-variant mt-0.5">Pemantauan sinyal ECG secara real-time</p>
                </div>
            </div>
            <div className="hidden md:flex items-center gap-3 px-4 py-1.5 bg-white/80 rounded-full border border-pink-200 shadow-sm max-w-[400px]">
                <div className="flex items-center justify-center bg-pink-50 rounded-full w-8 h-8 flex-shrink-0">
                    <span className="material-symbols-outlined text-medical-teal text-[18px]">monitor_heart</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Session</span>
                    <span className="text-xs font-bold text-charcoal truncate max-w-[130px] leading-tight">{sessionId}</span>
                </div>
                <div className="w-px h-6 bg-pink-200/60 mx-1"></div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Device ID</span>
                    <span className="text-xs font-bold text-charcoal truncate max-w-[130px] leading-tight">{deviceId}</span>
                </div>
            </div>
            <div className="flex items-center gap-3 md:gap-4 flex-1 justify-end">
                {localStorage.getItem('admin_auth_token') && (
                    <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-red-100 border border-red-200 rounded-full">
                        <span className="material-symbols-outlined text-red-600 text-sm">admin_panel_settings</span>
                        <span className="text-xs font-bold text-red-700">Admin Login</span>
                        <button onClick={() => handleReturnToOriginalProfile(navigate)} className="ml-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 transition-colors">
                            KEMBALI
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};