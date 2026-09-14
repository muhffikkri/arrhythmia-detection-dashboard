# Panduan Migrasi Database: SQLite (VPS) → Supabase

Panduan ini untuk memigrasikan **database SQLite** yang dipakai backend Rust di VPS
ke **Supabase (PostgreSQL)** — tempat tabel `sessions`, `frame_records`, auth users,
dan fungsi RPC `get_sessions_validation_counts` disimpan.

> Skrip ini **idempotent** (upsert dengan `ON CONFLICT`), sehingga aman dijalankan
> ulang berkali-kali tanpa menggandakan data.

---

## 1. Prasyarat di VPS

- Node.js **>= 20** (`node --version`). Disarankan **>= 22.5** agar bisa membaca SQLite
  tanpa install paket tambahan (`node:sqlite` bawaan).
- Akses ke file database SQLite backend (contoh: `backend/database.db`).
- Kredensial Supabase (lihat langkah 3).

Skrip migrasi membaca SQLite dengan salah satu driver, urut:
1. `node:sqlite` (bawaan Node 22.5+) — **disarankan**
2. `better-sqlite3` (`npm i better-sqlite3`)
3. CLI `sqlite3` (`apt install sqlite3`)

Supabase ditulis memakai `@supabase/supabase-js` (sudah menjadi dependency frontend),
tidak perlu install tambahan.

---

## 2. Struktur File

```text
scripts/db-migration/
├── migrate-sqlite-to-supabase.mjs   ← skrip utama migrasi
├── supabase_schema.sql              ← schema tabel + RPC (idempotent)
├── mapping.example.json             ← contoh config pemetaan kolom
└── README.md                        ← panduan ini
```

Script npm yang tersedia:

```bash
npm run db:migrate            # migrasi penuh
npm run db:migrate:dry-run    # simulasi saja (tidak menulis apa pun)
```

---

## 3. Siapkan Kredensial di `.env`

Salin `.env.example` menjadi `.env`, lalu isi bagian migrasi:

```bash
# .env (root repo)
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# Opsional: aktifkan inisialisasi schema otomatis via psql
SUPABASE_CONNECTION_STRING=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres

# Path database SQLite backend (default: database.db di folder repo)
SQLITE_DB_PATH=../backend/database.db
```

> ⚠️ **Keamanan:** `SUPABASE_SERVICE_ROLE_KEY` hanya untuk proses migrasi.
> JANGAN pakai sebagai `VITE_SUPABASE_ANON_KEY` dan jangan di-commit.
> File `.env` sudah ada di `.gitignore`.

Cara mengambil kredensial Supabase:
- Dashboard Supabase → Project Settings → **API** → copy `URL` + `service_role` (secret).
- Connection string: Project Settings → **Database** → **Connection string**.

---

## 4. Periksa Struktur Database SQLite Dulu

Sebelum migrasi, lihat tabel & contoh baris di SQLite Anda:

```bash
node scripts/db-migration/migrate-sqlite-to-supabase.mjs --inspect
```

Contoh output:

```text
=== TABEL DI SQLite ===

[sessions] (120 baris)
  Kolom: id, patient_id, doctor_id, started_at, label, dev_note
  Contoh baris pertama:
  {"id":1,"patient_id":10,"doctor_id":20,"started_at":"2025-01-01 08:00:00",...}

[frame_records] (1840 baris)
  Kolom: id, session_id, start_time, label, hidden, confirmation, ...
```

Jika output sudah sesuai harapan, lanjut. Gunakan hasil ini untuk menyusun
`columnMap` bila nama kolom berbeda dari target.

---

## 5. Buat Schema di Supabase (Sekali Saja)

Buka file `scripts/db-migration/supabase_schema.sql` — berisi:

- Tabel `public.sessions`
- Tabel `public.frame_records` (FK ke `sessions`, `on delete cascade`)
- Fungsi RPC `get_sessions_validation_counts(uuid[])` (dipakai halaman Analytics/Admin)
- Index + policy RLS dasar

Jalankan salah satu cara berikut:

**Cara A — Supabase Dashboard (paling mudah):**
1. Buka Supabase Dashboard → SQL Editor → New query.
2. Tempel seluruh isi `supabase_schema.sql` → **Run**.

**Cara B — otomatis dari script (perlu psql + connection string):**
```bash
npm run db:migrate -- --schema-only
```

> File schema idempotent — aman dijalankan berulang. Jika nama tabel SQLite berbeda
> dengan target Supabase (misal tabel `batch` → `frame_records`), sesuaikan
> `remapReferences` di config, bukan mengubah file SQL ini.

---

## 6. Susun Config Pemetaan (Opsional)

Tanpa config, skrip otomatis memigrasikan tabel bernama `sessions` dan
`frame_records` dengan pemetaan kolom identik (nama kolom yang sama langsung disalin).

Jika nama tabel/kolom berbeda, buat config (contoh: `supabase-migration.json`):

```json
{
  "sqliteDbPath": "../backend/database.db",
  "tables": {
    "sessions": {
      "sourceTable": "sessions",
      "columnMap": {
        "id": "id",
        "patient_id": "patient_id",
        "doctor_id": "doctor_id",
        "started_at": "started_at",
        "start_time": "start_time",
        "label": "label",
        "dev_note": "dev_note"
      },
      "idMode": "uuid",
      "conflictColumn": "id"
    },
    "frame_records": {
      "sourceTable": "frame_records",
      "columnMap": { "id": "id", "session_id": "session_id", "start_time": "start_time" },
      "idMode": "uuid",
      "conflictColumn": "id"
    }
  },
  "remapReferences": [
    { "table": "frame_records", "column": "session_id", "fromTable": "sessions" }
  ],
  "tableOrder": ["sessions", "frame_records"]
}
```

Penjelasan:
- `columnMap` — pemetaan `"kolomSQLite": "kolomSupabase"`. Kolom yang tidak tercantum
  dilewati (tidak dikirim).
- `idMode` — `"uuid"` (convert id integer → UUID baru) atau `"identity"` (salin apa adanya).
- `remapReferences` — jika id di-generate ulang, kolom FK (misal `session_id`) otomatis
  di-rewrite mengikuti id baru tabel induk (`fromTable`).
- `conflictColumn` — kolom kunci untuk upsert (default `id`).

Kolom bertipe tanggal (nama mengandung `time`/`date`, atau berakhiran `_at`) otomatis
dikonversi ke format ISO 8601. Nilai objek/Buffer otomatis diserialisasi.
Kolom boolean (`hidden`, `confirmation`, `is_active`, `is_bound`, `is_online`)
otomatis dikonversi dari `0/1` → `false/true`. Daftar bisa dikustomisasi lewat
`"booleanColumns": ["hidden", "confirmation"]` di config.

> Jangan taruh secret di file config. Secret tetap di `.env`.

---

## 7. Simulasi (Dry-Run)

Jalankan tanpa menulis apa pun ke Supabase:

```bash
npm run db:migrate:dry-run

# atau dengan config:
node scripts/db-migration/migrate-sqlite-to-supabase.mjs --dry-run --config supabase-migration.json
```

Output menampilkan rencana migrasi + pemetaan kolom per tabel.

---

## 8. Jalankan Migrasi

```bash
npm run db:migrate

# atau dengan config:
node scripts/db-migration/migrate-sqlite-to-supabase.mjs --config supabase-migration.json
```

Output sukses:

```text
[INFO] SQLite dibuka: ../backend/database.db (driver: node:sqlite)

=== RENCANA MIGRASI ===
  [sessions] <- [sessions]  (2 baris)
  [frame_records] <- [frame_records]  (2 baris)

=== MULAI MIGRASI DATA ===
[MIGRATE] [sessions] mengunggah 2 baris...
[MIGRATE] [sessions] selesai.
[MIGRATE] [frame_records] ditunda (tabel relasi, dimigrasikan setelah tabel induk).
[MIGRATE] [frame_records] mengunggah 2 baris...
[MIGRATE] [frame_records] selesai.

=== MIGRASI SELESAI ===
Database SQLite (database.db) berhasil disinkronkan ke Supabase.
```

---

## 9. Verifikasi Hasil

Pastikan data sudah masuk:

1. Supabase Dashboard → **Table Editor** → `sessions` & `frame_records`.
2. Uji RPC validation counts:
   ```sql
   select * from get_sessions_validation_counts(
     array(select id from sessions limit 5)
   );
   ```
3. Buka halaman Admin → **Manajemen Sesi** di aplikasi yang sudah memakai
   `VITE_SUPABASE_URL` — data sesi & frame mestinya tampil.

---

## 10. Migrasi Berulang / Sinkronisasi Berkala

Skrip menggunakan **upsert**, jadi Anda bisa menjalankannya kembali setiap kali data
SQLite bertambah (misal via cron):

```bash
*/30 * * * * cd /path/to/arrhythmia-detection-dashboard && npm run db:migrate >> /var/log/db-migrate.log 2>&1
```

Catatan: backend Rust juga memiliki endpoint `/api/admin/sync` yang disinkronkan otomatis
oleh frontend setiap 10 jam. Skrip ini adalah alternatif mandiri tanpa bergantung backend.

---

## 11. Troubleshooting

| Masalah | Solusi |
|--------|--------|
| `Tidak ada driver SQLite yang tersedia` | Upgrade Node ke >=22.5, atau `npm i better-sqlite3`, atau `apt install sqlite3` |
| `SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi` | Isi `.env` (langkah 3); untuk simulasi gunakan `--dry-run` |
| `Could not find the 'public.sessions' table` / `relation does not exist` | Jalankan `supabase_schema.sql` dulu (langkah 5) |
| `invalid input syntax for type uuid` | Gunakan `idMode: "uuid"` dan pastikan `remapReferences` terisi |
| `duplicate key value violates unique constraint` | Aman — upsert sudah menangani; jalankan ulang |
| Error saat `hidden`/`confirmation` (boolean) di SQLite bertipe 0/1 | Postgres menerima 0/1 sebagai boolean; jika tetap error, tambahkan map ke kolom lain |
| RLS menghalangi insert | Pastikan memakai `service_role` key, bukan anon key |

---

## 12. Cadangan (Backup) Sebelum Migrasi

Selalu backup SQLite sebelum migrasi:

```bash
cp ../backend/database.db ../backend/database.db.bak.$(date +%Y%m%d%H%M%S)
```

Backup Supabase (opsional): Dashboard Supabase → **Database** → **Backups** → Enable
daily backups + lakukan manual backup.