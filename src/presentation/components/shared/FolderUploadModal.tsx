import React, { useState, useRef } from 'react';
import { API_URL } from '../../../config/env';

// Mendeklarasikan atribut webkitdirectory agar tidak error di TypeScript
declare module 'react' {
    interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
        webkitdirectory?: string;
        directory?: string;
    }
}

interface FolderUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientId: string;
    onSuccess?: () => void;
}

export const FolderUploadModal: React.FC<FolderUploadModalProps> = ({ isOpen, onClose, patientId, onSuccess }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setError(null);
        setSuccessMessage(null);
        setIsUploading(true);
        setProgress(10);

        try {
            // Filter hanya .csv dan .json
            const validFiles = Array.from(files).filter(file => 
                file.name.endsWith('.csv') || file.name.endsWith('.json')
            );

            if (validFiles.length === 0) {
                throw new Error("Folder tidak mengandung file .csv atau .json yang valid.");
            }

            const formData = new FormData();
            
            // Generate session_id otomatis berdasarkan timestamp
            const sessionId = `session_${new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14)}`;
            
            formData.append('patient_id', patientId);
            formData.append('session_id', sessionId);
            
            // Tambahkan semua file valid ke FormData
            validFiles.forEach((file) => {
                formData.append('files', file);
            });

            setProgress(40);

            // Fetch ke endpoint upload session
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/api/sessions/upload`, {
                method: 'POST',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: formData
            });

            setProgress(80);

            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Gagal mengupload folder sesi.');
            }

            setProgress(100);
            setSuccessMessage(`Berhasil! Sesi baru terunggah dengan ID: ${sessionId}`);
            
            setTimeout(() => {
                if (onSuccess) onSuccess();
                onClose();
                // Reset form
                setIsUploading(false);
                setProgress(0);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }, 2000);

        } catch (err: any) {
            setError(err.message || 'Terjadi kesalahan saat upload.');
            setIsUploading(false);
            setProgress(0);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-deep-charcoal/60 backdrop-blur-sm" onClick={!isUploading ? onClose : undefined}></div>
            
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative z-10 animate-in zoom-in-95 duration-200">
                <h2 className="text-xl font-bold text-deep-charcoal mb-2">Upload Folder Sesi</h2>
                <p className="text-sm text-secondary mb-6">
                    Pilih folder yang berisi kumpulan frame (file .csv dan .json) untuk pasien ini.
                </p>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100">
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm mb-4 border border-green-100 font-medium">
                        {successMessage}
                    </div>
                )}

                <div className="space-y-4">
                    <div className="border-2 border-dashed border-outline-variant rounded-xl p-8 text-center bg-surface-container/30 hover:bg-surface-container transition-colors relative">
                        <span className="material-symbols-outlined text-4xl text-medical-teal mb-2">folder_open</span>
                        <p className="text-sm font-medium text-deep-charcoal">
                            {isUploading ? 'Sedang Memproses...' : 'Klik untuk Memilih Folder'}
                        </p>
                        <p className="text-xs text-secondary mt-1">hanya mengekstrak .csv dan .json</p>
                        
                        <input 
                            ref={fileInputRef}
                            type="file" 
                            webkitdirectory="" 
                            directory="" 
                            multiple 
                            onChange={handleUpload}
                            disabled={isUploading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        />
                    </div>

                    {isUploading && (
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-medical-teal h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end">
                    <button 
                        onClick={onClose}
                        disabled={isUploading}
                        className="px-4 py-2 rounded-lg font-medium text-secondary hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
};
