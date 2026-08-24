import React, { useState, useEffect } from 'react';

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    itemsPerPage?: number;
    onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ 
    currentPage, 
    totalItems, 
    itemsPerPage = 10, 
    onPageChange 
}) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const [jumpPage, setJumpPage] = useState(currentPage.toString());

    // Sinkronisasi jumpPage ketika currentPage berubah dari luar
    useEffect(() => {
        setJumpPage(currentPage.toString());
    }, [currentPage]);

    if (totalItems <= itemsPerPage && currentPage === 1) {
        return null; // Sembunyikan jika tidak ada cukup item untuk halaman 2
    }

    const handleJump = (e: React.FormEvent) => {
        e.preventDefault();
        const page = parseInt(jumpPage, 10);
        if (!isNaN(page) && page >= 1 && page <= totalPages) {
            onPageChange(page);
        } else {
            // Reset if invalid
            setJumpPage(currentPage.toString());
        }
    };

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full py-4 px-4 border-t border-outline-variant/30 bg-white">
            <div className="text-xs text-on-surface-variant font-medium">
                Menampilkan <span className="font-bold text-charcoal">{totalItems === 0 ? 0 : startItem}</span> - <span className="font-bold text-charcoal">{endItem}</span> dari <span className="font-bold text-charcoal">{totalItems}</span> data
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-clinical-blue border border-clinical-blue/20 rounded-lg hover:bg-clinical-blue/5 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                    <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                    Back
                </button>

                <div className="flex items-center gap-2 px-2">
                    <span className="text-xs text-on-surface-variant">Page</span>
                    <form onSubmit={handleJump} className="flex items-center gap-1">
                        <input 
                            type="number" 
                            min={1} 
                            max={totalPages}
                            value={jumpPage}
                            onChange={(e) => setJumpPage(e.target.value)}
                            onBlur={handleJump}
                            className="w-12 text-center text-xs font-bold p-1 border border-outline-variant rounded focus:outline-none focus:ring-1 focus:ring-clinical-blue"
                        />
                    </form>
                    <span className="text-xs text-on-surface-variant">of {totalPages}</span>
                </div>

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-clinical-blue border border-clinical-blue/20 rounded-lg hover:bg-clinical-blue/5 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                    Next
                    <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </button>
            </div>
        </div>
    );
};
