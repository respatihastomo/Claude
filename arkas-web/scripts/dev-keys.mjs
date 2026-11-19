#!/usr/bin/env node
// Membuat pasangan kunci RS256 untuk pengembangan (pengganti svc-identitas). Hasil: .dev-keys/{private,public}.pem
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.dev-keys');
if (fs.existsSync(path.join(dir, 'private.pem'))) { console.log('kunci dev sudah ada:', dir); process.exit(0); }
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
fs.writeFileSync(path.join(dir, 'private.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
fs.writeFileSync(path.join(dir, 'public.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
console.log('kunci dev dibuat di', dir);
