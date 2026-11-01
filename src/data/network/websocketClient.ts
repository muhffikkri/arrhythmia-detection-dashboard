/**
 * @fileoverview Modul Data Layer: WebSocket Client
 * Hanya mengurus urusan konektivitas jaringan TCP/IP.
 * Memanggil modul checksum eksternal untuk keamanan.
 */

import type { ServerMessage } from '../../core/types/ecgTypes';
import { verifyChecksum } from '../security/checksum';
import { WS_URL } from '../../config/env';
import { Logger } from '../../core/utils/logger';

export class ECGWebSocketClient {
    private ws: WebSocket | null = null;
    private url: string;

    public onMessage?: (data: ServerMessage) => void;
    public onError?: (error: Event | string) => void;
    public onClose?: () => void;
    public onOpen?: () => void;

    constructor(endpoint: string) {
        if (endpoint.startsWith('ws://') || endpoint.startsWith('wss://')) {
            this.url = endpoint;
        } else {
            const baseUrl = WS_URL;
            this.url = `${baseUrl.replace(/\/$/, '')}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
        }
    }

    public connect(): Promise<void> {
        if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
        if (this.ws?.readyState === WebSocket.CONNECTING) {
            return new Promise((resolve, reject) => {
                const wait = window.setInterval(() => {
                    if (this.ws?.readyState === WebSocket.OPEN) {
                        window.clearInterval(wait);
                        resolve();
                    } else if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
                        window.clearInterval(wait);
                        reject(new Error("WebSocket gagal terhubung"));
                    }
                }, 25);
            });
        }

        Logger.info("Network", `Mencoba terhubung ke: ${this.url}`);
        this.ws = new WebSocket(this.url);

        return new Promise((resolve, reject) => {
            this.ws!.onopen = () => {
                Logger.info("Network", "Terhubung ke Server Rust!");
                this.attachHandlers();
                if (this.onOpen) this.onOpen();
                resolve();
            };

            this.ws!.onerror = (event: Event) => {
                Logger.error("Network", "Kesalahan WebSocket!");
                if (this.onError) this.onError(event);
                reject(new Error("WebSocket gagal terhubung"));
            };
        });
    }

    private attachHandlers(): void {
        if (!this.ws) return;

        this.ws.onmessage = async (event: MessageEvent) => {
            try {
                const data: ServerMessage = JSON.parse(event.data);

                if (data.type === 'live_data' || data.type === 'segment_data') {
                    if (data.data_payload && data.sha256_checksum) {
                        const isValid = await verifyChecksum(data.data_payload, data.sha256_checksum);
                        if (!isValid) {
                            Logger.error("Network", "Integritas data terkompromi. Paket diabaikan.");
                            return;
                        }
                    }
                }

                Logger.info("Network", `Pesan WS diterima: type=${data.type}, device=${data.device_id || "-"}, session=${data.session_id || "-"}, samples=${data.data_payload?.raw?.ch1?.length || 0}`);
                if (this.onMessage) this.onMessage(data);
            } catch (err) {
                Logger.error("Network", "Gagal memparsing pesan:", err);
            }
        };

        this.ws.onclose = (event: CloseEvent) => {
            Logger.info("Network", `Koneksi ditutup (code=${event.code}, clean=${event.wasClean}).`);
            if (this.onClose) this.onClose();
            this.ws = null;
        };
    }

    public bindHandlers(): void {
        this.attachHandlers();
    }


    public isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    public sendCommand(command: object): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(command));
        } else {
            Logger.warn("Network", "WebSocket belum siap dikirim perintah.");
        }
    }

    public disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}