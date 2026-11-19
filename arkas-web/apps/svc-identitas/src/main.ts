import { Logger } from '@nestjs/common';
import { buatAplikasi } from './app';
import { muatKonfigurasi } from './config';

async function main() {
  const cfg = muatKonfigurasi();
  const { app, broker, relay } = await buatAplikasi(cfg);
  await broker.start();
  relay.start();
  app.getHttpServer().on('close', () => { relay.stop(); void broker.stop(); });
  await app.listen(cfg.port);
  new Logger('svc-identitas').log(`siap di :${cfg.port} (sso=${cfg.oidc ? cfg.oidc.issuer : 'tidak'}, dev=${cfg.authDev})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
