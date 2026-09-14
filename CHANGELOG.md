# Changelog

Semua perubahan penting pada proyek ini dicatat di file ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/),
dan versi mengikuti [Semantic Versioning](https://semver.org/lang/id/).

## [Unreleased]

### Ditambahkan
- *Belum ada.*

---

## [1.0.0] - 2026-09-15

Rilis stabil pertama. Aplikasi ini adalah **frontend dashboard** untuk merekam,
memantau, dan mengklasifikasikan sinyal **EKG 3-lead secara real-time** beserta
peran pengguna Admin, Dokter, dan Pasien.

### Ditambahkan

**Fitur Utama Aplikasi**
- Dashboard EKG real-time dengan rendering HTML Canvas & SVG terintegrasi
  (grid kertas medis standar, 7 jalur gelombang: Lead I, II, III, aVR, aVL, aVF, V1).
- Streaming WebSocket berperforma tinggi dari backend Rust (repo terpisah).
- Deteksi aritmia berbasis AI + algoritma klinis
  (Einthoven, Pan-Tompkins, Peak-to-Peak, Rule-Based Engine).
- Kontrol pemeriksaan medis: **Gain (5/10/20)**, **Paper Speed (12.5/25/50)**,
  **Playback speed**, kalibrasi layar fisik (penggaris), replay & scrub slider.
- Kalibrasi besar (calibration pulse) yang dirender pada seluruh lead.
- Marker R-peak dengan metrik BPM & jarak kotak (Lead II).
- Mode peninjauan segmen AI Timeline (Non Aritmia vs Anomali).
- Halaman publik: Home, How It Works, FAQ.
- Halaman Admin: Dashboard, User Management, Device Fleet, Session Management, Analytics.
- Halaman Dokter: Dashboard, Analytics, QR Scanner, Profile.
- Halaman Pasien: Dashboard, QR Sync, Device Scanner, History + Detail,
  Profile, Settings, Live Monitor.
- Progressive Web App (PWA) — installable, auto-update, precache offline.
- Obfuscation kode prod (vite-plugin-javascript-obfuscator) & anti-dev-tools
  (DevToolsBlocker).
- Fallback mock/localStorage saat backend API tidak terjangkau, plus
  sinkronisasi otomatis profile pasien.

**Migrasi Database (SQLite VPS → Supabase)**
- Skrip migrasi idempotent `scripts/db-migration/migrate-sqlite-to-supabase.mjs`
  (driver `node:sqlite` / `better-sqlite3` / CLI `sqlite3`).
- Schema Supabase `scripts/db-migration/supabase_schema.sql`
  (tabel `sessions`, `frame_records`, RPC `get_sessions_validation_counts`).
- Pemetaan kolom via JSON config, konversi otomatis tanggal ISO & boolean.
- Perintah npm: `db:migrate`, `db:migrate:dry-run`, opsi `--inspect` dan `--schema-only`.
- Panduan lengkap di `scripts/db-migration/README.md`.

**Pengujian**
- 12 file unit test / 40 test (pan-Tompkins, Einthoven, filter, rule-based engine,
  frame processor, ECGCanvas, PatientMonitorPage, useECGStream, dsb.).
- E2E Puppeteer: `puppeteer_test.cjs` & `puppeteer_monitor_test.cjs`.
- Audit tampilan lintas viewport (mobile/tablet/desktop) —
  `scripts/ui_viewport_audit.cjs`.

### Diperbaiki

- **Crash halaman 404** — `useRouteError()` dipanggil di luar data router
  (`BrowserRouter`); kini di-guard agar halaman error tetap tampil di semua viewport.
- **Infinite re-render pada halaman Riwayat Pasien**
  ("Maximum update depth exceeded") akibat fallback array yang tidak stabil di
  dependensi `useEffect`.
- **Overflow horizontal halaman Monitor ECG pada tablet** (celah 33px strip
  scrollbar) — `overflow-x: clip` pada root.
- Koneksi "database not connected".
- Akurasi rendering gain & paper speed (nilai `GAIN_Y_SCALE` / `PAPER_SPEED_X_SCALE`,
  ukuran `logicalCanvasWidth`).
- Overflow sidebar & ketidakcocokan foto profil (pembungkus `getPhotoUrl`).
- Live connection dipertahankan saat perintah **STOP** merekam dikirim.
- Penamaan klasifikasi konsisten: **"Non Aritmia"** / **"Sinus Rhythm"**.

### Direfaktor
- Pemisahan arsitektur bersih: `core`, `data`, `application`, `presentation`.
- Selective merge Web Workers & dynamic canvas scaling.

---

[2026-09-15]: Initial export `Changelog` sejalan dengan rilis `v1.0.0`.