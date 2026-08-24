import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from '../../components/layout/AdminSidebar';
import { useSidebar } from '../../../application/context/SidebarContext';
import { fetchWithAuth } from '../../../config/api';
import { supabase } from '../../../config/supabaseClient';
import { Pagination } from '../../components/shared/Pagination';
import { useStickyState } from '../../../application/hooks/useStickyState';
import { useCachedFetch } from '../../../application/hooks/useCachedFetch';
import { API_URL } from '../../../config/env';

export const AdminSessionsPage: React.FC = () => {
    const navigate = useNavigate();
    const { isOpen, toggleSidebar } = useSidebar();
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [patientNames, setPatientNames] = useState<Record<string, string>>({});
    const [doctorNames, setDoctorNames] = useState<Record<string, string>>({});
    const [sessionValidations, setSessionValidations] = useState<Record<string, { total: number, validated: number }>>({});
    
    // View States
    const [viewMode, setViewMode] = useStickyState<'all' | 'users'>('all', 'adminSessionsViewMode');
    const [expandedPatientId, setExpandedPatientId] = useStickyState<string | null>(null, 'adminSessionsExpandedPatient');

    // Pagination States
    const [currentPageSessions, setCurrentPageSessions] = useStickyState(1, 'adminSessionsPageAll');
    const [currentPagePatients, setCurrentPagePatients] = useStickyState(1, 'adminSessionsPagePatients');
    const itemsPerPage = 10;

    const { data: allSessionsResponse, isLoading: loadingSessions } = useCachedFetch(viewMode === 'all' ? `/api/sessions?page=${currentPageSessions}&limit=${itemsPerPage}` : null);
    const { data: patientsViewResponse, isLoading: loadingPatients } = useCachedFetch(viewMode === 'users' ? `/api/admin/users?role=pasien&page=${currentPagePatients}&limit=${itemsPerPage}` : null);
    const { data: usersData } = useCachedFetch('/api/admin/users?limit=1000');

    const totalSessions = allSessionsResponse?.pagination?.total || (allSessionsResponse?.data || allSessionsResponse?.sessions || []).length;
    const totalSessionPages = allSessionsResponse?.pagination?.total_pages || Math.ceil(totalSessions / itemsPerPage);
    const patientsViewData = patientsViewResponse?.data || (Array.isArray(patientsViewResponse) ? patientsViewResponse : []);
    const totalPatientsView = patientsViewResponse?.pagination?.total || patientsViewData.length;

    const { data: expandedPatientSessionsResponse } = useCachedFetch(expandedPatientId ? `/api/patients/${expandedPatientId}/sessions` : null);

    // Note Editing States
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editNoteValue, setEditNoteValue] = useState<string>('');
    const [isSubmittingNote, setIsSubmittingNote] = useState(false);
    
    // ECG Paper States
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [uploadingSessionId, setUploadingSessionId] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    const saveNote = async (sessionId: string) => {
        setIsSubmittingNote(true);
        try {
            const { error } = await supabase.from('sessions').update({ dev_note: editNoteValue }).eq('id', sessionId);
            if (!error) {
                setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, dev_note: editNoteValue } : s));
                setEditingNoteId(null);
            } else {
                console.error("Gagal menyimpan note:", error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmittingNote(false);
        }
    };

    const deleteNote = async (sessionId: string) => {
        setIsSubmittingNote(true);
        try {
            const { error } = await supabase.from('sessions').update({ dev_note: null }).eq('id', sessionId);
            if (!error) {
                setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, dev_note: null } : s));
                setEditingNoteId(null);
            } else {
                console.error("Gagal menghapus note:", error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmittingNote(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !uploadingSessionId) return;
        const file = e.target.files[0];
        setPreviewFile(file);
        if (previewUrl && previewFile) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const submitUpload = async () => {
        if (!previewFile || !uploadingSessionId) return;
        const formData = new FormData();
        formData.append('paper', previewFile);

        try {
            const res = await fetchWithAuth(`/api/sessions/${uploadingSessionId}/ecg_paper`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                setSessions(prev => prev.map(s => s.id === uploadingSessionId ? { ...s, ecg_paper: data.path } : s));
                cancelUpload();
            } else {
                alert("Gagal mengunggah foto: " + data.message);
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert("Terjadi kesalahan saat mengunggah foto.");
        }
    };

    const cancelUpload = () => {
        if (previewUrl && previewFile) URL.revokeObjectURL(previewUrl);
        setPreviewFile(null);
        setPreviewUrl(null);
        setUploadingSessionId(null);
        setIsEditMode(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const deleteUpload = async () => {
        if (!uploadingSessionId) return;
        if (!confirm("Apakah Anda yakin ingin menghapus foto EKG ini?")) return;
        try {
            const res = await fetchWithAuth(`/api/sessions/${uploadingSessionId}/ecg_paper`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                setSessions(prev => prev.map(s => s.id === uploadingSessionId ? { ...s, ecg_paper: null } : s));
                cancelUpload();
            } else {
                alert("Gagal menghapus foto: " + data.message);
            }
        } catch (err) {
            console.error("Delete error:", err);
            alert("Terjadi kesalahan saat menghapus foto.");
        }
    };

    const triggerUpload = (sessionId: string) => {
        setUploadingSessionId(sessionId);
        if (fileInputRef.current) fileInputRef.current.click();
    };

    useEffect(() => {
        if (usersData) {
            const users = usersData.data || (Array.isArray(usersData) ? usersData : []);
            const pNames: Record<string, string> = {};
            const dNames: Record<string, string> = {};
            users.forEach((u: any) => {
                if (u.role === 'pasien') pNames[u.id] = u.name;
                if (u.role === 'dokter') dNames[u.id] = u.name;
            });
            setPatientNames(pNames);
            setDoctorNames(dNames);
        }
    }, [usersData]);

    useEffect(() => {
        if (viewMode === 'all' && allSessionsResponse) {
            const fetchedSessions = allSessionsResponse.data || allSessionsResponse.sessions || (Array.isArray(allSessionsResponse) ? allSessionsResponse : []);
            setSessions(fetchedSessions); // Tampilkan secara instan tanpa delay Supabase
            
            const sessionIds = fetchedSessions.map((s: any) => s.id);
            if (sessionIds.length > 0) {
                supabase.rpc('get_sessions_validation_counts', { session_ids: sessionIds })
                    .then(({ data: stats, error }) => {
                        if (!error && stats) {
                            const counts: Record<string, { total: number, validated: number }> = {};
                            sessionIds.forEach((id: string) => counts[id] = { total: 0, validated: 0 });
                            stats.forEach((st: any) => {
                                counts[st.session_id] = { total: Number(st.total_frames) || 0, validated: Number(st.validated_frames) || 0 };
                            });
                            setSessionValidations(counts);
                        }
                    });
                    
                supabase.from('sessions').select('id, dev_note').in('id', sessionIds)
                    .then(({ data: notesData, error: notesError }) => {
                        if (!notesError && notesData) {
                            setSessions(fetchedSessions.map((s: any) => {
                                const noteObj = notesData.find(n => n.id === s.id);
                                return { ...s, dev_note: noteObj?.dev_note || s.dev_note || null };
                            }));
                        } else {
                            setSessions(fetchedSessions);
                        }
                    });
            } else {
                setSessions([]);
            }
        }
    }, [viewMode, currentPageSessions, currentPagePatients, allSessionsResponse]);

    useEffect(() => {
        setLoading(viewMode === 'all' ? loadingSessions : loadingPatients);
    }, [viewMode, loadingSessions, loadingPatients]);

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

    // Grouping by Patient
    const patientsMap = new Map<string, { id: string, name: string, totalSessions: number, lastSessionDate: string }>();
    const sortedSessions = [...sessions].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    
    sortedSessions.forEach(session => {
        const pId = session.patient_id;
        if (!patientsMap.has(pId)) {
            patientsMap.set(pId, {
                id: pId,
                name: patientNames[pId] || pId || 'Unknown',
                totalSessions: 0,
                lastSessionDate: session.started_at
            });
        }
        const pData = patientsMap.get(pId)!;
        pData.totalSessions++;
    });
    
    const patientsList = Array.from(patientsMap.values()).sort((a, b) => new Date(b.lastSessionDate).getTime() - new Date(a.lastSessionDate).getTime());

    const displayedSessions = sortedSessions;

    const renderSessionsTable = (sessionList: any[], isMiniTable: boolean = false) => {
        const totalItems = totalSessions;
        const paginatedSessions = isMiniTable ? sessionList : sessionList;

        return (
        <div className={`flex flex-col w-full ${isMiniTable ? 'border border-outline-variant/50 rounded-xl overflow-hidden' : ''}`}>
            <div className="overflow-x-auto w-full">
                <table className={`w-full text-sm text-left ${isMiniTable ? 'bg-surface' : ''}`}>
                    <thead className="text-xs text-on-surface-variant uppercase bg-surface-container-lowest border-b border-outline-variant">
                        <tr>
                            <th className="px-6 py-4 font-bold tracking-wider">Pasien</th>
                            <th className="px-6 py-4 font-bold tracking-wider">Session ID</th>
                            <th className="px-6 py-4 font-bold tracking-wider">Waktu Mulai</th>
                            <th className="px-6 py-4 font-bold tracking-wider min-w-[250px]">Catatan</th>
                            <th className="px-6 py-4 font-bold tracking-wider text-center">Progress Validasi</th>
                            <th className="px-6 py-4 font-bold tracking-wider text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/50">
                        {paginatedSessions.map((session) => {
                        const patientName = patientNames[session.patient_id] || session.patient_id || 'Unknown';
                        const doctorName = doctorNames[session.doctor_id] || session.doctor_id || 'Unknown';

                        const validation = sessionValidations[session.id] || { total: 0, validated: 0 };
                        let validationStatus = "Belum Divalidasi";
                        let validationClass = "bg-surface-variant/50 text-on-surface-variant";
                        
                        if (validation.total > 0) {
                            if (validation.validated === validation.total) {
                                validationStatus = "Sudah Divalidasi";
                                validationClass = "bg-signal-green/20 text-signal-green";
                            } else if (validation.validated > 0) {
                                const percentage = Math.round((validation.validated / validation.total) * 100);
                                validationStatus = `Tervalidasi ${percentage}%`;
                                validationClass = "bg-brand-navy/10 text-brand-navy";
                            }
                        }

                        return (
                            <tr key={session.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-charcoal">{patientName}</div>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-on-surface-variant whitespace-nowrap">
                                    {session.id.substring(0, 15)}
                                </td>
                                <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">
                                    {formatDate(session.started_at)}
                                </td>
                                <td className="px-6 py-4">
                                    {editingNoteId === session.id ? (
                                        <div className="flex flex-col gap-2 w-full min-w-[200px]">
                                            <textarea 
                                                value={editNoteValue}
                                                onChange={(e) => setEditNoteValue(e.target.value)}
                                                className="w-full text-xs p-2 border border-outline-variant rounded-md focus:outline-none focus:ring-1 focus:ring-clinical-blue"
                                                placeholder="Tulis catatan di sini..."
                                                rows={2}
                                            />
                                            <div className="flex gap-1.5 justify-end">
                                                <button 
                                                    onClick={() => setEditingNoteId(null)}
                                                    className="px-2 py-1 text-[10px] font-bold text-on-surface-variant hover:bg-surface-variant/30 rounded"
                                                    disabled={isSubmittingNote}
                                                >
                                                    Batal
                                                </button>
                                                {session.dev_note && (
                                                    <button 
                                                        onClick={() => deleteNote(session.id)}
                                                        className="px-2 py-1 text-[10px] font-bold text-white bg-alert-red hover:bg-alert-red/90 rounded"
                                                        disabled={isSubmittingNote}
                                                    >
                                                        Hapus
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => saveNote(session.id)}
                                                    className="px-2 py-1 text-[10px] font-bold text-white bg-clinical-blue hover:bg-clinical-blue/90 rounded"
                                                    disabled={isSubmittingNote}
                                                >
                                                    {isSubmittingNote ? "Menyimpan..." : "Simpan"}
                                                </button>
                                            </div>
                                        </div>
                                    ) : session.dev_note ? (
                                        <div className="flex items-start justify-between gap-2 max-w-[200px]">
                                            <p className="text-xs text-charcoal italic line-clamp-2">"{session.dev_note}"</p>
                                            <button 
                                                onClick={() => { setEditNoteValue(session.dev_note); setEditingNoteId(session.id); }}
                                                className="text-clinical-blue hover:text-clinical-blue/80 p-1"
                                                title="Edit Catatan"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">edit</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => { setEditNoteValue(''); setEditingNoteId(session.id); }}
                                            className="text-[10px] font-bold text-clinical-blue border border-clinical-blue/30 px-2 py-1 rounded-md hover:bg-clinical-blue/5 transition-colors flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-[12px]">add</span>
                                            Tambahkan Note
                                        </button>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${validationClass}`}>
                                        {validationStatus}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end items-center gap-2">
                                        {session.ecg_paper ? (
                                            <>
                                                <button onClick={() => setPreviewImage(API_URL + session.ecg_paper)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-clinical-blue text-white hover:opacity-90 rounded-lg text-xs font-bold transition-colors shadow-sm">
                                                    Lihat Foto
                                                    <span className="material-symbols-outlined text-[14px]">image</span>
                                                </button>
                                                <button onClick={() => { setUploadingSessionId(session.id); setIsEditMode(true); setPreviewUrl(API_URL + session.ecg_paper); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white hover:opacity-90 rounded-lg text-xs font-bold transition-colors shadow-sm">
                                                    Edit Foto
                                                    <span className="material-symbols-outlined text-[14px]">edit</span>
                                                </button>
                                            </>
                                        ) : (
                                            <button onClick={() => triggerUpload(session.id)} disabled={uploadingSessionId === session.id && !previewUrl} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-clinical-charcoal/5 text-clinical-charcoal hover:bg-clinical-charcoal/10 rounded-lg text-xs font-bold transition-colors shadow-sm">
                                                {uploadingSessionId === session.id && !previewUrl ? "Memproses..." : "Unggah Foto"}
                                                <span className="material-symbols-outlined text-[14px]">upload</span>
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => navigate(`/admin/analytics?sessionId=${session.id}`)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-navy text-white hover:bg-brand-navy/90 rounded-lg text-xs font-bold transition-colors shadow-sm"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                                            Detail
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            </div>
            {!isMiniTable && (
                <Pagination 
                    currentPage={currentPageSessions}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPageSessions}
                />
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            {previewImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-clinical-charcoal/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col">
                        <h3 className="font-bold font-display text-xl text-clinical-charcoal mb-4">
                            Lihat Foto EKG
                        </h3>
                        <div className="flex-grow overflow-auto rounded-xl border border-clinical-charcoal/10 bg-clinical-surface/50 p-2 mb-6">
                            <img src={previewImage} alt="ECG Paper" className="w-full h-auto rounded-lg object-contain" />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 justify-end">
                            <button onClick={() => window.open(previewImage, '_blank')} className="py-3 px-6 rounded-full bg-clinical-charcoal/5 text-clinical-charcoal font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-charcoal/10 active:scale-95 transition-all outline-none">
                                Buka di Tab Lain
                            </button>
                            <button onClick={() => {
                                fetch(previewImage)
                                    .then(r => r.blob())
                                    .then(blob => {
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `ecg_paper.jpg`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    })
                                    .catch(() => window.open(previewImage, '_blank'));
                            }} className="py-3 px-6 rounded-full bg-clinical-blue/10 text-clinical-blue font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-blue hover:text-white active:scale-95 transition-all outline-none">
                                Download
                            </button>
                            <button onClick={() => setPreviewImage(null)} className="py-3 px-6 rounded-full bg-clinical-blue text-white font-bold text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all outline-none">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {uploadingSessionId && previewUrl && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-clinical-charcoal/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col">
                        <h3 className="font-bold font-display text-xl text-clinical-charcoal mb-4">
                            {isEditMode ? "Edit Foto EKG" : "Pratinjau Foto EKG"}
                        </h3>
                        <div className="flex-grow overflow-auto rounded-xl border border-clinical-charcoal/10 bg-clinical-surface/50 p-2 mb-6">
                            <img src={previewUrl} alt="Preview ECG" className="w-full h-auto rounded-lg object-contain" />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 justify-end">
                            <button onClick={cancelUpload} className="py-3 px-6 rounded-full bg-clinical-charcoal/5 text-clinical-charcoal font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-charcoal/10 active:scale-95 transition-all outline-none">
                                Batal
                            </button>
                            {isEditMode && !previewFile && (
                                <button onClick={deleteUpload} className="py-3 px-6 rounded-full bg-clinical-red/10 text-clinical-red font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-red hover:text-white active:scale-95 transition-all outline-none">
                                    Hapus
                                </button>
                            )}
                            <button onClick={() => { if (fileInputRef.current) fileInputRef.current.click(); }} className="py-3 px-6 rounded-full bg-clinical-blue/10 text-clinical-blue font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-blue hover:text-white active:scale-95 transition-all outline-none">
                                Pilih Gambar Lain
                            </button>
                            {previewFile && (
                                <button onClick={submitUpload} className="py-3 px-6 rounded-full bg-clinical-blue text-white font-bold text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all outline-none">
                                    Submit
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

    const renderPatientsTable = () => {
        const totalItems = totalPatientsView;
        const paginatedPatients = patientsViewData;

        return (
        <div className="flex flex-col w-full">
            <div className="overflow-x-auto w-full">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-on-surface-variant uppercase bg-surface-container-lowest border-b border-outline-variant">
                        <tr>
                            <th className="px-6 py-4 font-bold tracking-wider">Nama Pasien</th>
                            <th className="px-6 py-4 font-bold tracking-wider">Patient ID</th>
                            <th className="px-6 py-4 font-bold tracking-wider text-center">Total Sesi</th>
                            <th className="px-6 py-4 font-bold tracking-wider">Sesi Terakhir</th>
                            <th className="px-6 py-4 font-bold tracking-wider text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/50">
                        {paginatedPatients.map((patient: any) => (
                            <React.Fragment key={patient.id}>
                                <tr className="hover:bg-surface-container-lowest/50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-charcoal">
                                        {patient.name}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs text-on-surface-variant font-mono truncate max-w-[150px] inline-block">{patient.id}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-xs text-on-surface-variant italic">
                                            Buka Sesi
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-on-surface-variant">
                                        <span className="text-xs italic">
                                            {formatDate(patient.registered_at)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => {
                                                const newId = expandedPatientId === patient.id ? null : patient.id;
                                                setExpandedPatientId(newId);
                                            }}
                                            className="inline-flex items-center gap-1 bg-surface-variant/50 hover:bg-surface-variant text-charcoal px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                        >
                                            <span>{expandedPatientId === patient.id ? 'Tutup' : 'Lihat Sesi'}</span>
                                            <span className={`material-symbols-outlined text-[16px] transition-transform ${expandedPatientId === patient.id ? 'rotate-180' : ''}`}>expand_more</span>
                                        </button>
                                    </td>
                                </tr>
                                {expandedPatientId === patient.id && (
                                    <tr className="bg-surface-container-lowest">
                                        <td colSpan={5} className="p-0 border-b border-outline-variant/50">
                                            <div className="p-4 md:p-6 border-l-4 border-clinical-blue bg-white">
                                                <h4 className="text-sm font-bold mb-4 text-brand-navy flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[18px]">history</span>
                                                    Daftar Rekaman Sesi: {patient.name}
                                                </h4>
                                                {renderSessionsTable(expandedPatientId === patient.id ? (expandedPatientSessionsResponse?.data || expandedPatientSessionsResponse?.sessions || (Array.isArray(expandedPatientSessionsResponse) ? expandedPatientSessionsResponse : [])) : [], true)}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination 
                currentPage={currentPagePatients}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPagePatients}
            />
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            {previewImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-clinical-charcoal/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col">
                        <h3 className="font-bold font-display text-xl text-clinical-charcoal mb-4">
                            Lihat Foto EKG
                        </h3>
                        <div className="flex-grow overflow-auto rounded-xl border border-clinical-charcoal/10 bg-clinical-surface/50 p-2 mb-6">
                            <img src={previewImage} alt="ECG Paper" className="w-full h-auto rounded-lg object-contain" />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 justify-end">
                            <button onClick={() => window.open(previewImage, '_blank')} className="py-3 px-6 rounded-full bg-clinical-charcoal/5 text-clinical-charcoal font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-charcoal/10 active:scale-95 transition-all outline-none">
                                Buka di Tab Lain
                            </button>
                            <button onClick={() => {
                                fetch(previewImage)
                                    .then(r => r.blob())
                                    .then(blob => {
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `ecg_paper.jpg`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    })
                                    .catch(() => window.open(previewImage, '_blank'));
                            }} className="py-3 px-6 rounded-full bg-clinical-blue/10 text-clinical-blue font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-blue hover:text-white active:scale-95 transition-all outline-none">
                                Download
                            </button>
                            <button onClick={() => setPreviewImage(null)} className="py-3 px-6 rounded-full bg-clinical-blue text-white font-bold text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all outline-none">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {uploadingSessionId && previewUrl && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-clinical-charcoal/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col">
                        <h3 className="font-bold font-display text-xl text-clinical-charcoal mb-4">
                            {isEditMode ? "Edit Foto EKG" : "Pratinjau Foto EKG"}
                        </h3>
                        <div className="flex-grow overflow-auto rounded-xl border border-clinical-charcoal/10 bg-clinical-surface/50 p-2 mb-6">
                            <img src={previewUrl} alt="Preview ECG" className="w-full h-auto rounded-lg object-contain" />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 justify-end">
                            <button onClick={cancelUpload} className="py-3 px-6 rounded-full bg-clinical-charcoal/5 text-clinical-charcoal font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-charcoal/10 active:scale-95 transition-all outline-none">
                                Batal
                            </button>
                            {isEditMode && !previewFile && (
                                <button onClick={deleteUpload} className="py-3 px-6 rounded-full bg-clinical-red/10 text-clinical-red font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-red hover:text-white active:scale-95 transition-all outline-none">
                                    Hapus
                                </button>
                            )}
                            <button onClick={() => { if (fileInputRef.current) fileInputRef.current.click(); }} className="py-3 px-6 rounded-full bg-clinical-blue/10 text-clinical-blue font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-blue hover:text-white active:scale-95 transition-all outline-none">
                                Pilih Gambar Lain
                            </button>
                            {previewFile && (
                                <button onClick={submitUpload} className="py-3 px-6 rounded-full bg-clinical-blue text-white font-bold text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all outline-none">
                                    Submit
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

    return (
        <div className="bg-clinical-surface text-clinical-charcoal antialiased overflow-x-hidden w-full min-h-screen relative font-sans">
            <div className="absolute inset-0 ecg-grid opacity-10 pointer-events-none z-0"></div>
            <AdminSidebar />

            <main className={`flex flex-col transition-all duration-300 min-h-screen pb-12 w-full relative z-10 md:ml-[260px] md:w-[calc(100%-260px)] ${isOpen ? '' : 'ml-0'}`}>
                {/* Header */}
                <header className="sticky top-0 bg-clinical-surface/80 backdrop-blur-xl border-b border-clinical-charcoal/5 z-40 px-4 md:px-6 py-4 flex justify-between items-center w-full transition-all duration-300">
                    <div className="flex items-center gap-3">
                        <button onClick={toggleSidebar} className="md:hidden flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-white-container text-clinical-charcoal/70 transition-colors outline-none" title="Sembunyikan / Tampilkan Menu Utama">
                            <span className="material-symbols-outlined">menu</span>
                        </button>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-clinical-charcoal">Manajemen Sesi</h1>
                            <p className="text-xs md:text-sm font-medium text-clinical-charcoal/60 mt-0.5">Sistem Pemantauan Seluruh Rekaman</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 px-4 md:px-6 max-w-container-max mx-auto mt-6 w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
                    
                    <div className="bg-white rounded-[2rem] border border-clinical-charcoal/5 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow duration-500">
                        <div className="px-6 py-6 border-b border-clinical-charcoal/5 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/50 backdrop-blur-sm gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto">
                                <h2 className="text-lg font-bold text-clinical-charcoal">
                                    Daftar Rekaman
                                </h2>
                                <div className="relative">
                                    <select
                                        value={viewMode}
                                        onChange={(e) => {
                                            setViewMode(e.target.value as 'all' | 'users');
                                            setExpandedPatientId(null);
                                            if (e.target.value === 'all') setCurrentPageSessions(1);
                                            else setCurrentPagePatients(1);
                                        }}
                                        className="bg-white border border-clinical-charcoal/10 text-clinical-charcoal text-sm font-bold rounded-xl pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-clinical-blue/50 cursor-pointer appearance-none shadow-sm hover:border-clinical-blue/50 transition-colors w-full sm:w-auto"
                                    >
                                        <option value="all">Semua Rekaman</option>
                                        <option value="users">Kelompokkan Berdasarkan Pasien</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-clinical-charcoal/50 text-[20px]">
                                        expand_more
                                    </span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <div className="text-xs font-bold text-clinical-charcoal/70 bg-clinical-surface px-4 py-2 rounded-xl">
                                    Total: <span className="text-clinical-blue">{viewMode === 'users' ? totalPatientsView : sessions.length}</span> {viewMode === 'users' ? 'Pasien' : 'Sesi'}
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center text-clinical-charcoal/50 font-medium">Memuat data {viewMode === 'users' ? 'pasien' : 'sesi'}...</div>
                        ) : (viewMode === 'users' ? patientsViewData.length === 0 : sessions.length === 0) ? (
                            <div className="p-12 text-center text-clinical-charcoal/50 font-medium">Belum ada data {viewMode === 'users' ? 'pasien' : 'sesi rekaman EKG'}.</div>
                        ) : (
                            viewMode === 'users' 
                                ? renderPatientsTable() 
                                : renderSessionsTable(sessions)
                        )}
                    </div>
                </div>
            </main>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            {previewImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-clinical-charcoal/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col">
                        <h3 className="font-bold font-display text-xl text-clinical-charcoal mb-4">
                            Lihat Foto EKG
                        </h3>
                        <div className="flex-grow overflow-auto rounded-xl border border-clinical-charcoal/10 bg-clinical-surface/50 p-2 mb-6">
                            <img src={previewImage} alt="ECG Paper" className="w-full h-auto rounded-lg object-contain" />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 justify-end">
                            <button onClick={() => window.open(previewImage, '_blank')} className="py-3 px-6 rounded-full bg-clinical-charcoal/5 text-clinical-charcoal font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-charcoal/10 active:scale-95 transition-all outline-none">
                                Buka di Tab Lain
                            </button>
                            <button onClick={() => {
                                fetch(previewImage)
                                    .then(r => r.blob())
                                    .then(blob => {
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `ecg_paper.jpg`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    })
                                    .catch(() => window.open(previewImage, '_blank'));
                            }} className="py-3 px-6 rounded-full bg-clinical-blue/10 text-clinical-blue font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-blue hover:text-white active:scale-95 transition-all outline-none">
                                Download
                            </button>
                            <button onClick={() => setPreviewImage(null)} className="py-3 px-6 rounded-full bg-clinical-blue text-white font-bold text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all outline-none">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {uploadingSessionId && previewUrl && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-clinical-charcoal/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col">
                        <h3 className="font-bold font-display text-xl text-clinical-charcoal mb-4">
                            {isEditMode ? "Edit Foto EKG" : "Pratinjau Foto EKG"}
                        </h3>
                        <div className="flex-grow overflow-auto rounded-xl border border-clinical-charcoal/10 bg-clinical-surface/50 p-2 mb-6">
                            <img src={previewUrl} alt="Preview ECG" className="w-full h-auto rounded-lg object-contain" />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 justify-end">
                            <button onClick={cancelUpload} className="py-3 px-6 rounded-full bg-clinical-charcoal/5 text-clinical-charcoal font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-charcoal/10 active:scale-95 transition-all outline-none">
                                Batal
                            </button>
                            {isEditMode && !previewFile && (
                                <button onClick={deleteUpload} className="py-3 px-6 rounded-full bg-clinical-red/10 text-clinical-red font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-red hover:text-white active:scale-95 transition-all outline-none">
                                    Hapus
                                </button>
                            )}
                            <button onClick={() => { if (fileInputRef.current) fileInputRef.current.click(); }} className="py-3 px-6 rounded-full bg-clinical-blue/10 text-clinical-blue font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-blue hover:text-white active:scale-95 transition-all outline-none">
                                Pilih Gambar Lain
                            </button>
                            {previewFile && (
                                <button onClick={submitUpload} className="py-3 px-6 rounded-full bg-clinical-blue text-white font-bold text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all outline-none">
                                    Submit
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
