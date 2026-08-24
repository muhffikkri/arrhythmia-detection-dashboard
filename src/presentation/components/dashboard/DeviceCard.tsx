import React from 'react';

interface DeviceCardProps {
    deviceId?: string;
    aiMetrics?: { latency_ms?: number; runtime?: string } | null;
    isLive?: boolean;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ deviceId = "UNDIP-ECG-01", aiMetrics, isLive = true }) => {
    return (
        <div className="bg-white border border-clinical-charcoal/5 rounded-[2rem] p-6 flex flex-col gap-4 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] transition-all duration-700 hover:-translate-y-1 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] group">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-white shadow-sm border border-clinical-charcoal/5 flex items-center justify-center text-clinical-blue group-hover:scale-110 transition-transform duration-700">
                    <span className="material-symbols-outlined text-[26px]">developer_board</span>
                </div>
                <div>
                    <p className="text-[11px] font-label-md text-clinical-charcoal/60 uppercase tracking-[0.2em]">Device ID</p>
                    <p className="text-base font-mono-data text-clinical-charcoal font-bold mt-1 tracking-wide">{deviceId}</p>
                </div>
                {isLive && (
                    <div className="ml-auto flex flex-col items-end gap-1">
                        <span className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-clinical-blue rounded-full text-[10px] font-label-md uppercase tracking-widest border border-blue-100 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-clinical-blue animate-pulse"></span>
                            Online
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};