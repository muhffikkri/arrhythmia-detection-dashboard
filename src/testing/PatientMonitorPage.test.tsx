import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { parsePathPoint, mapMillivoltToCanvasY } from '../core/algorithms/ecgFrameProcessor';
import { makeQrsFrame, makeLivePayload } from './ecgTestFixtures';

const wsHarness = vi.hoisted(() => ({ client: null as any }));

vi.mock('../data/network/websocketClient', () => ({
    ECGWebSocketClient: class MockECGWebSocketClient {
        onMessage?: (msg: any) => void;
        connected = false;
        lastCommand: any = null;
        constructor() { wsHarness.client = this; }
        connect() { this.connected = true; }
        disconnect() { this.connected = false; }
        isConnected() { return this.connected; }
        sendCommand(cmd: any) { this.lastCommand = cmd; }
    }
}));

vi.mock('../config/api', () => ({
    fetchWithAuth: vi.fn(async () => ({
        ok: true,
        json: async () => ({ devices: [{ id: '1', name: 'ECG-TEST-01', status: 'Online' }], data: [] })
    }))
}));

vi.mock('../application/hooks/useCachedFetch', () => ({
    useCachedFetch: () => ({ data: { patient: { first_name: 'Tes', last_name: 'Pasien', profile_photo: null } } })
}));

vi.mock('../application/hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../config/supabaseClient', () => ({
    supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
    isSupabaseConfigured: false,
}));

import { PatientMonitorPage } from '../presentation/pages/patient/PatientMonitorPage';

const renderMonitor = () => render(
    <MemoryRouter>
        <PatientMonitorPage />
    </MemoryRouter>
);

const dismissWarning = () => {
    const ignore = screen.queryByText('Abaikan');
    if (ignore) fireEvent.click(ignore);
};

describe('PatientMonitorPage integration', () => {
    beforeEach(() => {
        wsHarness.client = null;
        localStorage.setItem('user_id', '1');
        localStorage.setItem('synced_device_id', 'ECG-TEST-01');
    });

    it('menampilkan kontrol gain, speed, playback, heart rate BPM, dan klasifikasi AI', async () => {
        renderMonitor();
        dismissWarning();

        expect(screen.getByText('Gain')).toBeInTheDocument();
        expect(screen.getByText('Speed')).toBeInTheDocument();
        expect(screen.getByText('Playback')).toBeInTheDocument();
        expect(screen.getByText('Heart Rate')).toBeInTheDocument();
        expect(screen.getByText('BPM')).toBeInTheDocument();
        expect(screen.getByText('Klasifikasi AI')).toBeInTheDocument();
        expect(document.getElementById('ecg-scroll-container')).toBeInTheDocument();
    });

    it('mengubah gain, paper speed, dan playback', async () => {
        renderMonitor();
        dismissWarning();

        fireEvent.click(screen.getByTitle('20 mm/mV (2x)'));
        expect(screen.getByTitle('20 mm/mV (2x)').className).toContain('text-clinical-blue');

        fireEvent.click(screen.getByRole('button', { name: '50' }));
        expect(document.querySelector('[data-testid="ecg-svg"]')?.getAttribute('width')).toBe('4000');

        fireEvent.click(screen.getByRole('button', { name: '2x' }));
        expect(screen.getByRole('button', { name: '2x' }).className).toContain('text-clinical-blue');

        fireEvent.click(screen.getByText('play_arrow'));
        expect(screen.getByText('pause')).toBeInTheDocument();
    });

    it('menampilkan EKG raw, BPM setelah frame penuh, AI, navigasi frame, dan kembali ke live', async () => {
        renderMonitor();
        dismissWarning();

        fireEvent.click(screen.getByText(/Mulai Perekaman/));
        await waitFor(() => expect(wsHarness.client).toBeTruthy());

        fireEvent.click(screen.getByTitle('Konfigurasi Filter Sinyal'));
        fireEvent.click(screen.getByLabelText('Baseline Blocker'));
        fireEvent.click(screen.getByLabelText('HF Denoise'));
        fireEvent.click(screen.getByLabelText('Bandpass 0.5-40Hz'));

        const full = makeQrsFrame(75);
        act(() => {
            wsHarness.client.onMessage(makeLivePayload(full, 'NORM'));
        });

        await waitFor(() => {
            const hr = screen.getByTestId('heart-rate-value').textContent;
            expect(Number(hr)).toBeGreaterThan(50);
        });
        expect(screen.getByTestId('ai-classification').textContent).toBe('NORM');

        expect(pathY(10)).toBeCloseTo(Number(mapMillivoltToCanvasY(full.ch1[10]).toFixed(2)), 1);

        fireEvent.click(screen.getByLabelText('Baseline Blocker'));
        fireEvent.click(screen.getByLabelText('HF Denoise'));
        fireEvent.click(screen.getByLabelText('Bandpass 0.5-40Hz'));

        await waitFor(() => {
            expect(pathY(10)).not.toBeCloseTo(Number(mapMillivoltToCanvasY(full.ch1[10]).toFixed(2)), 1);
        });

        const timelineBtn = await screen.findByRole('button', { name: '00:00' });
        fireEvent.click(timelineBtn);
        expect(wsHarness.client.lastCommand).toEqual({ command: 'get_segment', index: 0 });

        act(() => {
            wsHarness.client.onMessage({
                type: 'segment_data',
                session_id: 'session-test-1',
                data_payload: {
                    raw: { time: [], ch1: makeQrsFrame(60).ch1, ch2: makeQrsFrame(60).ch2, ch3: makeQrsFrame(60).ch3 },
                    classification_result: 'BRADY',
                    anomaly_indices: [],
                    segment_index: 0,
                }
            });
        });

        await waitFor(() => expect(screen.getByText('Kembali ke Live')).toBeInTheDocument());
        expect(screen.getByTestId('ai-classification').textContent).toBe('BRADY');

        fireEvent.click(screen.getByText('Kembali ke Live'));
        await waitFor(() => expect(screen.queryByText('Kembali ke Live')).not.toBeInTheDocument());
    });
});

function pathY(index: number): number {
    const d = document.querySelector('[data-testid="ecg-path-I"]')?.getAttribute('d') || '';
    const points = d.replace(/^M/, '').split(' L');
    return parsePathPoint(points[index] || points[0]).y;
}
