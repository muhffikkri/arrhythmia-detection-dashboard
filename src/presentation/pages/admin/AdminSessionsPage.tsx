import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from '../../components/layout/AdminSidebar';
import { useSidebar } from '../../../application/context/SidebarContext';
import { fetchWithAuth } from '../../../config/api';
import { supabase, isSupabaseConfigured } from '../../../config/supabaseClient';
import { Pagination } from '../../components/shared/Pagination';
import { useStickyState } from '../../../application/hooks/useStickyState';
import { useCachedFetch } from '../../../application/hooks/useCachedFetch';
import { API_URL } from '../../../config/env';

export const AdminSessionsPage: React.FC = () => {
    const navigate = useNavigate();
    const { isOpen, toggleSidebar, isCollapsed } = useSidebar();
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

    const { data: allSessionsResponse, isLoading: loadingSessions, mutate: mutateSessions } = useCachedFetch(viewMode === 'all' ? `/api/sessions?page=${currentPageSessions}&limit=${itemsPerPage}` : null);
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

    // Sync Databases States & Auto-sync Effect
    const [isSyncing, setIsSyncing] = useState<boolean>(false);

    const handleSyncDatabases = async () => {
        setIsSyncing(true);
        try {
            const res = await fetchWithAuth('/api/admin/sync', {
                method: 'POST'
            });
            const data = await res.json().catch(() => ({ success: false, message: 'Parse JSON error' }));
            if (res.ok || data.success) {
                alert("Sinkronisasi database SQLite (database.db) dan Supabase berhasil diselesaikan!");
                mutateSessions();
            } else {
                alert("Sinkronisasi gagal: " + (data.message || "Endpoint sinkronisasi tidak merespons sukses"));
            }
        } catch (err: any) {
            console.error(err);
            alert("Terjadi kesalahan koneksi saat menjalankan sinkronisasi: " + err.message);
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        const lastSync = localStorage.getItem('LAST_DB_SYNC_TIME');
        const now = Date.now();
        const TEN_HOURS_MS = 10 * 60 * 60 * 1000;
        
        if (!lastSync || now - Number(lastSync) > TEN_HOURS_MS) {
            console.log("Menjalankan sinkronisasi database otomatis (10 jam)...");
            fetchWithAuth('/api/admin/sync', { method: 'POST' })
                .then(res => {
                    if (res.ok) {
                        localStorage.setItem('LAST_DB_SYNC_TIME', String(now));
                        console.log("Sinkronisasi otomatis berhasil disimpan.");
                    }
                })
                .catch(err => console.error("Sinkronisasi otomatis gagal:", err));
        }
    }, []);

    // Add/Create Session States
    const [showAddModal, setShowAddModal] = useState<boolean>(false);
    const [selectedPatientId, setSelectedPatientId] = useState<string>('');
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
    const [newSessionId, setNewSessionId] = useState<string>('');
    const [startedAt, setStartedAt] = useState<string>('');
    const [newDevNote, setNewDevNote] = useState<string>('');
    const [framesToUpload, setFramesToUpload] = useState<Array<{ id: number, jsonFile: File | null, csvFile: File | null }>>([
        { id: 1, jsonFile: null, csvFile: null }
    ]);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [uploadProgress, setUploadProgress] = useState<string>('');

    // Edit Session States
    const [showEditModal, setShowEditModal] = useState<boolean>(false);
    const [editingSession, setEditingSession] = useState<any | null>(null);
    const [editPatientId, setEditPatientId] = useState<string>('');
    const [editDoctorId, setEditDoctorId] = useState<string>('');
    const [editStartedAt, setEditStartedAt] = useState<string>('');
    const [editDevNote, setEditDevNote] = useState<string>('');
    const [sessionFrames, setSessionFrames] = useState<any[]>([]);
    const [loadingFrames, setLoadingFrames] = useState<boolean>(false);

    const addFrameSlot = () => {
        setFramesToUpload(prev => [...prev, { id: Date.now(), jsonFile: null, csvFile: null }]);
    };

    const removeFrameSlot = (id: number) => {
        if (framesToUpload.length <= 1) return;
        setFramesToUpload(prev => prev.filter(f => f.id !== id));
    };

    const handleFrameFileChange = (id: number, type: 'json' | 'csv', file: File | null) => {
        setFramesToUpload(prev => prev.map(f => {
            if (f.id === id) {
                return {
                    ...f,
                    [type === 'json' ? 'jsonFile' : 'csvFile']: file
                };
            }
            return f;
        }));
    };

    const openAddSessionModal = () => {
        const patients = Object.keys(patientNames);
        const doctors = Object.keys(doctorNames);
        setSelectedPatientId(patients[0] || '');
        setSelectedDoctorId(doctors[0] || '');
        
        const now = new Date();
        const yy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const defaultSessionId = `session_${dd}${mm}${yy}_${hh}${min}${ss}`;
        setNewSessionId(defaultSessionId);
        
        const timezoneOffset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now.getTime() - timezoneOffset)).toISOString().slice(0, 16);
        setStartedAt(localISOTime);
        
        setNewDevNote('');
        setFramesToUpload([{ id: Date.now(), jsonFile: null, csvFile: null }]);
        setShowAddModal(true);
    };

    const openEditSessionModal = async (session: any) => {
        setEditingSession(session);
        setEditPatientId(session.patient_id);
        setEditDoctorId(session.doctor_id);
        
        const d = new Date(session.started_at);
        const timezoneOffset = d.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(d.getTime() - timezoneOffset)).toISOString().slice(0, 16);
        setEditStartedAt(localISOTime);
        setEditDevNote(session.dev_note || '');
        
        setLoadingFrames(true);
        setSessionFrames([]);
        setShowEditModal(true);
        
        try {
            if (isSupabaseConfigured) {
                const { data, error } = await supabase
                    .from('frame_records')
                    .select('id, start_time, label, hidden')
                    .eq('session_id', session.id)
                    .order('start_time', { ascending: true });
                if (!error && data) {
                    setSessionFrames(data);
                }
            } else {
                const res = await fetchWithAuth(`/api/records/${session.id}`);
                if (res.ok) {
                    const data = await res.json();
                    const validData = Array.isArray(data) ? data : (data.data || []);
                    const mapped = validData.map((item: any, index: number) => ({
                        id: item.message_id || item.frame_id || String(index),
                        start_time: index * 10,
                        label: item.prediction?.label || "Normal",
                        hidden: false
                    }));
                    setSessionFrames(mapped);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingFrames(false);
        }
    };

    const readAsText = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => reject(r.error);
            r.readAsText(file);
        });
    };

    const parseECGCSV = (csvText: string): number[][] => {
        const lines = csvText.split('\n');
        const samples: number[][] = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (/[a-zA-Z]/.test(trimmed)) continue;
            
            const parts = trimmed.split(',').map(Number);
            if (parts.length >= 2) {
                const ch1 = isNaN(parts[0]) ? 0.0 : parts[0];
                const ch2 = isNaN(parts[1]) ? 0.0 : parts[1];
                const ch3 = parts.length >= 3 && !isNaN(parts[2]) ? parts[2] : (ch2 - ch1);
                samples.push([ch1, ch2, ch3]);
            }
        }
        return samples;
    };

    const handleSaveSession = async () => {
        if (!selectedPatientId || !selectedDoctorId || !newSessionId.trim() || !startedAt) {
            alert("Harap lengkapi informasi pasien, dokter, ID sesi, dan waktu mulai!");
            return;
        }

        for (const frame of framesToUpload) {
            if (!frame.jsonFile || !frame.csvFile) {
                alert("Harap pilih berkas .json (metadata) dan .csv (sinyal EKG) untuk setiap frame!");
                return;
            }
        }

        setIsUploading(true);
        setUploadProgress("Membuat sesi rekaman...");

        try {
            const sessionPayload = {
                id: newSessionId.trim(),
                patient_id: selectedPatientId,
                doctor_id: selectedDoctorId,
                started_at: new Date(startedAt).toISOString(),
                dev_note: newDevNote.trim() || null,
                ecg_paper: null
            };

            if (isSupabaseConfigured) {
                const { error: sessionError } = await supabase.from('sessions').upsert(sessionPayload);
                if (sessionError) {
                    throw new Error("Gagal menyimpan sesi di Supabase: " + sessionError.message);
                }
            } else {
                const res = await fetchWithAuth('/api/sessions', {
                    method: 'POST',
                    body: JSON.stringify(sessionPayload)
                });
                if (!res.ok) {
                    console.warn("Backend REST API /api/sessions gagal atau belum diimplementasikan. Melanjutkan ke SQLite...");
                }
            }

            for (let i = 0; i < framesToUpload.length; i++) {
                const frame = framesToUpload[i];
                setUploadProgress(`Memproses frame ${i + 1} dari ${framesToUpload.length}...`);

                const jsonText = await readAsText(frame.jsonFile!);
                const csvText = await readAsText(frame.csvFile!);

                const metadata = JSON.parse(jsonText);
                const samples = parseECGCSV(csvText);

                if (samples.length === 0) {
                    throw new Error(`Berkas CSV untuk frame ${i + 1} kosong atau tidak valid.`);
                }

                const sourceMeta = metadata.source_metadata || {};
                const measurementId = sourceMeta.measurement_id || crypto.randomUUID();
                const deviceId = sourceMeta.device_id || "device01";
                const frameIndex = sourceMeta.frame_index || (i + 1);
                const createdAtUtc = metadata.created_at_utc || sourceMeta.created_at_utc || new Date().toISOString();

                const payload = {
                    ...metadata,
                    ecg: {
                        samples: samples
                    },
                    raw: {
                        ch1: samples.map(s => s[0]),
                        ch2: samples.map(s => s[1]),
                        ch3: samples.map(s => s[2])
                    },
                    prediction: metadata.prediction || {
                        label: "Normal",
                        probabilities: { "Normal": 1.0 }
                    }
                };

                const frameRecord = {
                    id: measurementId,
                    session_id: newSessionId.trim(),
                    start_time: (frameIndex - 1) * 10,
                    label: payload.prediction?.label || "Normal",
                    hidden: false,
                    payload: payload,
                    device_id: deviceId,
                    created_at: createdAtUtc
                };

                if (isSupabaseConfigured) {
                    const { error: frameError } = await supabase.from('frame_records').insert(frameRecord);
                    if (frameError) {
                        throw new Error(`Gagal menyimpan frame ${i + 1} di Supabase: ${frameError.message}`);
                    }
                } else {
                    const res = await fetchWithAuth('/api/records', {
                        method: 'POST',
                        body: JSON.stringify(frameRecord)
                    });
                    if (!res.ok) {
                        console.warn(`Backend REST API /api/records gagal atau belum diimplementasikan untuk frame ${i + 1}.`);
                    }
                }
            }

            mutateSessions();
            setShowAddModal(false);
            alert(`Sesi ${newSessionId} dan ${framesToUpload.length} frame rekaman berhasil dibuat!`);
        } catch (err: any) {
            console.error("Upload error:", err);
            alert("Kesalahan saat mengunggah: " + err.message);
        } finally {
            setIsUploading(false);
            setUploadProgress('');
        }
    };

    const handleUpdateSession = async () => {
        if (!editingSession) return;
        try {
            if (isSupabaseConfigured) {
                const { error } = await supabase.from('sessions').update({
                    patient_id: editPatientId,
                    doctor_id: editDoctorId,
                    started_at: new Date(editStartedAt).toISOString(),
                    dev_note: editDevNote.trim() || null
                }).eq('id', editingSession.id);
                if (error) throw error;
            } else {
                const res = await fetchWithAuth(`/api/sessions/${editingSession.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        patient_id: editPatientId,
                        doctor_id: editDoctorId,
                        started_at: new Date(editStartedAt).toISOString(),
                        dev_note: editDevNote.trim() || null
                    })
                });
                if (!res.ok) console.warn("Backend PUT /api/sessions/:id gagal.");
            }

            mutateSessions();
            setShowEditModal(false);
            alert("Sesi rekaman berhasil diperbarui!");
        } catch (err) {
            console.error(err);
            alert("Terjadi kesalahan saat memperbarui sesi.");
        }
    };

    const deleteFrame = async (frameId: string) => {
        if (!confirm("Apakah Anda yakin ingin menghapus frame data EKG ini?")) return;
        try {
            if (isSupabaseConfigured) {
                const { error } = await supabase.from('frame_records').delete().eq('id', frameId);
                if (error) throw error;
            } else {
                const res = await fetchWithAuth(`/api/records/${frameId}`, {
                    method: 'DELETE'
                });
                if (!res.ok) console.warn("Backend DELETE /api/records/:id gagal.");
            }
            
            setSessionFrames(prev => prev.filter(f => f.id !== frameId));
            mutateSessions();
            alert("Frame EKG berhasil dihapus!");
        } catch (err: any) {
            console.error(err);
            alert("Gagal menghapus frame: " + err.message);
        }
    };

    const deleteSession = async (sessionId: string) => {
        if (!confirm("Apakah Anda yakin ingin menghapus seluruh sesi rekaman ini beserta semua data grafiknya? Tindakan ini tidak dapat dibatalkan.")) return;
        try {
            if (isSupabaseConfigured) {
                const { error: frameError } = await supabase.from('frame_records').delete().eq('session_id', sessionId);
                if (frameError) throw frameError;
                
                const { error: sessionError } = await supabase.from('sessions').delete().eq('id', sessionId);
                if (sessionError) throw sessionError;
            } else {
                const res = await fetchWithAuth(`/api/sessions/${sessionId}`, {
                    method: 'DELETE'
                });
                if (!res.ok) console.warn("Backend DELETE /api/sessions/:id gagal.");
            }
            
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            mutateSessions();
            alert("Sesi rekaman berhasil dihapus!");
        } catch (err: any) {
            console.error(err);
            alert("Gagal menghapus sesi: " + err.message);
        }
    };
    
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
            if (sessionIds.length > 0 && isSupabaseConfigured) {
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
                setSessions(fetchedSessions);
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
                                        <button 
                                            onClick={() => openEditSessionModal(session)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold transition-colors shadow-sm"
                                            title="Edit Sesi Rekaman"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">edit_note</span>
                                        </button>
                                        <button 
                                            onClick={() => deleteSession(session.id)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white hover:bg-red-700 rounded-lg text-xs font-bold transition-colors shadow-sm"
                                            title="Hapus Sesi Rekaman"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
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

            <main className={`flex flex-col transition-all duration-300 min-h-screen pb-12 w-full relative z-10 ${isOpen ? 'md:ml-[260px] md:w-[calc(100%-260px)]' : 'md:ml-0 md:w-full'}`}>
                {/* Header */}
                <header className="sticky top-0 bg-clinical-surface/80 backdrop-blur-xl border-b border-clinical-charcoal/5 z-40 px-4 md:px-6 py-4 flex justify-between items-center w-full transition-all duration-300">
                    <div className="flex items-center gap-3">
                        <button onClick={toggleSidebar} className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-clinical-surface text-clinical-charcoal/70 transition-colors outline-none" title="Sembunyikan / Tampilkan Menu Utama">
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
                                <button
                                    onClick={handleSyncDatabases}
                                    className={`font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm outline-none hover:-translate-y-0.5 active:scale-95 ${isSyncing ? 'bg-amber-100 text-amber-700' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}
                                    disabled={isSyncing}
                                >
                                    <span className={`material-symbols-outlined text-[16px] font-bold ${isSyncing ? 'animate-spin' : ''}`}>
                                        sync
                                    </span>
                                    {isSyncing ? 'Sinkronisasi...' : 'Sync Database'}
                                </button>
                                <button
                                    onClick={() => openAddSessionModal()}
                                    className="bg-clinical-blue hover:bg-clinical-blue/90 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm outline-none hover:-translate-y-0.5 active:scale-95"
                                >
                                    <span className="material-symbols-outlined text-[16px] font-bold">add</span>
                                    Tambah Sesi Baru
                                </button>
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

            {/* Modal Tambah Sesi Baru */}
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-clinical-charcoal/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col relative overflow-hidden">
                        <h3 className="font-bold font-display text-xl text-clinical-charcoal mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-clinical-blue">add_circle</span>
                            Tambah Sesi Baru & Rekaman EKG
                        </h3>
                        
                        <div className="flex-grow overflow-y-auto pr-1 flex flex-col gap-4 mb-6 custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-clinical-charcoal/70 uppercase tracking-wider mb-1.5">Pilih Pasien</label>
                                    <select
                                        value={selectedPatientId}
                                        onChange={(e) => setSelectedPatientId(e.target.value)}
                                        className="w-full bg-clinical-surface border border-clinical-charcoal/10 text-clinical-charcoal text-xs font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-clinical-blue"
                                    >
                                        {Object.entries(patientNames).map(([id, name]) => (
                                            <option key={id} value={id}>{name} ({id.substring(0,8)})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-clinical-charcoal/70 uppercase tracking-wider mb-1.5">Pilih Dokter</label>
                                    <select
                                        value={selectedDoctorId}
                                        onChange={(e) => setSelectedDoctorId(e.target.value)}
                                        className="w-full bg-clinical-surface border border-clinical-charcoal/10 text-clinical-charcoal text-xs font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-clinical-blue"
                                    >
                                        {Object.entries(doctorNames).map(([id, name]) => (
                                            <option key={id} value={id}>{name} ({id.substring(0,8)})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-clinical-charcoal/70 uppercase tracking-wider mb-1.5">Session ID</label>
                                    <input
                                        type="text"
                                        value={newSessionId}
                                        onChange={(e) => setNewSessionId(e.target.value)}
                                        className="w-full bg-clinical-surface border border-clinical-charcoal/10 text-clinical-charcoal text-xs font-mono font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-clinical-blue"
                                        placeholder="session_ddmmyy_hhmmss"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-clinical-charcoal/70 uppercase tracking-wider mb-1.5">Waktu Mulai</label>
                                    <input
                                        type="datetime-local"
                                        value={startedAt}
                                        onChange={(e) => setStartedAt(e.target.value)}
                                        className="w-full bg-clinical-surface border border-clinical-charcoal/10 text-clinical-charcoal text-xs font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-clinical-blue"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-clinical-charcoal/70 uppercase tracking-wider mb-1.5">Catatan Sesi (Opsional)</label>
                                <textarea
                                    value={newDevNote}
                                    onChange={(e) => setNewDevNote(e.target.value)}
                                    className="w-full bg-clinical-surface border border-clinical-charcoal/10 text-clinical-charcoal text-xs p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-clinical-blue"
                                    placeholder="Tulis informasi tambahan atau catatan klinis..."
                                    rows={2}
                                />
                            </div>

                            <div className="border-t border-clinical-charcoal/5 my-2"></div>

                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-bold text-clinical-charcoal/60 uppercase tracking-wider">
                                    Frame / Segmen EKG ({framesToUpload.length})
                                </h4>
                                <button
                                    type="button"
                                    onClick={addFrameSlot}
                                    className="text-[10px] font-bold text-clinical-blue border border-clinical-blue/20 hover:bg-clinical-blue/5 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all outline-none"
                                >
                                    <span className="material-symbols-outlined text-[14px]">add</span>
                                    Tambah Frame
                                </button>
                            </div>

                            <div className="flex flex-col gap-3">
                                {framesToUpload.map((frame, index) => (
                                    <div key={frame.id} className="bg-clinical-surface/40 border border-clinical-charcoal/5 rounded-2xl p-4 flex flex-col gap-3 relative">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-clinical-blue">Frame #{index + 1}</span>
                                            {framesToUpload.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeFrameSlot(frame.id)}
                                                    className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-full transition-all flex items-center justify-center"
                                                    title="Hapus Frame"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-clinical-charcoal/50 uppercase tracking-wider mb-1">Upload Metadata (.json)</label>
                                                <input
                                                    type="file"
                                                    accept=".json"
                                                    onChange={(e) => handleFrameFileChange(frame.id, 'json', e.target.files?.[0] || null)}
                                                    className="w-full text-xs text-clinical-charcoal/80 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-clinical-blue/10 file:text-clinical-blue hover:file:bg-clinical-blue/25 file:cursor-pointer"
                                                />
                                                {frame.jsonFile && <p className="text-[9px] text-emerald-600 font-bold mt-1">âœ“ {frame.jsonFile.name}</p>}
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-clinical-charcoal/50 uppercase tracking-wider mb-1">Upload Sinyal EKG (.csv)</label>
                                                <input
                                                    type="file"
                                                    accept=".csv"
                                                    onChange={(e) => handleFrameFileChange(frame.id, 'csv', e.target.files?.[0] || null)}
                                                    className="w-full text-xs text-clinical-charcoal/80 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-clinical-blue/10 file:text-clinical-blue hover:file:bg-clinical-blue/25 file:cursor-pointer"
                                                />
                                                {frame.csvFile && <p className="text-[9px] text-emerald-600 font-bold mt-1">âœ“ {frame.csvFile.name}</p>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 justify-end border-t border-clinical-charcoal/5 pt-4">
                            <button 
                                onClick={() => setShowAddModal(false)} 
                                className="py-3 px-6 rounded-full bg-clinical-charcoal/5 text-clinical-charcoal font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-charcoal/10 active:scale-95 transition-all outline-none"
                                disabled={isUploading}
                            >
                                Batal
                            </button>
                            <button 
                                onClick={handleSaveSession} 
                                className="py-3 px-6 rounded-full bg-clinical-blue text-white font-bold text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all outline-none flex items-center justify-center gap-1.5"
                                disabled={isUploading}
                            >
                                {isUploading ? (
                                    <>
                                        <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                                        {uploadProgress || "Mengunggah..."}
                                    </>
                                ) : "Simpan Sesi & Unggah"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Edit Sesi */}
            {showEditModal && editingSession && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-clinical-charcoal/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col">
                        <h3 className="font-bold font-display text-xl text-clinical-charcoal mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-clinical-blue">edit_note</span>
                            Edit Sesi Rekaman
                        </h3>
                        
                        <div className="flex-grow overflow-y-auto pr-1 flex flex-col gap-4 mb-6 custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-clinical-charcoal/70 uppercase tracking-wider mb-1.5">Pasien</label>
                                    <select
                                        value={editPatientId}
                                        onChange={(e) => setEditPatientId(e.target.value)}
                                        className="w-full bg-clinical-surface border border-clinical-charcoal/10 text-clinical-charcoal text-xs font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-clinical-blue"
                                    >
                                        {Object.entries(patientNames).map(([id, name]) => (
                                            <option key={id} value={id}>{name} ({id.substring(0,8)})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-clinical-charcoal/70 uppercase tracking-wider mb-1.5">Dokter Pemeriksa</label>
                                    <select
                                        value={editDoctorId}
                                        onChange={(e) => setEditDoctorId(e.target.value)}
                                        className="w-full bg-clinical-surface border border-clinical-charcoal/10 text-clinical-charcoal text-xs font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-clinical-blue"
                                    >
                                        {Object.entries(doctorNames).map(([id, name]) => (
                                            <option key={id} value={id}>{name} ({id.substring(0,8)})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-clinical-charcoal/70 uppercase tracking-wider mb-1.5">Waktu Mulai</label>
                                <input
                                    type="datetime-local"
                                    value={editStartedAt}
                                    onChange={(e) => setEditStartedAt(e.target.value)}
                                    className="w-full bg-clinical-surface border border-clinical-charcoal/10 text-clinical-charcoal text-xs font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-clinical-blue"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-clinical-charcoal/70 uppercase tracking-wider mb-1.5">Catatan Sesi</label>
                                <textarea
                                    value={editDevNote}
                                    onChange={(e) => setEditDevNote(e.target.value)}
                                    className="w-full bg-clinical-surface border border-clinical-charcoal/10 text-clinical-charcoal text-xs p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-clinical-blue"
                                    rows={2}
                                />
                            </div>

                            <div className="border-t border-clinical-charcoal/5 my-2"></div>

                            <h4 className="text-xs font-bold text-clinical-charcoal/60 uppercase tracking-wider mb-2">
                                Daftar Segmen / Frame Grafik EKG
                            </h4>

                            {loadingFrames ? (
                                <p className="text-xs text-clinical-charcoal/50 italic py-2">Memuat daftar frame...</p>
                            ) : sessionFrames.length === 0 ? (
                                <p className="text-xs text-clinical-charcoal/50 italic py-2">Belum ada frame terunggah pada sesi ini.</p>
                            ) : (
                                <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                                    {sessionFrames.map((frame, index) => (
                                        <div key={frame.id} className="bg-clinical-surface border border-clinical-charcoal/5 rounded-xl px-4 py-2.5 flex justify-between items-center">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-clinical-charcoal">Frame #{index + 1} ({frame.start_time}-{frame.start_time + 10}s)</span>
                                                <span className="text-[10px] text-clinical-charcoal/50 mt-0.5">Klasifikasi: <span className="font-bold text-clinical-blue">{frame.label}</span></span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => deleteFrame(frame.id)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-full transition-all flex items-center justify-center"
                                                title="Hapus Frame dari Database"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 justify-end border-t border-clinical-charcoal/5 pt-4">
                            <button 
                                onClick={() => setShowEditModal(false)} 
                                className="py-3 px-6 rounded-full bg-clinical-charcoal/5 text-clinical-charcoal font-bold text-[11px] uppercase tracking-widest hover:bg-clinical-charcoal/10 active:scale-95 transition-all outline-none"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={handleUpdateSession} 
                                className="py-3 px-6 rounded-full bg-clinical-blue text-white font-bold text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all outline-none"
                            >
                                Simpan Perubahan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


