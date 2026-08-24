import React from 'react';

export type ActionModalType = 'confirm' | 'success' | 'error' | 'warning';

interface ActionModalProps {
    isOpen: boolean;
    type: ActionModalType;
    title: string;
    message: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onClose: () => void;
    isLoading?: boolean;
}

export const ActionModal: React.FC<ActionModalProps> = ({ 
    isOpen, 
    type, 
    title, 
    message, 
    confirmText = 'OK', 
    cancelText = 'Batal', 
    onConfirm, 
    onClose,
    isLoading = false
}) => {
    if (!isOpen) return null;

    const isConfirm = type === 'confirm' || type === 'warning';

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <span className="material-symbols-outlined text-[32px]">check_circle</span>;
            case 'error':
                return <span className="material-symbols-outlined text-[32px]">error</span>;
            case 'warning':
                return <span className="material-symbols-outlined text-[32px]">warning</span>;
            case 'confirm':
            default:
                return <span className="material-symbols-outlined text-[32px]">help</span>;
        }
    };

    const getIconColorClass = () => {
        switch (type) {
            case 'success':
                return 'bg-status-green/10 text-status-green';
            case 'error':
            case 'warning':
                return 'bg-alert-red/10 text-alert-red';
            case 'confirm':
            default:
                return 'bg-medical-teal/10 text-medical-teal';
        }
    };

    const getConfirmButtonClass = () => {
        if (type === 'error' || type === 'warning') {
            return 'bg-alert-red hover:bg-red-600';
        }
        return 'bg-medical-teal hover:brightness-110';
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-charcoal/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div 
                className="bg-white rounded-2xl shadow-2xl border border-outline-variant/30 w-full max-w-sm overflow-hidden animate-in zoom-in-50 fade-in duration-500 ease-spring"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${getIconColorClass()}`}>
                        {getIcon()}
                    </div>
                    <h2 className="text-xl font-bold text-charcoal mb-2">{title}</h2>
                    <div className="text-sm text-charcoal/70">
                        {message}
                    </div>
                </div>
                <div className="bg-white px-6 py-5 border-t border-outline-variant/30 flex items-center gap-3">
                    {isConfirm && (
                        <button 
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-charcoal bg-white hover:bg-gray-50 transition-colors border border-gray-200 outline-none disabled:opacity-50"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button 
                        onClick={onConfirm || onClose}
                        disabled={isLoading}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition-colors shadow-sm outline-none flex items-center justify-center gap-2 disabled:opacity-50 ${getConfirmButtonClass()}`}
                    >
                        {isLoading && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
