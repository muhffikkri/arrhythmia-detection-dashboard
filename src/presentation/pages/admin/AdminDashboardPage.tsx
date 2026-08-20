import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/layout/AdminSidebar';
import { useSidebar } from '../../../application/context/SidebarContext';
import { useSecurity } from '../../../application/context/SecurityContext';
import { API_URL } from '../../../config/env';
import { fetchWithAuth } from '../../../config/api';
import { useCachedFetch } from '../../../application/hooks/useCachedFetch';

interface AdminStats {
    total_patients: number;
    total_doctors: number;
    active_devices: number;
    critical_alerts: number;
}

export const AdminDashboardPage: React.FC = () => {
    const { isOpen, toggleSidebar } = useSidebar();
    const { isDevToolsBlocked, toggleDevToolsBlocker } = useSecurity();
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const { data: statsData, isLoading: loading } = useCachedFetch<AdminStats>(`/api/admin/stats`);
    const stats = statsData || null;

    useEffect(() => {
        if (statsData) {
            setLastSync(new Date());
        }
    }, [statsData]);
    return (
        <div className="bg-clinical-surface text-clinical-charcoal antialiased overflow-x-hidden w-full min-h-screen relative font-sans">
            <div className="absolute inset-0 ecg-grid opacity-10 pointer-events-none z-0"></div>
            <AdminSidebar />
            
            <main id="main-content" className={`pb-24 md:pb-12 transition-all duration-300 min-h-screen flex flex-col md:ml-[260px] ${isOpen ? '' : 'ml-0'}`}>
                <header className="sticky top-0 bg-clinical-surface/80 backdrop-blur-xl border-b border-clinical-charcoal/5 z-40 px-4 md:px-6 py-4 flex items-center gap-4 max-w-container-max mx-auto w-full transition-all duration-300">
                    <button onClick={toggleSidebar} className="md:hidden flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-white-container text-clinical-charcoal/70 transition-colors outline-none" title="Sembunyikan / Tampilkan Menu Utama">
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-clinical-charcoal">System Overview</h1>
                        <p className="text-xs md:text-sm font-medium text-clinical-charcoal/60 mt-0.5">
                            Terakhir disinkronisasi: {lastSync ? lastSync.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' }) : 'Menyinkronkan...'}
                        </p>
                    </div>
                </header>

                <div className="px-4 md:px-6 max-w-container-max mx-auto mt-6 space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white border border-clinical-charcoal/5 rounded-[1.5rem] p-5 shadow-sm hover:shadow-md transition-all duration-300">
                            <h3 className="text-sm font-bold text-clinical-charcoal/60 uppercase tracking-wider">Total Patients</h3>
                            <p className="text-3xl font-extrabold text-clinical-charcoal mt-2">{loading ? '...' : (stats?.total_patients ?? '-')}</p>
                        </div>
                        <div className="bg-white border border-clinical-charcoal/5 rounded-[1.5rem] p-5 shadow-sm hover:shadow-md transition-all duration-300">
                            <h3 className="text-sm font-bold text-clinical-charcoal/60 uppercase tracking-wider">Total Doctors</h3>
                            <p className="text-3xl font-extrabold text-clinical-charcoal mt-2">{loading ? '...' : (stats?.total_doctors ?? '-')}</p>
                        </div>
                        <div className="bg-white border border-clinical-charcoal/5 rounded-[1.5rem] p-5 shadow-sm hover:shadow-md transition-all duration-300">
                            <h3 className="text-sm font-bold text-clinical-charcoal/60 uppercase tracking-wider">Active Devices</h3>
                            <p className="text-3xl font-extrabold text-clinical-blue mt-2">{loading ? '...' : (stats?.active_devices ?? '-')}</p>
                        </div>
                        <div className="bg-white border border-alert-red/30 rounded-[1.5rem] p-5 shadow-sm hover:shadow-md transition-all duration-300">
                            <h3 className="text-sm font-bold text-alert-red uppercase tracking-wider">Critical Alerts Today (Frame)</h3>
                            <p className="text-3xl font-extrabold text-alert-red mt-2">{loading ? '...' : (stats?.critical_alerts ?? '-')}</p>
                        </div>
                    </div>



                    {/* Security Settings */}
                    <div className="bg-white border border-clinical-charcoal/5 rounded-[1.5rem] p-6 md:p-8 shadow-sm transition-all duration-300 hover:shadow-md">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-clinical-charcoal">Global DevTools Protection</h2>
                                <p className="text-sm text-clinical-charcoal/60 mt-1">Blocks right-click and DevTools shortcuts to enhance application security.</p>
                            </div>
                            <label className="flex items-center cursor-pointer shrink-0">
                                <div className="relative">
                                    <input type="checkbox" className="sr-only" checked={isDevToolsBlocked} onChange={toggleDevToolsBlocker} />
                                    <div className={`block w-14 h-8 rounded-full transition-colors duration-300 ${isDevToolsBlocked ? 'bg-clinical-blue' : 'bg-clinical-charcoal/20'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full shadow transition-transform duration-300 ${isDevToolsBlocked ? 'transform translate-x-6' : ''}`}></div>
                                </div>
                                <div className="ml-3 text-sm font-bold text-clinical-charcoal w-8">
                                    {isDevToolsBlocked ? 'ON' : 'OFF'}
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
