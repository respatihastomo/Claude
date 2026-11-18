import { Logger } from '@nestjs/common';
import { buatAplikasi } from './app';
import { muatKonfigurasi } from './config';

async function main() {
  const cfg = muatKonfigurasi();
  const { app, broker, relay, pembuat } = await buatAplikasi(cfg);
  await broker.start();
  relay.start();
  pembuat.start(cfg.pembuatIntervalMs);
  app.getHttpServer().on('close', () => { relay.stop(); pembuat.stop(); void broker.stop(); });
  await app.listen(cfg.port);
  new Logger('svc-pelaporan').log(`siap di :${cfg.port} (broker=${cfg.broker}, pdf=${cfg.pdf}, tte=${cfg.tte})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
