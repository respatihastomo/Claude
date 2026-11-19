import { Logger } from '@nestjs/common';
import { buatAplikasi } from './app';
import { muatKonfigurasi } from './config';

async function main() {
  const cfg = muatKonfigurasi();
  const { app, broker, relay, impor } = await buatAplikasi(cfg);
  await broker.start();
  relay.start();
  impor.start(cfg.imporIntervalMs);
  app.getHttpServer().on('close', () => { relay.stop(); impor.stop(); void broker.stop(); });
  await app.listen(cfg.port);
  new Logger('svc-bantuan').log(`siap di :${cfg.port} (broker=${cfg.broker})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
