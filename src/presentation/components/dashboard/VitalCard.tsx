import React from 'react';
import type { ClinicalExplanation } from '../../../core/clinical/ruleBasedEngine';

import type { DeviceStressTest } from '../../../core/types/ecgTypes';

interface VitalCardProps {
    heartRate: number | string;
    clinicalStatus: ClinicalExplanation | null;
    stressTest?: DeviceStressTest | null;
    createdAt?: string | null;
    hideTechnicalDetails?: boolean;
}

export const VitalCard: React.FC<VitalCardProps> = ({ heartRate, clinicalStatus, stressTest, createdAt, hideTechnicalDetails }) => {
    return (
        <div className="bg-white border border-clinical-charcoal/5 rounded-[2rem] p-8 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] transition-all duration-700 hover:-translate-y-1 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] group">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <p className="text-[12px] font-bold text-clinical-charcoal/60 uppercase tracking-[0.2em] mb-2">Heart Rate</p>
                    <h2 className={`text-6xl font-bold font-display leading-none mt-1 transition-colors duration-700 ${clinicalStatus?.severity === 'CRITICAL' ? 'text-clinical-red' : 'text-clinical-charcoal group-hover:text-clinical-blue'}`}>
                        <span data-testid="heart-rate-value">{heartRate}</span> <span className="text-xl font-bold tracking-normal ml-1 text-clinical-charcoal/50">BPM</span>
                    </h2>
                </div>
                <div className={`px-4 py-2 rounded-full font-bold text-[11px] border flex items-center gap-2 transition-all shadow-sm ${
                    !clinicalStatus ? 'bg-clinical-surface text-clinical-charcoal/60 border-clinical-charcoal/10' :
                    clinicalStatus.severity === 'CRITICAL' ? 'bg-red-50 text-clinical-red border-red-200 pulse-animation' :
                    'bg-blue-50 text-clinical-blue border-blue-100'
                }`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${!clinicalStatus ? 'bg-slate-300' : clinicalStatus.severity === 'CRITICAL' ? 'bg-clinical-red' : 'bg-clinical-blue'}`}></span>
                    {!clinicalStatus ? 'TUNGGU DATA' : clinicalStatus.severity === 'CRITICAL' ? 'ANOMALI DETEKSI' : 'NORMAL'}
                </div>
            </div>
            <div className="space-y-4 pt-6 border-t border-clinical-charcoal/5">
                <div className="flex justify-between items-center">
                    <span className="text-[13px] font-medium text-clinical-charcoal/60">Status Irama:</span>
                    <span className={`text-[14px] font-bold font-display tracking-wide transition-colors duration-700 ${!clinicalStatus ? 'text-clinical-charcoal/40' : clinicalStatus.severity === 'CRITICAL' ? 'text-clinical-red' : 'text-clinical-blue'}`}>
                        {!clinicalStatus ? 'Menganalisis...' : clinicalStatus.severity === 'CRITICAL' ? 'Aritmia Terdeteksi' : 'Normal Sinus Rhythm'}
                    </span>
                </div>
            </div>
        </div>
    );
};