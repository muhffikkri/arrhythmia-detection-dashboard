import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSidebar } from '../../../application/context/SidebarContext';
import { LogoutModal } from '../shared/LogoutModal';

export const AdminSidebar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isOpen, closeSidebar } = useSidebar();
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

    const isActive = (path: string) => location.pathname === path;

    const handleNavigation = () => {
        // Hanya tutup sidebar secara otomatis jika berada di tampilan mobile
        if (window.innerWidth < 768) {
            closeSidebar();
        }
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-clinical-charcoal/40 backdrop-blur-sm z-40 md:hidden transition-opacity" 
                    onClick={closeSidebar}
                />
            )}
            <aside id="main-sidebar" className={`
                z-50 flex-col transition-all duration-500 ease-in-out
                md:fixed md:top-0 md:h-screen md:w-[260px] md:bg-white md:border-r md:border-clinical-charcoal/5 md:translate-y-0 md:flex md:rounded-none md:shadow-none md:translate-x-0 md:opacity-100 md:pointer-events-auto
                fixed top-[72px] left-0 right-0 w-full bg-white/95 backdrop-blur-xl rounded-b-[2rem] shadow-2xl border-b border-clinical-charcoal/5 overflow-hidden pb-6 md:pb-0
                ${isOpen ? 'translate-y-0 opacity-100 flex' : '-translate-y-[150%] opacity-0 pointer-events-none flex'}
            `}>
                <div className="hidden md:flex p-6 items-center gap-3 border-b border-clinical-charcoal/5 cursor-pointer" onClick={() => navigate('/admin/dashboard')}>
                    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDJfACqMSzy6S1S81otlvrhfNIHr526OT9XlgCl04PJNewQysO-szQBYwNy1CAVfF851GuVn5qSOMjNWQdVGWANcLFnC4v9hdbnEGw6a6zjZHiO-z3KrczLQUpmNPbJBK3DPcvSUNAMyxXlVaN3XK5XqDW2MwFfclgdHRXsKHmF-u3QnVmzkBpw6dRTGNCyHk4YD526zmZNozyix_CMqEgOacA2M9LUFTaMDhBfigT5e7htUaxvw6bZCKeoVwqQgtQxho0qkC32iy0g"
                        alt="ecgrhythmia logo" className="w-8 h-8 object-contain" />
                    <div className="text-xl font-headline-lg tracking-tight select-none flex">
                        <span className="text-clinical-red">ecg</span><span className="text-clinical-charcoal">rhythmia</span>
                    </div>
                </div>

                <div className="px-6 py-2 bg-clinical-charcoal/5 text-clinical-charcoal text-[10px] font-bold tracking-widest uppercase text-center border-b border-clinical-charcoal/5">
                    SYSTEM ADMIN
                </div>

                <nav className="flex-1 px-4 mt-6 space-y-1 overflow-y-auto custom-scrollbar">
                    <Link onClick={handleNavigation} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold shadow-sm transition-all ${isActive('/admin/dashboard') ? 'bg-clinical-blue text-white' : 'text-clinical-charcoal/70 hover:bg-clinical-surface hover:text-clinical-charcoal group'}`} to="/admin/dashboard">
                        <span className={`material-symbols-outlined ${isActive('/admin/dashboard') ? '' : 'text-clinical-charcoal/40 group-hover:text-clinical-blue'}`}>dashboard</span>
                        <span className="text-sm">Dashboard</span>
                    </Link>
                    <Link onClick={handleNavigation} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold shadow-sm transition-all ${isActive('/admin/users') ? 'bg-clinical-blue text-white' : 'text-clinical-charcoal/70 hover:bg-clinical-surface hover:text-clinical-charcoal group'}`} to="/admin/users">
                        <span className={`material-symbols-outlined ${isActive('/admin/users') ? '' : 'text-clinical-charcoal/40 group-hover:text-clinical-blue'}`}>manage_accounts</span>
                        <span className="text-sm">Manajemen Pengguna</span>
                    </Link>
                    <Link onClick={handleNavigation} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold shadow-sm transition-all ${isActive('/admin/devices') ? 'bg-clinical-blue text-white' : 'text-clinical-charcoal/70 hover:bg-clinical-surface hover:text-clinical-charcoal group'}`} to="/admin/devices">
                        <span className={`material-symbols-outlined ${isActive('/admin/devices') ? '' : 'text-clinical-charcoal/40 group-hover:text-clinical-blue'}`}>router</span>
                        <span className="text-sm">Armada Perangkat</span>
                    </Link>
                    <Link onClick={handleNavigation} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold shadow-sm transition-all ${isActive('/admin/sessions') ? 'bg-clinical-blue text-white' : 'text-clinical-charcoal/70 hover:bg-clinical-surface hover:text-clinical-charcoal group'}`} to="/admin/sessions">
                        <span className={`material-symbols-outlined ${isActive('/admin/sessions') ? '' : 'text-clinical-charcoal/40 group-hover:text-clinical-blue'}`}>history</span>
                        <span className="text-sm">Manajemen Sesi</span>
                    </Link>
                </nav>

                <div className="p-4 border-t border-clinical-charcoal/5 bg-clinical-surface/30">
                    <div className="flex bg-white border border-clinical-charcoal/10 p-3 rounded-xl items-center gap-3 transition-all group hover:border-clinical-blue/50 cursor-pointer shadow-sm">
                        <div className="w-9 h-9 rounded-full bg-clinical-blue/10 flex items-center justify-center border border-clinical-blue/20 text-clinical-blue font-bold">
                            AD
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="font-bold text-xs text-clinical-charcoal truncate group-hover:text-clinical-blue transition-colors">atmint</p>
                            <p className="text-[10px] text-clinical-charcoal/50 truncate uppercase tracking-wider font-medium">Root Access</p>
                        </div>
                        <button onClick={(e) => {
                            e.stopPropagation();
                            closeSidebar();
                            setIsLogoutModalOpen(true);
                        }}>
                            <span className="material-symbols-outlined text-clinical-charcoal/40 text-lg hover:text-clinical-red transition-colors outline-none">logout</span>
                        </button>
                    </div>
                </div>
            </aside>
            <LogoutModal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} />
        </>
    );
};
