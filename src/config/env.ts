/**
 * Sentralisasi konfigurasi Environment Variables
 * Single source of truth untuk konfigurasi aplikasi
 *
 * VITE_API_URL / VITE_WS_URL, bila kosong, diturunkan dari HOST_IP (.env).
 * VITE_API_URL dan VITE_WS_URL yang diisi manual selalu menang.
 */

const HOST_IP = import.meta.env.HOST_IP || '127.0.0.1';

export const API_URL = import.meta.env.VITE_API_URL || `http://${HOST_IP}:8081`;
export const WS_URL = import.meta.env.VITE_WS_URL || `ws://${HOST_IP}:8080`;
export const SUPPORT_CONTACT = import.meta.env.VITE_SUPPORT_CONTACT || 'https://wa.me/6281227884743';
