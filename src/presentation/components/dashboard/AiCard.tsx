import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../config/supabaseClient';

interface AiCardProps {
    sessionId?: string | null;
    rawClassification?: string | null;
    isDoctorReview?: boolean;
    timeInterval?: string;
    frameId?: string | null;
    initialDocNote?: string | null;
    initialConfirmation?: boolean | null;
    initialDocClassification?: string | null;
    startTime?: number | null;
    endTime?: number | null;
    onGoToNext?: () => void;
    isLastFrame?: boolean;
    onGoToList?: () => void;
    onValidationSuccess?: (updatedFrame: any) => void;
    onViewEcgPaper?: () => void;
}

export const AiCard: React.FC<AiCardProps> = ({ 
    sessionId, 
    rawClassification, 
    isDoctorReview, 
    timeInterval, 
    frameId, 
    initialDocNote, 
    initialConfirmation, 
    initialDocClassification, 
    startTime, 
    endTime,
    onGoToNext,
    isLastFrame,
    onGoToList,
    onValidationSuccess,
    onViewEcgPaper
}) => {
    // Apabila sudah divalidasi sebelumnya, initialConfirmation bernilai true/false.
    const hasInitialValidation = initialConfirmation !== null && initialConfirmation !== undefined;
    
    const [isEditing, setIsEditing] = useState(!hasInitialValidation);
    const [verificationState, setVerificationState] = useState<'correct' | 'incorrect' | null>(initialConfirmation === true ? 'correct' : (initialConfirmation === false ? 'incorrect' : null));
    const [selectedCorrection, setSelectedCorrection] = useState<string>(initialDocClassification || 'Normal');
    const [docNote, setDocNote] = useState<string>(initialDocNote || '');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showPostSubmitModal, setShowPostSubmitModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Sinkronisasi form jika berpindah frame yang berbeda state validasinya
    useEffect(() => {
        const hasValidation = initialConfirmation !== null && initialConfirmation !== undefined;
        setIsEditing(!hasValidation);
        setVerificationState(initialConfirmation === true ? 'correct' : (initialConfirmation === false ? 'incorrect' : null));
        setSelectedCorrection(initialDocClassification || 'Normal');
        setDocNote(initialDocNote || '');
        setShowConfirmModal(false);
        setShowPostSubmitModal(false);
        setShowDeleteModal(false);
    }, [frameId]); // Hanya reset ketika frameId berubah, BUKAN ketika prop validasi ter-update dari luar

    const executeConfirm = async () => {
        if (!frameId) return;
        
        setIsSubmitting(true);
        setShowConfirmModal(false); // Tutup pop-up konfirmasi
        
        const confirmation = verificationState === 'correct';
        const docClassification = verificationState === 'correct' ? (rawClassification || 'Unclassified') : selectedCorrection;
        
        try {
            const { error } = await supabase.from('frame_records').update({
                confirmation: confirmation,
                doc_classification: docClassification,
                doc_note: docNote
            }).eq('id', frameId);
            
            if (!error) {
                setIsEditing(false); // Kembali ke mode display
                if (onValidationSuccess) {
                    onValidationSuccess({
                        confirmation,
                        docClassification,
                        docNote
                    });
                }
                setShowPostSubmitModal(true); // Munculkan pop-up lanjut
            } else {
                console.error("Gagal menyimpan konfirmasi", error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const executeDelete = async () => {
        if (!frameId) return;
        
        setIsDeleting(true);
        setShowDeleteModal(false);
        
        try {
            const { error } = await supabase.from('frame_records').update({
                confirmation: null,
                doc_classification: null,
                doc_note: null
            }).eq('id', frameId);
            
            if (!error) {
                setIsEditing(true); 
                setVerificationState(null);
                setDocNote('');
                setSelectedCorrection('Normal');
                if (onValidationSuccess) {
                    onValidationSuccess({
                        confirmation: null,
                        docClassification: null,
                        docNote: null
                    });
                }
            } else {
                console.error("Gagal menghapus validasi", error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="bg-white rounded-[2rem] p-8 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] border border-clinical-charcoal/5 relative overflow-hidden flex flex-col justify-center min-h-[160px] transition-all duration-700 hover:-translate-y-1 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] group">
            {/* Pop Up Konfirmasi Sebelum Submit */}
            {showConfirmModal && createPortal(
                <div className="fixed inset-0 z-[100] bg-clinical-charcoal/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] p-8 shadow-2xl border border-outline-variant w-full max-w-sm text-center animate-in fade-in zoom-in duration-200">
                        <span className="material-symbols-outlined text-clinical-blue text-[48px] mb-4 block">help_clinic</span>
                        <h3 className="text-lg font-headline-lg text-clinical-charcoal mb-3">Konfirmasi Keputusan Medis</h3>
                        <p className="text-sm font-body-sm text-clinical-charcoal/70 mb-8 leading-relaxed">Apakah klasifikasi dan catatan Anda sudah sesuai? Data yang dikonfirmasi akan tercatat secara final di sistem.</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 bg-white-container border border-outline-variant text-clinical-charcoal/70 text-sm py-3 rounded-xl font-label-md hover:bg-slate-50 transition-colors"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={executeConfirm}
                                className="flex-1 bg-clinical-blue text-white text-sm py-3 rounded-xl font-label-md hover:bg-clinical-blue/90 shadow-md shadow-clinical-blue/20 transition-all active:scale-[0.98]"
                            >
                                Ya, Simpan
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Pop Up Navigasi Pasca Submit */}
            {showPostSubmitModal && createPortal(
                <div className="fixed inset-0 z-[100] bg-clinical-charcoal/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] p-8 shadow-2xl border border-outline-variant w-full max-w-sm text-center animate-in fade-in zoom-in duration-200">
                        <span className="material-symbols-outlined text-signal-green text-[48px] mb-4 block">check_circle</span>
                        <h3 className="text-lg font-headline-lg text-clinical-charcoal mb-3">Sukses Divalidasi</h3>
                        <p className="text-sm font-body-sm text-clinical-charcoal/70 mb-8 leading-relaxed">Hasil tinjauan medis telah berhasil terekam ke dalam database.</p>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => setShowPostSubmitModal(false)}
                                className="w-full bg-white-container border border-outline-variant text-clinical-charcoal/70 text-sm py-3 rounded-xl font-label-md hover:bg-slate-50 transition-colors"
                            >
                                Tetap di Frame Ini
                            </button>
                            {!isLastFrame ? (
                                <button 
                                    onClick={() => {
                                        setShowPostSubmitModal(false);
                                        if (onGoToNext) onGoToNext();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 bg-clinical-blue text-white text-sm py-3 rounded-xl font-label-md hover:bg-clinical-blue/90 shadow-md shadow-clinical-blue/20 transition-all active:scale-[0.98]"
                                >
                                    Lanjut ke Frame Selanjutnya
                                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                </button>
                            ) : (
                                <button 
                                    onClick={() => {
                                        setShowPostSubmitModal(false);
                                        if (onGoToList) onGoToList();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 bg-clinical-blue text-white text-sm py-3 rounded-xl font-label-md hover:bg-clinical-blue/90 shadow-md shadow-clinical-blue/20 transition-all active:scale-[0.98]"
                                >
                                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                                    Kembali ke Daftar Sesi
                                </button>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Pop Up Hapus Validasi */}
            {showDeleteModal && createPortal(
                <div className="fixed inset-0 z-[100] bg-clinical-charcoal/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] p-8 shadow-2xl border border-outline-variant w-full max-w-sm text-center animate-in fade-in zoom-in duration-200">
                        <span className="material-symbols-outlined text-alert-red text-[48px] mb-4 block">delete_forever</span>
                        <h3 className="text-lg font-headline-lg text-clinical-charcoal mb-3">Hapus Validasi?</h3>
                        <p className="text-sm font-body-sm text-clinical-charcoal/70 mb-8 leading-relaxed">Apakah Anda yakin ingin menghapus data validasi pada frame ini? Data keputusan medis sebelumnya akan di-reset dan dihapus.</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 bg-white-container border border-outline-variant text-clinical-charcoal/70 text-sm py-3 rounded-xl font-label-md hover:bg-slate-50 transition-colors"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={executeDelete}
                                className="flex-1 bg-alert-red text-white text-sm py-3 rounded-xl font-label-md hover:bg-alert-red/90 shadow-md shadow-alert-red/20 transition-all active:scale-[0.98]"
                            >
                                Hapus
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className="relative z-10 flex flex-col items-center justify-center h-full w-full">
                <div className="flex flex-col items-center gap-2 mb-4 relative w-full">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-clinical-blue">auto_awesome</span>
                        <h4 className="text-[12px] font-bold text-clinical-charcoal/60 uppercase tracking-[0.2em]">
                            Klasifikasi AI
                        </h4>
                    </div>
                </div>

                <div className="text-center w-full px-2">
                    {rawClassification ? (
                        <>
                            <h2 className="text-3xl md:text-4xl font-headline-lg tracking-tight text-clinical-charcoal mb-6 break-words leading-tight">
                                {rawClassification}
                            </h2>
                            
                            {isDoctorReview && (
                                <div className="mt-4 pt-6 border-t border-clinical-charcoal/10 flex flex-col items-center w-full">
                                    
                                    {!isEditing ? (
                                        // --- MODE DISPLAY (VIEW) ---
                                        <div className="w-full max-w-[240px] flex flex-col items-center text-center">
                                            <div className="bg-signal-green/10 border border-signal-green/20 text-signal-green px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[14px]">verified</span>
                                                Telah Divalidasi
                                            </div>
                                            
                                            <div className="w-full bg-slate-50 border border-outline-variant rounded-lg p-3 mb-4 text-left">
                                                <p className="text-[10px] text-clinical-charcoal/60 uppercase tracking-widest font-label-md mb-1">Keputusan Akhir</p>
                                                <p className="text-xs font-headline-md text-clinical-charcoal flex items-center gap-1 mb-2">
                                                    {initialConfirmation ? (
                                                        <><span className="material-symbols-outlined text-[14px] text-signal-green">check_circle</span> Akurat (Benar)</>
                                                    ) : (
                                                        <><span className="material-symbols-outlined text-[14px] text-alert-red">cancel</span> Koreksi (Salah)</>
                                                    )}
                                                </p>
                                                {!initialConfirmation && (
                                                    <>
                                                        <p className="text-[10px] text-clinical-charcoal/60 uppercase tracking-widest font-label-md mb-1">Klasifikasi Baru</p>
                                                        <p className="text-xs font-headline-md text-clinical-charcoal mb-2">{initialDocClassification}</p>
                                                    </>
                                                )}
                                                <p className="text-[10px] text-clinical-charcoal/60 uppercase tracking-widest font-label-md mb-1 mt-2">Catatan Dokter</p>
                                                <p className="text-xs font-body-sm text-clinical-charcoal/80 italic break-words">{initialDocNote || '-'}</p>
                                            </div>

                                            <div className="w-full flex gap-2">
                                                <button 
                                                    onClick={() => setIsEditing(true)}
                                                    className="flex-1 bg-white border border-clinical-blue text-clinical-blue hover:bg-clinical-blue/5 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-label-md text-xs transition-all shadow-sm"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                                    Edit Validasi
                                                </button>
                                                <button 
                                                    onClick={() => setShowDeleteModal(true)}
                                                    disabled={isDeleting}
                                                    className="bg-white border border-alert-red text-alert-red hover:bg-alert-red/5 flex items-center justify-center p-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50"
                                                    title="Hapus Validasi"
                                                >
                                                    {isDeleting ? (
                                                        <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // --- MODE EDIT (FORM) ---
                                        <>
                                            <p className="text-sm font-headline-md text-clinical-charcoal mb-4">Apakah klasifikasi AI ini akurat?</p>
                                            
                                            <div className="grid grid-cols-2 gap-3 w-full max-w-[240px] mb-5">
                                                <button 
                                                    onClick={() => setVerificationState('correct')}
                                                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-label-md text-sm border transition-all ${verificationState === 'correct' ? 'bg-signal-green text-white border-signal-green shadow-md shadow-signal-green/20' : 'bg-white border-outline-variant text-clinical-charcoal/70 hover:border-signal-green/50 hover:text-signal-green'}`}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">check</span>
                                                    Benar
                                                </button>
                                                <button 
                                                    onClick={() => setVerificationState('incorrect')}
                                                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-label-md text-sm border transition-all ${verificationState === 'incorrect' ? 'bg-alert-red text-white border-alert-red shadow-md shadow-alert-red/20' : 'bg-white border-outline-variant text-clinical-charcoal/70 hover:border-alert-red/50 hover:text-alert-red'}`}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                                    Salah
                                                </button>
                                            </div>

                                            {verificationState === 'incorrect' && (
                                                <div className="w-full max-w-[240px] mb-5">
                                                    <label className="block text-[10px] text-clinical-charcoal/60 uppercase tracking-widest mb-1.5 text-left font-label-md">Seharusnya:</label>
                                                    <div className="relative">
                                                        <select 
                                                            value={selectedCorrection}
                                                            onChange={(e) => setSelectedCorrection(e.target.value)}
                                                            className="w-full appearance-none text-sm font-headline-md border border-outline-variant rounded-xl px-3 py-2.5 bg-white text-clinical-charcoal focus:ring-2 focus:ring-clinical-blue/20 focus:border-clinical-blue outline-none transition-all shadow-sm"
                                                        >
                                                            <option value="Normal">Normal</option>
                                                            <option value="Bradikardia">Bradikardia</option>
                                                            <option value="Takikardia">Takikardia</option>
                                                            <option value="Atrial Fibrillation">Atrial Fibrillation</option>
                                                        </select>
                                                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-clinical-charcoal/40 pointer-events-none">expand_more</span>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="w-full max-w-[240px] mb-5 text-left">
                                                <label className="block text-[10px] text-clinical-charcoal/60 uppercase tracking-widest mb-1 font-label-md">Catatan Dokter</label>
                                                <textarea 
                                                    value={docNote}
                                                    onChange={(e) => setDocNote(e.target.value)}
                                                    placeholder="Tambahkan catatan analitis..." 
                                                    className="w-full text-xs font-body-sm bg-white border border-outline-variant rounded-lg px-3 py-2 text-clinical-charcoal focus:ring-2 focus:ring-clinical-blue/20 focus:border-clinical-blue outline-none resize-none h-20 shadow-sm transition-all"
                                                />
                                            </div>

                                            {verificationState && (
                                                <div className="w-full max-w-[240px] flex gap-2">
                                                    {hasInitialValidation && (
                                                        <button 
                                                            onClick={() => setIsEditing(false)}
                                                            className="flex-1 bg-white-container border border-outline-variant text-clinical-charcoal/70 flex items-center justify-center py-3 rounded-xl font-label-md text-xs hover:bg-slate-50 transition-all"
                                                        >
                                                            Batal
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => setShowConfirmModal(true)}
                                                        disabled={isSubmitting || !timeInterval}
                                                        className={`bg-clinical-blue text-white flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-label-md text-sm hover:bg-clinical-blue/90 active:scale-[0.98] transition-all shadow-md shadow-clinical-blue/20 disabled:opacity-50 disabled:cursor-not-allowed ${hasInitialValidation ? 'flex-1' : 'w-full'}`}
                                                    >
                                                        {isSubmitting ? (
                                                            <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                                                        ) : (
                                                            <span className="material-symbols-outlined text-[18px]">save</span>
                                                        )}
                                                        {isSubmitting ? '...' : 'Konfirmasi'}
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <h2 className="text-base font-medium tracking-wide text-clinical-charcoal/40">
                            Menunggu Data...
                        </h2>
                    )}
                </div>
            </div>
        </div>
    );
};