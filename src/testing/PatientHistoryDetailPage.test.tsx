import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { makeQrsFrame } from './ecgTestFixtures';
import { calculateFrameHeartRate, FILTERS_CLINICAL_DEFAULT } from '../core/algorithms/ecgFrameProcessor';

vi.mock('../config/api', () => ({
    fetchWithAuth: vi.fn(async (url: string) => {
        if (String(url).includes('/api/patients/')) {
            return { json: async () => ({ patient: { first_name: 'Tes', last_name: 'Pasien', profile_photo: null } }) };
        }
        const frame = makeQrsFrame(75);
        return {
            json: async () => ([
                {
                    session_id: 'ses-1',
                    raw: { ch1: frame.ch1, ch2: frame.ch2, ch3: frame.ch3 },
                    classification_result: 'NORM',
                    prediction: { label: 'NORM', probabilities: { NORM: 0.9 } },
                    device_id: 'ECG-01',
                    created_at: '2026-08-27T00:00:00Z',
                }
            ])
        };
    })
}));

vi.mock('../application/hooks/useCachedFetch', () => ({
    useCachedFetch: () => ({ data: { patient: { first_name: 'Tes', last_name: 'Pasien', profile_photo: null } } })
}));

vi.mock('../application/hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../config/supabaseClient', () => ({
    supabase: {
        from: () => ({
            select: () => ({
                eq: async () => ({ data: [] })
            })
        })
    },
    isSupabaseConfigured: false,
}));

import { PatientHistoryDetailPage } from '../presentation/pages/patient/PatientHistoryDetailPage';

describe('PatientHistoryDetailPage heart rate', () => {
    beforeEach(() => {
        localStorage.setItem('user_id', '1');
    });

    it('menampilkan BPM hasil perhitungan seluruh frame pada Heart Rate', async () => {
        const expected = calculateFrameHeartRate(makeQrsFrame(75), FILTERS_CLINICAL_DEFAULT);

        render(
            <MemoryRouter initialEntries={['/patient/history/ses-1']}>
                <Routes>
                    <Route path="/patient/history/:sessionId" element={<PatientHistoryDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            const value = screen.getByTestId('heart-rate-value').textContent;
            expect(Number(value)).toBe(expected.bpm);
        });
        expect(screen.getByText('BPM')).toBeInTheDocument();
        expect(screen.getByText('Heart Rate')).toBeInTheDocument();
    });
});
