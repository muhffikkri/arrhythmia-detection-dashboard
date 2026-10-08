# Arrhythmia Detection Dashboard — ECGRhythmia

Dashboard medis **real-time** untuk merekam, memantau, dan mengklasifikasikan
sinyal **Electrocardiogram (ECG) 3-lead**. Aplikasi ini adalah **frontend** React
yang menampilkan gelombang EKG berperforma tinggi (HTML Canvas + SVG), dengan
deteksi aritmia berbasis AI, algoritma klinis bawaan, dan dukungan PWA agar bisa
diinstal di desktop maupun mobile.

> Backend (Rust) berada di **repo terpisah** dan menyediakan REST API
> (`http://127.0.0.1:8081`) serta WebSocket streaming (`ws://127.0.0.1:8080`).
> Repo ini berisi frontend + skrip pengujian/maintenance.

## ✨ Fitur Utama

- **Streaming EKG real-time** via WebSocket dengan rendering satu-canvas
  (grid kertas medis, 7 lead: I, II, III, aVR, aVL, aVF, V1).
- **Deteksi aritmia AI** + algoritma klinis: Einthoven, Pan-Tompkins,
  Peak-to-Peak, dan Rule-Based Engine.
- **Kontrol medis:** gain (5/10/20), paper speed (12.5/25/50), playback speed,
  kalibrasi layar fisik (penggaris), replay, dan scrub timeline.
- **Marker R-peak** dengan metrik BPM & jarak kotak (Lead II), plus
  calibration pulse di semua lead.
- **AI Timeline** navigasi segmen 10 detik (Non Aritmia vs Anomali).
- **Tiga peran pengguna:** Admin, Dokter, Pasien.
- **Progressive Web App (PWA)** — installable, auto-update, precache offline.
- **Obfuscation kode produksi** & perlindungan DevTools.
- **Fallback mock/localStorage** saat backend tidak terjangkau.
- **Migrasi database** SQLite (VPS) → Supabase (lihat [README migrasi](scripts/db-migration/README.md)).

## 🛠️ Teknologi

- **Framework:** React 19, React Router 7, TypeScript, Vite 8
- **Styling:** Tailwind CSS 3 + tailwindcss-animate + container-queries
- **State/Data:** SWR (`useCachedFetch`), custom hooks (`useECGStream`, `useECGScale`)
- **Backend service:** Supabase (Auth + Database, proxy `/supabase`) & Rust API (repo terpisah)
- **Pengujian:** Vitest + Testing Library (unit), Puppeteer (E2E), oxlint (lint)
- **Build:** Vite PWA (`vite-plugin-pwa`), `vite-plugin-javascript-obfuscator`

## 👥 Halaman per Peran

| Peran | Rute utama |
|-------|-----------|
| Publik | `/`, `/how-it-works`, `/faq`, `/auth`, `/auth/login`, `/auth/register` |
| Admin | `/admin/dashboard`, `/admin/users`, `/admin/devices`, `/admin/sessions`, `/admin/analytics` |
| Dokter | `/doctor/dashboard`, `/doctor/analytics`, `/doctor/qr-scanner`, `/doctor/profile` |
| Pasien | `/patient/dashboard`, `/patient/qr-sync`, `/patient/device-scanner`, `/patient/history[/:sessionId]`, `/patient/profile`, `/patient/settings`, `/patient/monitor` |

## ⚙️ Memulai

### Prasyarat

- **Node.js ≥ 20** (disarankan **≥ 22.5** agar skrip migrasi bisa memakai
  `node:sqlite` bawaan tanpa package tambahan).
- Backend Rust berjalan (repo terpisah) pada:
  - REST API `http://127.0.0.1:8081`
  - WebSocket `ws://127.0.0.1:8080`

### 1. Install dependensi

```bash
npm install
```

### 2. Siapkan environment

```bash
cp .env.example .env
```

Isi bila memakai Supabase (lihat tabel env di bawah). Tanpa `VITE_SUPABASE_URL`,
aplikasi otomatis memakai **mode fallback REST API SQLite**.

### 3. Jalankan development server

```bash
npm run dev
```

Dashboard tersedia di `http://localhost:5173`. Vite meng-proxy `/api`
ke backend dan `/supabase` ke Supabase.

## 🔐 Environment Variables

| Variabel | Default | Deskripsi |
|----------|---------|-----------|
| `VITE_API_URL` | `http://127.0.0.1:8081` | Base URL REST API backend |
| `VITE_WS_URL` | `ws://127.0.0.1:8080` | URL WebSocket streaming ECG |
| `VITE_SUPABASE_URL` | *(kosong)* | URL project Supabase. Kosong = fallback REST SQLite |
| `VITE_SUPABASE_ANON_KEY` | *(kosong)* | Anon public key Supabase |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | *(kosong)* | Hanya untuk `npm run db:migrate` — **jangan** digunakan di frontend/production |
| `SUPABASE_CONNECTION_STRING` / `SQLITE_DB_PATH` | *(kosong)* | Hanya untuk migrasi/schema otomatis |

## 📜 Skrip NPM

```bash
npm run dev                 # dev server (Vite)
npm run build               # typecheck (tsc -b) + production build ke dist/
npm run preview             # pratinjau hasil build
npm run lint                # oxlint
npm test                    # unit test (Vitest)
npm run test:watch          # unit test watch mode
npm run test:e2e            # E2E Puppeteer (admin + monitor)
npm run test:all            # unit + E2E
npm run test-and-build      # pipeline test lalu build
npm run db:migrate          # migrasi SQLite → Supabase
npm run db:migrate:dry-run  # simulasi migrasi tanpa menulis
```

Dokumentasi lengkap migrasi database: [`scripts/db-migration/README.md`](scripts/db-migration/README.md).

## 🧪 Pengujian

- **Unit test (40):** algoritma sinyal, rule engine, hook, komponen halaman
  (`npm test`).
- **E2E Puppeteer:** alur admin sessions (`puppeteer_test.cjs`) dan monitor pasien
  (`puppeteer_monitor_test.cjs`).
- **Audit tampilan lintas viewport:** mobile (375px), tablet (768px), desktop
  (1440px) di semua halaman:

  ```bash
  node scripts/ui_viewport_audit.cjs
  ```

## 📂 Struktur Proyek

```text
├── src/
│   ├── core/               # Logika klinis murni (algoritma, rule engine)
│   ├── data/               # Jaringan & keamanan (WebSocket, checksum)
│   ├── application/        # Hooks state management (useECGStream, SWR)
│   ├── presentation/       # Komponen UI (pages, canvas, layout, shared)
│   ├── config/             # env, api/fetchWithAuth, supabaseClient
│   └── testing/            # Unit test (Vitest)
├── scripts/
│   ├── db-migration/       # Migrasi SQLite → Supabase + schema + panduan
│   └── ui_viewport_audit.cjs  # Audit tampilan lintas viewport
├── public/                 # Aset statis & PWA icons
├── puppeteer_test.cjs      # E2E admin/sessions
├── puppeteer_monitor_test.cjs  # E2E monitor pasien
├── test_and_build.cjs      # Pipeline test + build
├── vite.config.ts          # PWA, obfuscation, proxy dev server
├── index.html
└── package.json
```

## 🔄 Deployment & Rilis

```bash
npm run build            # menghasilkan folder dist/ (termasuk PWA service worker)
npm run preview          # untuk mengecek hasil build secara lokal
```

### CI & Auto-Deploy (GitHub Actions)

Dua workflow di `.github/workflows/`:

| Workflow | File | Pemicu |
|---|---|---|
| Lint + type + test + build | `ci.yml` | Push/PR ke `main` (job build hanya push, bukan PR) |
| Deploy VPS | `deploy.yml` | Push ke `main` (setelah CI hijau) |

**`ci.yml`** — `npm run lint` (oxlint), `npx tsc --noEmit`,
`npm run test` (Vitest), lalu `npm run build` (push only).

**`deploy.yml`** — SSH ke VPS (`VPS_SSH_KEY`), `git pull` di
`/var/www/arrhythmia-detection-dashboard`, `npm ci`,
`VITE_APP_VERSION=$VITE_APP_VERSION npm run build`.
Hasil `dist/` disajikan nginx di VPS.

**Secrets GitHub** (Settings → Secrets and variables → Actions, repo ini):

| Nama | Isi |
|---|---|
| `VPS_SSH_KEY` | Private key ed25519 (pub-nya di `~/.ssh/authorized_keys` VPS). Arah: GitHub runner → VPS. |
| `VPS_HOST` | `202.155.16.129` atau `api.ecgrhythmia.cloud` |
| `VPS_USER` | user SSH di VPS (mis. `root`) |
| `VITE_APP_VERSION` | string versi (mis. `2`); ubah untuk memaksa full clear `localStorage`/`sessionStorage`/cookie di client (mekanisme `checkAppVersion` di `src/main.tsx`) |

Catatan: runner juga `git pull` dari VPS via git key Opsi A (key user-level
VPS→GitHub, terpisah dari `VPS_SSH_KEY`). Rahasia tak pernah tercatat di log.

Catatan versi & riwayat perubahan ada di [`CHANGELOG.md`](CHANGELOG.md).

## 📜 Lisensi

Proyek ini digunakan untuk tujuan pendidikan dan simulasi.