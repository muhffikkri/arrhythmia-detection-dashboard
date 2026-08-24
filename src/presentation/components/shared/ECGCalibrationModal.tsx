import React from 'react';

interface ECGCalibrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentScale: number;
    onSaveScale: (newScale: number) => void;
    onResetScale: () => void;
}

export const ECGCalibrationModal: React.FC<ECGCalibrationModalProps> = ({ isOpen, onClose, currentScale, onSaveScale, onResetScale }) => {
    // Asus TUF Gaming F15 (15.6" FHD 1920x1080) dengan kompensasi Display Scaling OS
    // Berdasarkan pengukuran aktual user: 219px = 49.0mm => 1mm = 4.4693px
    const ASUS_TUF_SCALE = 0.5586; // 4.4693 / 8
    
    // 50 mm = 50 * 4.4693 = 223.46px (dibulatkan 223px)
    const REFERENCE_PIXELS = 223;

    if (!isOpen) return null;

    const handleSave = () => {
        onSaveScale(ASUS_TUF_SCALE);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-clinical-charcoal/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white border border-clinical-charcoal/5 rounded-[2rem] p-8 shadow-2xl max-w-2xl w-full mx-4 animate-in zoom-in-50 fade-in duration-500 ease-spring text-center" onClick={e => e.stopPropagation()}>
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-6 text-clinical-blue mx-auto border border-blue-100">
                    <span className="material-symbols-outlined text-3xl">laptop_mac</span>
                </div>
                <h3 className="text-xl font-bold font-display text-clinical-charcoal mb-2">Mode Layar Fisik (Asus TUF)</h3>
                <p className="text-sm font-medium text-clinical-charcoal/60 mb-6 leading-relaxed">
                    Mode ini mengatur ukuran kanvas EKG agar 1 kotak = 1 mm nyata secara fisik, dihitung khusus untuk layar <strong>Asus TUF Gaming F15</strong> (15.6" 1080p).
                    <br /><br />Untuk memvalidasi, garis lurus hitam di bawah ini seharusnya berukuran persis <strong>50 mm (5 cm)</strong> di layar Anda jika diukur menggunakan penggaris asli.
                </p>

                {/* Garis Referensi 278px (50mm) tanpa marka tepi */}
                <div className="flex justify-center mb-10 mt-6">
                    <div className="relative flex flex-col items-center">
                        <div 
                            style={{ width: `${REFERENCE_PIXELS}px` }} 
                            className="h-[2px] bg-clinical-charcoal"
                        ></div>
                        <div className="text-xs text-clinical-charcoal/40 mt-3 font-mono-data tracking-wider">Validasi: 50 mm</div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button 
                        onClick={onClose}
                        className="px-6 py-3 rounded-lg font-bold text-[13px] bg-clinical-surface hover:brightness-95 text-clinical-charcoal transition-colors"
                    >
                        Batal
                    </button>
                    {currentScale !== 1.0 && (
                        <button 
                            onClick={() => {
                                onResetScale();
                                onClose();
                            }}
                            className="px-6 py-3 rounded-lg font-bold text-[13px] bg-red-50 text-clinical-red hover:brightness-95 transition-colors border border-red-100"
                        >
                            Matikan Mode Fisik
                        </button>
                    )}
                    {currentScale !== ASUS_TUF_SCALE && (
                        <button 
                            onClick={handleSave}
                            className="px-8 py-3 rounded-lg font-bold text-[13px] bg-clinical-blue text-white hover:brightness-110 transition-colors shadow-sm hover:shadow-[0px_10px_20px_rgba(23,107,206,0.2)]"
                        >
                            Terapkan Skala Asus TUF
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
