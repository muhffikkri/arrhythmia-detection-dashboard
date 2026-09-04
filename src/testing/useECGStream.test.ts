import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { FILTERS_ALL_OFF, FILTERS_CLINICAL_DEFAULT, parsePathPoint, mapMillivoltToCanvasY } from '../core/algorithms/ecgFrameProcessor';
import { makeQrsFrame, makeLivePayload } from './ecgTestFixtures';

const wsHarness = vi.hoisted(() => ({
    client: null as any,
}));

vi.mock('../data/network/websocketClient', () => ({
    ECGWebSocketClient: class MockECGWebSocketClient {
        onMessage?: (msg: any) => void;
        onClose?: () => void;
        connected = false;
        lastCommand: any = null;
        constructor() {
            wsHarness.client = this;
        }
        connect() { this.connected = true; }
        disconnect() { this.connected = false; }
        isConnected() { return this.connected; }
        sendCommand(cmd: any) { this.lastCommand = cmd; }
    }
}));

vi.mock('../config/api', () => ({
    fetchWithAuth: vi.fn(async (url: string) => {
        if (String(url).includes('/api/records/')) {
            const frame0 = makeQrsFrame(60);
            const frame1 = makeQrsFrame(90);
            return {
                json: async () => ([
                    { session_id: 'session-test-1', raw: { ch1: frame0.ch1, ch2: frame0.ch2, ch3: frame0.ch3 }, classification_result: 'NORM' },
                    { session_id: 'session-test-1', raw: { ch1: frame1.ch1, ch2: frame1.ch2, ch3: frame1.ch3 }, classification_result: 'TACHY' },
                ])
            };
        }
        return { json: async () => ({ devices: [], data: [] }) };
    })
}));

import { useECGStream } from '../application/hooks/useECGStream';

describe('useECGStream integration', () => {
    beforeEach(() => {
        wsHarness.client = null;
    });

    it('tidak menampilkan BPM sebelum seluruh frame terbaca, lalu mengisi heart rate dan klasifikasi AI', async () => {
        const { result } = renderHook(() => useECGStream('ws://test', FILTERS_ALL_OFF));

        act(() => {
            result.current.startStream();
        });

        const partial = makeQrsFrame(75, 400);
        act(() => {
            wsHarness.client.onMessage(makeLivePayload(partial, 'NORM'));
        });

        expect(result.current.heartRate).toBe('--');
        expect(result.current.paths.I.length).toBe(400);
        expect(parsePathPoint(result.current.paths.I[10]).y).toBeCloseTo(
            Number(mapMillivoltToCanvasY(partial.ch1[10]).toFixed(2))
        );

        const full = makeQrsFrame(75);
        act(() => {
            wsHarness.client.onMessage(makeLivePayload({
                ch1: full.ch1.slice(400),
                ch2: full.ch2.slice(400),
                ch3: full.ch3.slice(400),
            }, 'NORM'));
        });

        expect(typeof result.current.heartRate).toBe('number');
        expect(result.current.heartRate).toBeGreaterThan(50);
        expect(result.current.rawClassification).toBe('NORM');
        expect(result.current.timeline.length).toBe(1);
        expect(result.current.paths.I.length).toBe(2500);
    });

    it('menyinkronkan kanvas dan BPM ketika filter berubah', () => {
        const { result, rerender } = renderHook(
            ({ config }) => useECGStream('ws://test', config),
            { initialProps: { config: FILTERS_ALL_OFF } }
        );

        act(() => result.current.startStream());
        const full = makeQrsFrame(75);
        act(() => {
            wsHarness.client.onMessage(makeLivePayload(full, 'AF'));
        });

        const rawY = parsePathPoint(result.current.paths.II[200]).y;
        const bpmOff = result.current.heartRate;

        rerender({ config: FILTERS_CLINICAL_DEFAULT });
        const filteredY = parsePathPoint(result.current.paths.II[200]).y;

        expect(filteredY).not.toBe(rawY);
        expect(typeof result.current.heartRate).toBe('number');
        expect(result.current.rawClassification).toBe('AF');
        expect(bpmOff).not.toBe('--');
    });

    it('bisa meninjau frame sebelumnya lalu kembali ke streaming live', async () => {
        const { result } = renderHook(() => useECGStream('ws://test', FILTERS_ALL_OFF));
        act(() => result.current.startStream());

        const frameA = makeQrsFrame(75);
        act(() => {
            wsHarness.client.onMessage(makeLivePayload(frameA, 'NORM'));
        });
        const liveY = parsePathPoint(result.current.paths.II[100]).y;
        const liveHr = result.current.heartRate;

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

        expect(result.current.isViewingHistory).toBe(true);
        expect(result.current.rawClassification).toBe('BRADY');
        expect(parsePathPoint(result.current.paths.II[100]).y).not.toBe(liveY);

        act(() => {
            result.current.resumeRealTimeStream();
        });

        expect(result.current.isViewingHistory).toBe(false);
        expect(parsePathPoint(result.current.paths.II[100]).y).toBe(liveY);
        expect(result.current.heartRate).toBe(liveHr);
    });

    it('mengirim perintah get_segment saat navigasi timeline selama WS terhubung', () => {
        const { result } = renderHook(() => useECGStream('ws://test', FILTERS_ALL_OFF));
        act(() => result.current.startStream());
        act(() => {
            result.current.fetchSegment(0);
        });
        expect(wsHarness.client.lastCommand).toEqual({ command: 'get_segment', index: 0 });
    });
});
