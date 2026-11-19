#!/usr/bin/env node
// Menerbitkan JWT internal untuk pengembangan: node scripts/dev-token.mjs <PERAN> <npsn|kode-wilayah> [sub-uuid]
// Peran Dinas (VERIFIKATOR_DINAS, ADMIN_DINAS) memakai argumen kedua sebagai kode wilayah, bukan NPSN.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPrivateKey, randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
const [peran = 'BENDAHARA', npsn = '20100001', sub = randomUUID()] = process.argv.slice(2);
const key = createPrivateKey(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.dev-keys', 'private.pem')));
const dinas = ['VERIFIKATOR_DINAS', 'ADMIN_DINAS'].includes(peran);
const jwt = await new SignJWT({ peran, ...(dinas ? { wilayah: npsn } : { npsn }), direktorat: [] })
  .setProtectedHeader({ alg: 'RS256' }).setSubject(sub).setIssuer('arkas-identitas').setAudience('arkas-api')
  .setIssuedAt().setExpirationTime('8h').sign(key);
process.stdout.write(jwt);
