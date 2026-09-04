import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSidebar } from '../../../application/context/SidebarContext';
import { LogoutModal } from '../shared/LogoutModal';

export const AdminSidebar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isOpen, closeSidebar, toggleSidebar, isCollapsed, toggleCollapsed } = useSidebar();
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

    const isActive = (path: string) => location.pathname === path;

    const handleNavigation = () => {
        if (window.innerWidth < 768) {
            closeSidebar();
        }
    };

    const navItems = [
        { path: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' },
        { path: '/admin/users', icon: 'manage_accounts', label: 'Manajemen Pengguna' },
        { path: '/admin/devices', icon: 'router', label: 'Armada Perangkat' },
        { path: '/admin/sessions', icon: 'history', label: 'Manajemen Sesi' },
    ];

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-clinical-charcoal/40 backdrop-blur-sm z-40 md:hidden transition-opacity"
                    onClick={closeSidebar}
                />
            )}
            <aside
                id="main-sidebar"
                className={`
                    z-50 flex-col transition-all duration-300 ease-in-out
                    fixed top-0 left-0 h-screen bg-white border-r border-clinical-charcoal/5 shadow-none
                    md:translate-y-0 md:translate-x-0 md:opacity-100 md:pointer-events-auto md:flex
                    ${isOpen
                        ? 'translate-y-0 opacity-100 flex w-full md:w-[260px] top-[72px] md:top-0 h-auto md:h-screen rounded-b-[2rem] md:rounded-none shadow-2xl md:shadow-none bg-white/95 md:bg-white backdrop-blur-xl md:backdrop-blur-none pb-6 md:pb-0'
                        : '-translate-y-[150%] md:translate-y-0 opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto flex w-[260px]'
                    }
                    ${isCollapsed ? 'md:!w-[72px]' : 'md:w-[260px]'}
                `}
            >
                {/* Logo header — visible only on desktop */}
                <div className={`hidden md:flex items-center border-b border-clinical-charcoal/5 ${isCollapsed ? 'p-3 flex-col gap-4 justify-center' : 'p-5 justify-between'}`}>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/admin/dashboard')}>
                        <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDJfACqMSzy6S1S81otlvrhfNIHr526OT9XlgCl04PJNewQysO-szQBYwNy1CAVfF851GuVn5qSOMjNWQdVGWANcLFnC4v9hdbnEGw6a6zjZHiO-z3KrczLQUpmNPbJBK3DPcvSUNAMyxXlVaN3XK5XqDW2MwFfclgdHRXsKHmF-u3QnVmzkBpw6dRTGNCyHk4YD526zmZNozyix_CMqEgOacA2M9LUFTaMDhBfigT5e7htUaxvw6bZCKeoVwqQgtQxho0qkC32iy0g"
                            alt="ecgrhythmia logo" className="w-8 h-8 object-contain shrink-0" />
                        {!isCollapsed && (
                            <div className="text-xl font-headline-lg tracking-tight select-none flex shrink-0">
                                <span className="text-clinical-red">ecg</span><span className="text-clinical-charcoal">rhythmia</span>
                            </div>
                        )}
                    </div>
                    {/* Desktop Collapse Button */}
                    <button
                        onClick={toggleCollapsed}
                        className="p-1.5 rounded-lg hover:bg-clinical-surface text-clinical-charcoal/50 hover:text-clinical-charcoal transition-colors outline-none shrink-0"
                        title={isCollapsed ? "Tampilkan Sidebar" : "Sembunyikan Sidebar"}
                    >
                        <span className="material-symbols-outlined text-[20px]">{isCollapsed ? 'menu' : 'menu_open'}</span>
                    </button>
                </div>

                <div className={`py-2 bg-clinical-charcoal/5 text-clinical-charcoal text-[10px] font-bold tracking-widest uppercase text-center border-b border-clinical-charcoal/5 ${isCollapsed ? 'px-1' : 'px-6'}`}>
                    {isCollapsed ? 'SYS' : 'SYSTEM ADMIN'}
                </div>

                <nav className="flex-1 px-4 mt-6 space-y-1 overflow-y-auto custom-scrollbar">
                    {navItems.map(({ path, icon, label }) => (
                        <Link
                            key={path}
                            onClick={handleNavigation}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold shadow-sm transition-all ${isActive(path) ? 'bg-clinical-blue text-white' : 'text-clinical-charcoal/70 hover:bg-clinical-surface hover:text-clinical-charcoal group'}`}
                            to={path}
                            title={isCollapsed ? label : undefined}
                        >
                            <span className={`material-symbols-outlined ${isActive(path) ? '' : 'text-clinical-charcoal/40 group-hover:text-clinical-blue'}`}>{icon}</span>
                            {!isCollapsed && <span className="text-sm">{label}</span>}
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t border-clinical-charcoal/5 bg-clinical-surface/30">
                    <div 
                        className={`flex bg-white border border-clinical-charcoal/10 ${isCollapsed ? 'p-2 justify-center' : 'p-3 gap-3'} rounded-xl items-center transition-all group hover:border-clinical-blue/50 cursor-pointer shadow-sm`}
                        onClick={(e) => {
                            if (isCollapsed) {
                                e.stopPropagation();
                                closeSidebar();
                                setIsLogoutModalOpen(true);
                            }
                        }}
                        title={isCollapsed ? "Logout" : undefined}
                    >
                        <div className="w-9 h-9 rounded-full bg-clinical-blue/10 flex items-center justify-center border border-clinical-blue/20 text-clinical-blue font-bold shrink-0">
                            AD
                        </div>
                        {!isCollapsed && (
                            <>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-bold text-xs text-clinical-charcoal truncate group-hover:text-clinical-blue transition-colors">Admin</p>
                                    <p className="text-[10px] text-clinical-charcoal/50 truncate uppercase tracking-wider font-medium">Root Access</p>
                                </div>
                                <button onClick={(e) => {
                                    e.stopPropagation();
                                    closeSidebar();
                                    setIsLogoutModalOpen(true);
                                }}>
                                    <span className="material-symbols-outlined text-clinical-charcoal/40 text-lg hover:text-clinical-red transition-colors outline-none">logout</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </aside>
            <LogoutModal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} />
        </>
    );
};
