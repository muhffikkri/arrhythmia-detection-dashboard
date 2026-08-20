import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { AdminSidebar } from '../../components/layout/AdminSidebar';
import { useSidebar } from '../../../application/context/SidebarContext';
import { Pagination } from '../../components/shared/Pagination';
import { useStickyState } from '../../../application/hooks/useStickyState';
import { API_URL } from '../../../config/env';
import { fetchWithAuth } from '../../../config/api';
import { useCachedFetch } from '../../../application/hooks/useCachedFetch';

interface DeviceRecord {
    id: string;
    name: string;
    mqtt_broker: string;
    mqtt_port: number;
    mqtt_topic: string;
    mqtt_username: string;
    assigned_to: string | null;
}

export const AdminDevicesPage: React.FC = () => {
    const { isOpen, toggleSidebar } = useSidebar();
    const { data: devicesData, isLoading: loading, mutate: mutateDevices } = useCachedFetch('/api/admin/devices');
    const devices: DeviceRecord[] = devicesData || [];
    const [selectedDeviceQr, setSelectedDeviceQr] = useState<string | null>(null);

    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        mqtt_broker: '',
        mqtt_port: 1883,
        mqtt_topic: '',
        mqtt_username: '',
        mqtt_password: ''
    });

    const [currentPage, setCurrentPage] = useStickyState(1, 'adminDevicesPage');
    const itemsPerPage = 10;

    // Fetching is handled by SWR

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('auth_token');
            const url = editingDeviceId ? `/api/admin/devices/${editingDeviceId}` : `/api/admin/devices`;
            const method = editingDeviceId ? 'PUT' : 'POST';
            
            const res = await fetchWithAuth(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                alert("Device registered successfully!");
                setIsRegisterModalOpen(false);
                mutateDevices();
            } else {
                alert("Gagal: " + (data.message || data.error || JSON.stringify(data)));
            }
        } catch (err) {
            console.error(err);
            alert("Terjadi kesalahan jaringan.");
        }
    };

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
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-clinical-charcoal">Armada Perangkat (IoT Devices)</h1>
                        <p className="text-xs md:text-sm font-medium text-clinical-charcoal/60 mt-0.5">Pemantauan armada perangkat keras yang terhubung ke jaringan.</p>
                    </div>
                </header>

                <div className="px-4 md:px-6 max-w-container-max mx-auto mt-6 w-full flex-1 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
                    <div className="bg-white border border-clinical-charcoal/5 rounded-[2rem] shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-500">
                        <div className="p-6 border-b border-clinical-charcoal/5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white/50 backdrop-blur-sm">
                            <h2 className="font-bold text-clinical-charcoal text-lg">Daftar Perangkat</h2>
                            <button onClick={() => {
                                setEditingDeviceId(null);
                                setFormData({
                                    name: '', mqtt_broker: '', mqtt_port: 8883,
                                    mqtt_topic: '', mqtt_username: '', mqtt_password: ''
                                });
                                setIsRegisterModalOpen(true);
                            }} className="bg-clinical-blue text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-md hover:shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">add</span> Register Alat Baru
                            </button>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-clinical-surface/50 text-clinical-charcoal/60 text-[10px] uppercase tracking-wider font-bold">
                                        <th className="p-4 border-b border-clinical-charcoal/5">Device ID</th>
                                        <th className="p-4 border-b border-clinical-charcoal/5">Device Name</th>
                                        <th className="p-4 border-b border-clinical-charcoal/5">MQTT Broker</th>
                                        <th className="p-4 border-b border-clinical-charcoal/5">MQTT Topic</th>
                                        <th className="p-4 border-b border-clinical-charcoal/5">Assigned To</th>
                                        <th className="p-4 border-b border-clinical-charcoal/5">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={6} className="p-4 text-center">Loading...</td></tr>
                                    ) : (() => {
                                        const paginatedDevices = devices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                                        return paginatedDevices.map(d => (
                                        <tr key={d.id} className="hover:bg-clinical-surface/50 transition-colors border-b border-clinical-charcoal/5 last:border-0 group">
                                            <td className="p-4 font-mono text-xs text-clinical-blue font-bold">{d.id}</td>
                                            <td className="p-4 font-bold text-sm text-clinical-charcoal">{d.name}</td>
                                            <td className="p-4 font-mono text-xs text-clinical-charcoal/70">{d.mqtt_broker}:{d.mqtt_port}</td>
                                            <td className="p-4 font-mono text-xs text-clinical-charcoal/70"><span className="bg-clinical-surface px-2 py-1 rounded-md">{d.mqtt_topic}</span></td>
                                            <td className="p-4 text-xs font-mono text-clinical-charcoal/70">{d.assigned_to || 'Unassigned'}</td>
                                            <td className="p-4 flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <button onClick={() => setSelectedDeviceQr(d.name || d.id)} className="text-clinical-blue hover:text-clinical-charcoal text-xs font-bold flex items-center gap-1 transition-colors" title="Tampilkan QR">
                                                    <span className="material-symbols-outlined text-[18px]">qr_code</span>
                                                </button>
                                                <button className="text-clinical-charcoal hover:text-clinical-blue text-xs font-bold transition-colors" title="Ping">
                                                    <span className="material-symbols-outlined text-[18px]">wifi</span>
                                                </button>
                                                <button onClick={() => {
                                                    setEditingDeviceId(d.id);
                                                    setFormData({
                                                        name: d.name,
                                                        mqtt_broker: d.mqtt_broker,
                                                        mqtt_port: d.mqtt_port,
                                                        mqtt_topic: d.mqtt_topic,
                                                        mqtt_username: d.mqtt_username,
                                                        mqtt_password: ''
                                                    });
                                                    setIsRegisterModalOpen(true);
                                                }} className="text-clinical-charcoal hover:text-clinical-blue text-xs font-bold flex items-center gap-1 transition-colors" title="Edit">
                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                </button>
                                            </td>
                                        </tr>
                                        ));
                                    })()}
                                </tbody>
                            </table>
                        </div>
                        {devices.length > 0 && (
                            <Pagination 
                                currentPage={currentPage}
                                totalItems={devices.length}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                            />
                        )}
                    </div>
                </div>
            </main>

            {/* QR Code Modal */}
            {selectedDeviceQr && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 text-center shadow-2xl flex flex-col items-center">
                        <h3 className="text-2xl font-bold text-charcoal mb-2">QR Code Alat</h3>
                        <p className="text-sm text-on-surface-variant mb-6">Minta pasien memindai QR Code ini untuk terhubung dengan alat.</p>
                        
                        <div className="bg-white p-4 rounded-xl border-4 border-medical-teal/20 mb-6">
                            <QRCode 
                                value={JSON.stringify({ type: 'device_sync', deviceId: selectedDeviceQr })} 
                                size={200}
                                level="H"
                            />
                        </div>

                        <div className="bg-surface-container-low rounded-lg p-3 w-full mb-6 flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Device ID</span>
                            <span className="font-mono text-lg font-bold text-charcoal">{selectedDeviceQr}</span>
                        </div>

                        <button onClick={() => setSelectedDeviceQr(null)} className="w-full bg-medical-teal text-white py-3 rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all">
                            Tutup
                        </button>
                    </div>
                </div>
            )}

            {/* Registration Modal */}
            {isRegisterModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-[2rem] p-8 shadow-2xl flex flex-col">
                        <h3 className="text-2xl font-bold text-charcoal mb-6 text-center">{editingDeviceId ? 'Edit Alat' : 'Registrasi Alat Baru'}</h3>
                        <form onSubmit={handleRegister} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-bold text-charcoal mb-1">Nama Perangkat (ID)*</label>
                                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-outline-variant rounded-lg p-3 outline-none focus:border-medical-teal bg-surface-container-lowest" placeholder="Contoh: device02" />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-bold text-charcoal mb-1">MQTT Broker*</label>
                                    <input required type="text" value={formData.mqtt_broker} onChange={e => setFormData({...formData, mqtt_broker: e.target.value})} className="w-full border border-outline-variant rounded-lg p-3 outline-none focus:border-medical-teal bg-surface-container-lowest" placeholder="contoh.hivemq.cloud" />
                                </div>
                                <div className="w-24">
                                    <label className="block text-sm font-bold text-charcoal mb-1">Port*</label>
                                    <input required type="number" value={formData.mqtt_port} onChange={e => setFormData({...formData, mqtt_port: parseInt(e.target.value)})} className="w-full border border-outline-variant rounded-lg p-3 outline-none focus:border-medical-teal bg-surface-container-lowest" placeholder="8883" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-charcoal mb-1">MQTT Topic*</label>
                                <input required type="text" value={formData.mqtt_topic} onChange={e => setFormData({...formData, mqtt_topic: e.target.value})} className="w-full border border-outline-variant rounded-lg p-3 outline-none focus:border-medical-teal bg-surface-container-lowest" placeholder="Contoh: ecgrhythmia/#" />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-bold text-charcoal mb-1">Username*</label>
                                    <input required type="text" value={formData.mqtt_username} onChange={e => setFormData({...formData, mqtt_username: e.target.value})} className="w-full border border-outline-variant rounded-lg p-3 outline-none focus:border-medical-teal bg-surface-container-lowest" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-bold text-charcoal mb-1">Password*</label>
                                    <input required type="password" value={formData.mqtt_password} onChange={e => setFormData({...formData, mqtt_password: e.target.value})} className="w-full border border-outline-variant rounded-lg p-3 outline-none focus:border-medical-teal bg-surface-container-lowest" />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button type="button" onClick={() => setIsRegisterModalOpen(false)} className="flex-1 py-3 font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors">
                                    Batal
                                </button>
                                <button type="submit" className="flex-1 py-3 bg-medical-teal text-white font-bold rounded-xl shadow-sm hover:brightness-110 active:scale-95 transition-all">
                                    Simpan & Pairing
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
