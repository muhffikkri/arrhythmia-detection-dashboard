import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_NAME = basename(fileURLToPath(import.meta.url));

function printHelp() {
  console.log(`
Migrasi database SQLite (backend Rust) ke Supabase (PostgreSQL).

Penggunaan:
  node ${SCRIPT_NAME} [--config config.json] [--dry-run] [--schema-only] [--list-tables] [--inspect]

Opsi:
  --config <path>   Path ke file mapping config (.json). Lihat mapping.example.json.
  --dry-run         Hanya membaca SQLite dan menampilkan rencana migrasi, TIDAK menulis apa pun ke Supabase.
  --schema-only     Hanya membuat/verifikasi schema di Supabase (tabel + RPC), tanpa migrasi data.
  --list-tables     Tampilkan seluruh tabel di SQLite lalu keluar.
  --inspect         Tampilkan struktur SQLite + contoh baris (untuk menyusun mapping config).
  --help            Tampilkan bantuan ini.

Variabel lingkungan (bisa lewat file .env di root repo):
  SUPABASE_URL                URL project Supabase (contoh: https://xxxx.supabase.co)
  SUPABASE_SERVICE_ROLE_KEY   Service role key Supabase (BUKAN anon key!)
  SUPABASE_CONNECTION_STRING  Connection string Postgres Supabase (opsional; otomatis buat schema via psql)
  SQLITE_DB_PATH              Path ke file database SQLite (contoh: ../backend/database.db)

Contoh:
  node ${SCRIPT_NAME} --list-tables
  node ${SCRIPT_NAME} --inspect
  node ${SCRIPT_NAME} --dry-run --config supabase-migration.json
  node ${SCRIPT_NAME} --config supabase-migration.json
`);
}

const args = process.argv.slice(2);

const argIndex = (name) => args.indexOf(name);
const hasFlag = (name) => args.includes(name);

if (hasFlag('--help') || args.length === 0) {
  printHelp();
  process.exit(0);
}

const argValue = (name) => {
  const i = argIndex(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
};

const configPath = argValue('--config');
const DRY_RUN = hasFlag('--dry-run');
const SCHEMA_ONLY = hasFlag('--schema-only');
const LIST_TABLES = hasFlag('--list-tables');
const INSPECT = hasFlag('--inspect');

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const rawLine of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    let key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value.includes(' #')) value = value.slice(0, value.indexOf(' #')).trim();
    out[key] = value;
  }
  return out;
}

const rootEnv = parseEnvFile(resolve(process.cwd(), '.env'));
const envFromRoot = (key) => process.env[key] !== undefined ? process.env[key] : (rootEnv[key] !== undefined ? rootEnv[key] : '');

const supabaseUrlFromEnv = envFromRoot('SUPABASE_URL') || envFromRoot('VITE_SUPABASE_URL').replace(/^\//, '');
const serviceRoleKey = envFromRoot('SUPABASE_SERVICE_ROLE_KEY');
const connectionString = envFromRoot('SUPABASE_CONNECTION_STRING');
const sqliteDbPathFromEnv = envFromRoot('SQLITE_DB_PATH');

let config = {};
if (configPath) {
  const absConfigPath = resolve(process.cwd(), configPath);
  if (!existsSync(absConfigPath)) {
    console.error(`[ERROR] Config tidak ditemukan: ${absConfigPath}`);
    process.exit(1);
  }
  config = JSON.parse(readFileSync(absConfigPath, 'utf-8'));
}

function openSqlite(path) {
  const tryNodeSqlite = () => {
    try {
      const { DatabaseSync } = requireNodeSqlite();
      const db = new DatabaseSync(path, { readOnly: true });
      return {
        name: 'node:sqlite',
        query: (sql) => db.prepare(sql).all(),
        close: () => db.close(),
      };
    } catch {
      return null;
    }
  };

  const tryBetterSqlite3 = () => {
    try {
      const Database = requireBetterSqlite3();
      const db = new Database(path, { readonly: true });
      return {
        name: 'better-sqlite3',
        query: (sql) => db.prepare(sql).all(),
        close: () => db.close(),
      };
    } catch {
      return null;
    }
  };

  const tryCli = () => {
    try {
      execFileSync('sqlite3', [path, '-json', 'SELECT 1 AS ok'], { encoding: 'utf-8' });
      return {
        name: 'sqlite3-cli',
        query: (sql) => {
          try {
            const raw = execFileSync('sqlite3', [path, '-json', sql], { encoding: 'utf-8' });
            return raw.trim() ? JSON.parse(raw) : [];
          } catch (err) {
            if (String(err).includes('no such table') || String(err).includes('no such column')) return [];
            throw err;
          }
        },
        close: () => {},
      };
    } catch {
      return null;
    }
  };

  return tryNodeSqlite() || tryBetterSqlite3() || tryCli();
}

function requireNodeSqlite() {
  return { DatabaseSync: process.getBuiltinModule ? process.getBuiltinModule('node:sqlite').DatabaseSync : require('node:sqlite').DatabaseSync };
}

function requireBetterSqlite3() {
  if (process.getBuiltinModule) {
    const bsq = process.getBuiltinModule('better-sqlite3');
    if (bsq) return bsq;
  }
  return require('better-sqlite3');
}

const sqliteDbPath = resolve(process.cwd(), config.sqliteDbPath || sqliteDbPathFromEnv || 'database.db');

if (!existsSync(sqliteDbPath)) {
  console.error(`[ERROR] Database SQLite tidak ditemukan: ${sqliteDbPath}`);
  console.error('        Set path via env SQLITE_DB_PATH atau kolom "sqliteDbPath" di config.');
  process.exit(1);
}

const db = openSqlite(sqliteDbPath);
if (!db) {
  console.error('[ERROR] Tidak ada driver SQLite yang tersedia.');
  console.error('        Pastikan salah satu tersedia: Node.js >= 22.5, npm i better-sqlite3, atau sqlite3 CLI.');
  process.exit(1);
}
console.log(`[INFO] SQLite dibuka: ${sqliteDbPath} (driver: ${db.name})`);

const toArray = (v) => v ?? [];

function normalizeValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Uint8Array || value instanceof Buffer) {
    return Buffer.from(value).toString('base64');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function looksLikeDateColumn(name) {
  const n = name.toLowerCase();
  return n.includes('time') || n.includes('date') || n.endsWith('_at') || n === 'created' || n === 'updated';
}

const DEFAULT_BOOLEAN_COLUMNS = ['hidden', 'confirmation', 'is_active', 'is_bound', 'is_online'];

function booleanColumns() {
  return Array.isArray(config.booleanColumns) ? config.booleanColumns : DEFAULT_BOOLEAN_COLUMNS;
}

function toBoolean(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const str = String(value).trim().toLowerCase();
  if (['1', 'true', 't', 'yes', 'y', 'on'].includes(str)) return true;
  if (['0', 'false', 'f', 'no', 'n', 'off'].includes(str)) return false;
  return value;
}

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = Math.abs(value) > 1e12 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
  }
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(str)) {
    return str.replace(' ', 'T') + (str.length < 19 ? '' : 'Z');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return `${str}T00:00:00Z`;
  const n = Number(str);
  if (!Number.isNaN(n) && str.trim() !== '') {
    const ms = Math.abs(n) > 1e12 ? n : n * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? str : d.toISOString();
  }
  return str;
}

function getTables(driver) {
  return driver
    .query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .map((r) => r.name);
}

function getColumns(driver, table) {
  return driver.query(`PRAGMA table_info("${table}")`).map((c) => c.name);
}

function getRowCount(driver, table) {
  try {
    const rows = driver.query(`SELECT COUNT(*) AS n FROM "${table}"`);
    return rows.length ? Number(rows[0].n) : 0;
  } catch {
    return 0;
  }
}

function tableConfig(targetName) {
  return (config.tables || {})[targetName] || {};
}

function columnMapOf(targetName) {
  return tableConfig(targetName).columnMap || {};
}

function conflictOf(targetName) {
  return tableConfig(targetName).conflictColumn || 'id';
}

function defaultIdMode() {
  return config.defaultIdMode || 'identity';
}

function idModeOf(targetName) {
  return tableConfig(targetName).idMode || defaultIdMode();
}

const tablesInSqlite = getTables(db);
if (tablesInSqlite.length === 0) {
  console.error('[ERROR] Tidak ada tabel ditemukan di database SQLite.');
  process.exit(1);
}

if (LIST_TABLES || INSPECT) {
  console.log('\n=== TABEL DI SQLite ===');
  for (const t of tablesInSqlite) {
    const cols = getColumns(db, t);
    const count = getRowCount(db, t);
    console.log(`\n[${t}] (${count} baris)`);
    console.log(`  Kolom: ${cols.join(', ')}`);
    if (INSPECT) {
      try {
        const sample = toArray(db.query(`SELECT * FROM "${t}" LIMIT 1`));
        if (sample.length) {
          console.log('  Contoh baris pertama:');
          console.log('  ' + JSON.stringify(sample[0]));
        } else {
          console.log('  (kosong)');
        }
      } catch {
        console.log('  (tidak dapat membaca contoh baris)');
      }
    }
  }
  db.close();
  process.exit(0);
}

const needsSupabase = !SCHEMA_ONLY && !DRY_RUN;
const supabaseClient =
  supabaseUrlFromEnv && serviceRoleKey
    ? createClient(
        supabaseUrlFromEnv.startsWith('http') ? supabaseUrlFromEnv : `https://${supabaseUrlFromEnv}`,
        serviceRoleKey
      )
    : null;

if (needsSupabase && !supabaseClient) {
  console.error('[ERROR] SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi untuk migrasi data.');
  console.error('        Untuk simulasi saja, gunakan flag --dry-run.');
  process.exit(1);
}

const finalTargets = config.tableOrder
  ? config.tableOrder
  : tablesInSqlite.filter((t) => ['sessions', 'frame_records'].includes(t));

const migrationPlan = finalTargets.map((targetName) => {
  const cfg = tableConfig(targetName);
  const sourceTable = cfg.sourceTable || targetName;
  const sourceExists = tablesInSqlite.includes(sourceTable);
  return {
    targetName,
    sourceTable,
    sourceExists,
    rowCount: sourceExists ? getRowCount(db, sourceTable) : 0,
  };
});

console.log('\n=== RENCANA MIGRASI ===');
for (const p of migrationPlan) {
  if (p.sourceExists) {
    console.log(`  [${p.targetName}] <- [${p.sourceTable}]  (${p.rowCount} baris)`);
  } else {
    console.log(`  [!] [${p.targetName}] <- [${p.sourceTable}]  (tabel sumber TIDAK ADA, dilewati)`);
  }
}

if (DRY_RUN) {
  console.log('\n[DRY-RUN] Tidak ada perubahan yang ditulis ke Supabase.');
  for (const p of migrationPlan) {
    if (!p.sourceExists) continue;
    const srcCols = getColumns(db, p.sourceTable);
    const colMap = columnMapOf(p.targetName);
    const mapping = srcCols.map((c) => `${c} -> ${colMap[c] || c}`);
    console.log(`\n[${p.targetName}]`);
    console.log(`  Pemetaan: ${mapping.join(', ')}`);
    console.log(`  ID mode : ${idModeOf(p.targetName)}`);
  }
  db.close();
  process.exit(0);
}

async function ensureSchema() {
  if (!connectionString) {
    console.warn('\n[WARN] SUPABASE_CONNECTION_STRING tidak diisi. Schema tidak diverifikasi otomatis.');
    console.warn('        Pastikan tabel "sessions", "frame_records", dan RPC "get_sessions_validation_counts"');
    console.warn('        sudah dibuat manual (file: scripts/db-migration/supabase_schema.sql).');
    return;
  }
  const schemaSqlPath = resolve(__dirname, 'supabase_schema.sql');
  if (!existsSync(schemaSqlPath)) return;
  console.log('\n[SCHEMA] Mencoba inisialisasi/verifikasi schema via psql...');
  let psqlAvailable = false;
  try {
    execFileSync('psql', ['--version'], { encoding: 'utf-8' });
    psqlAvailable = true;
  } catch {
    psqlAvailable = false;
  }
  if (!psqlAvailable) {
    console.warn('        psql tidak tersedia di server. Jalankan supabase_schema.sql manual di SQL Editor.');
    return;
  }
  try {
    execFileSync('psql', [connectionString, '-v', 'ON_ERROR_STOP=1', '-f', schemaSqlPath], { stdio: 'inherit' });
    console.log('[SCHEMA] Schema siap.');
  } catch (e) {
    console.error('[SCHEMA] Gagal: ' + (e.stderr ? String(e.stderr).trim() : e.message));
  }
}

async function upsertRows(client, targetName, rows) {
  const conflict = conflictOf(targetName);
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await client.from(targetName).upsert(chunk, {
      onConflict: conflict,
      ignoreDuplicates: false,
    });
    if (error) throw new Error(`Upsert ke [${targetName}] gagal: ${error.message}`);
  }
}

function fkColumnsOf(targetName) {
  return (config.remapReferences || []).filter((r) => r.table === targetName).map((r) => r.column);
}

async function migrateTable(client, targetName, sourceTable, foreignIdMap) {
  const srcCols = getColumns(db, sourceTable);
  const rows = toArray(db.query(`SELECT * FROM "${sourceTable}"`));

  if (rows.length === 0) {
    console.log(`[MIGRATE] [${targetName}] 0 baris, dilewati.`);
    return;
  }

  const idMode = idModeOf(targetName);
  const conflict = conflictOf(targetName);
  const fkCols = fkColumnsOf(targetName);
  const boolCols = booleanColumns();
  let ownIdMap = new Map();

  if (idMode === 'uuid') {
    for (const r of rows) {
      const old = r[conflict];
      if (old !== null && old !== undefined && typeof old !== 'string' && !ownIdMap.has(String(old))) {
        ownIdMap.set(String(old), randomUUID());
      }
    }
  }

  const mapped = rows.map((row) => {
    const out = {};
    for (const c of srcCols) {
      const target = columnMapOf(targetName)[c] || c;
      if (!target) continue;
      let value = normalizeValue(row[c]);

      if (idMode === 'uuid' && target === conflict) {
        const rewritten = ownIdMap.get(String(row[c]));
        if (rewritten) value = rewritten;
      } else if (idMode === 'uuid' && fkCols.includes(target)) {
        const rewritten = foreignIdMap ? foreignIdMap.get(String(row[c])) : null;
        if (rewritten) value = rewritten;
      }

      if (value !== null && value !== undefined && looksLikeDateColumn(target)) {
        value = toIso(value);
      }
      if (boolCols.includes(target)) {
        value = toBoolean(value);
      }
      out[target] = value;
    }
    return out;
  });

  console.log(`[MIGRATE] [${targetName}] mengunggah ${mapped.length} baris...`);
  await upsertRows(client, targetName, mapped);
  console.log(`[MIGRATE] [${targetName}] selesai.`);

  return ownIdMap;
}

await ensureSchema();
if (SCHEMA_ONLY) {
  console.log('\n[SELESAI] Mode --schema-only. Data tidak dimigrasikan.');
  db.close();
  process.exit(0);
}

console.log('\n=== MULAI MIGRASI DATA ===');
const primaryIdMaps = new Map();
const migratedPrimary = new Set();
const fkConsumerTables = new Set((config.remapReferences || []).map((r) => r.table));

for (const p of migrationPlan) {
  if (!p.sourceExists) continue;
  if (fkConsumerTables.has(p.targetName)) {
    console.log(`[MIGRATE] [${p.targetName}] ditunda (tabel relasi, dimigrasikan setelah tabel induk).`);
    continue;
  }
  try {
    const ownIdMap = await migrateTable(supabaseClient, p.targetName, p.sourceTable, new Map());
    primaryIdMaps.set(p.targetName, ownIdMap);
    migratedPrimary.add(p.targetName);
  } catch (e) {
    console.error(`[ERROR] Migrasi [${p.targetName}] gagal: ${e.message}`);
    console.error('        Jalankan --inspect untuk melihat struktur & contoh data aktual.');
    db.close();
    process.exit(1);
  }
}

for (const p of migrationPlan) {
  if (!p.sourceExists || migratedPrimary.has(p.targetName) || fkConsumerTables.has(p.targetName)) continue;
  try {
    await migrateTable(supabaseClient, p.targetName, p.sourceTable, null);
  } catch (e) {
    console.error(`[ERROR] Migrasi [${p.targetName}] gagal: ${e.message}`);
    db.close();
    process.exit(1);
  }
}

for (const ref of config.remapReferences || []) {
  if (!tablesInSqlite.includes(ref.table)) continue;
  const foreignIdMap = primaryIdMaps.get(ref.fromTable) || new Map();
  try {
    await migrateTable(supabaseClient, ref.table, ref.table, foreignIdMap);
  } catch (e) {
    console.error(`[ERROR] Migrasi [${ref.table}] gagal: ${e.message}`);
    db.close();
    process.exit(1);
  }
}

db.close();
console.log('\n=== MIGRASI SELESAI ===');
console.log(`Database SQLite (${basename(sqliteDbPath)}) berhasil disinkronkan ke Supabase.`);
if (migrationPlan.some((p) => !p.sourceExists)) {
  console.log('\nBeberapa target tabel tidak ditemukan di SQLite dan dilewati.');
}