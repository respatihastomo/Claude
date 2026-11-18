#!/usr/bin/env node
// Menerbitkan JWT internal untuk pengembangan: node scripts/dev-token.mjs <PERAN> <npsn> [sub-uuid]
import fs from 'node:fs';
import path from 'node:path';
import { createPrivateKey, randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
const [peran = 'BENDAHARA', npsn = '20100001', sub = randomUUID()] = process.argv.slice(2);
const key = createPrivateKey(fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '.dev-keys', 'private.pem')));
const jwt = await new SignJWT({ peran, npsn, direktorat: [] })
  .setProtectedHeader({ alg: 'RS256' }).setSubject(sub).setIssuer('arkas-identitas').setAudience('arkas-api')
  .setIssuedAt().setExpirationTime('8h').sign(key);
process.stdout.write(jwt);
