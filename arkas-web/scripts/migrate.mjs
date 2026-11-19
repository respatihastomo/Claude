#!/usr/bin/env node
// Menjalankan migrasi SQL satu layanan: node scripts/migrate.mjs svc-penatausahaan [--seed] [--fresh]
// DATABASE_ADMIN_URL : koneksi superuser/DBA (default postgres://postgres@localhost:5432/postgres)
// DB_NAME            : nama basis data layanan (bawaan per layanan, lihat LAYANAN)
// API_DB_PASSWORD / WORKER_DB_PASSWORD : kata sandi role login layanan
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const svc = process.argv[2];
if (!svc) { console.error('pakai: migrate.mjs <svc-nama> [--seed] [--fresh]'); process.exit(2); }
const seed = process.argv.includes('--seed');
const fresh = process.argv.includes('--fresh');
const adminUrl = process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres@localhost:5432/postgres';
const LAYANAN = {
  'svc-penatausahaan': { db: 'db_tatausaha', api: 'api_tatausaha_login', worker: 'worker_tatausaha_login' },
  'svc-pelaporan': { db: 'db_pelaporan', api: 'api_pelaporan_login', worker: 'worker_pelaporan_login' },
  'svc-perencanaan': { db: 'db_perencanaan', api: 'api_perencanaan_login', worker: 'worker_perencanaan_login' },
  'svc-identitas': { db: 'db_auth', api: 'api_auth_login', worker: 'worker_auth_login' },
  'svc-referensi': { db: 'db_ref', api: 'api_ref_login', worker: 'worker_ref_login' },
  'svc-audit': { db: 'db_audit', api: 'api_audit_login', worker: 'worker_audit_login' },
  'svc-integrasi': { db: 'db_integrasi', api: 'api_integrasi_login', worker: 'worker_integrasi_login' },
  'svc-pemantauan': { db: 'db_pemantauan', api: 'api_pemantauan_login', worker: 'worker_pemantauan_login' },
};
const lay = LAYANAN[svc];
if (!lay) { console.error(`layanan tidak dikenal: ${svc}`); process.exit(2); }
const dbName = process.env.DB_NAME ?? lay.db;
if (!/^[a-z_][a-z0-9_]*$/.test(dbName)) throw new Error('DB_NAME tidak valid');
const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'db', svc, 'migrations');

// `-- #sertakan _bersama/x.sql skema` -> isi db/_bersama/x.sql dengan {{skema}} diganti (templat lintas layanan).
const dbDir = path.resolve(dir, '..', '..');
const sertakan = (sql) => sql.replace(/^-- #sertakan (\S+) ([a-z_]+)\s*$/gm, (_, f, skema) =>
  fs.readFileSync(path.join(dbDir, f), 'utf8').replaceAll('{{skema}}', skema));

const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
if (fresh) {
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
}
const ada = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
if (ada.rowCount === 0) {
  await admin.query(`CREATE DATABASE ${dbName}`);
  console.log(`basis data ${dbName} dibuat`);
}
await admin.end();

const url = new URL(adminUrl);
url.pathname = '/' + dbName;
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().filter((f) => seed || !f.startsWith('9'));
for (const f of files) {
  process.stdout.write(`menjalankan ${f} ... `);
  await db.query(sertakan(fs.readFileSync(path.join(dir, f), 'utf8')));
  console.log('ok');
}
const sandiApi = process.env.API_DB_PASSWORD ?? 'api_dev';
const sandiWorker = process.env.WORKER_DB_PASSWORD ?? 'worker_dev';
const lit = (v) => pg.Client.prototype.escapeLiteral(v);
await db.query(`ALTER ROLE ${lay.api} PASSWORD ${lit(sandiApi)}`);
await db.query(`ALTER ROLE ${lay.worker} PASSWORD ${lit(sandiWorker)}`);
await db.query(`GRANT CONNECT ON DATABASE ${dbName} TO ${lay.api}, ${lay.worker}`);
await db.end();
console.log('migrasi selesai');
