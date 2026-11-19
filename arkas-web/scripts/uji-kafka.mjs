#!/usr/bin/env node
// Membuktikan adapter KafkaBroker bekerja terhadap broker sungguhan (Kafka/Redpanda).
// Jalankan setelah broker hidup:  docker compose up -d redpanda
//   node scripts/uji-kafka.mjs                       # bawaan localhost:19092
//   BROKER_BROKERS=host:9092 node scripts/uji-kafka.mjs
// Keluar dengan kode 1 bila ada pemeriksaan yang gagal.
import { randomUUID } from 'node:crypto';
import { KafkaBroker } from '../packages/common-ms/dist/events/kafka-broker.js';

const BROKERS = (process.env.BROKER_BROKERS ?? 'localhost:19092').split(',');
const TOPIK = `arkas.uji.kafka-${Date.now()}`;
const BATAS_MS = Number(process.env.UJI_KAFKA_TIMEOUT_MS ?? 30_000);

const hasil = [];
const periksa = (nama, lulus, catatan = '') => { hasil.push({ nama, lulus, catatan }); console.log(`${lulus ? '  ok  ' : ' GAGAL'}  ${nama}${catatan ? ` — ${catatan}` : ''}`); };

const event = (subject, n) => ({
  specversion: '1.0', id: randomUUID(), source: 'uji-kafka', type: 'arkas.uji.pesan',
  subject, time: new Date().toISOString(), datacontenttype: 'application/json',
  correlationid: randomUUID(), data: { urut: n },
});

/** Menunggu sampai syarat terpenuhi atau batas waktu habis. */
async function tunggu(syarat, pesan) {
  const batas = Date.now() + BATAS_MS;
  while (Date.now() < batas) {
    if (syarat()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  console.error(`batas waktu: ${pesan}`);
  return false;
}

const diterimaA = [];
const diterimaB = [];
const broker = new KafkaBroker(BROKERS, 'uji-kafka');

console.log(`Broker  : ${BROKERS.join(',')}`);
console.log(`Topik   : ${TOPIK}\n`);

await broker.subscribe(TOPIK, `grup-a-${randomUUID()}`, async (e) => { diterimaA.push(e); });
await broker.subscribe(TOPIK, `grup-b-${randomUUID()}`, async (e) => { diterimaB.push(e); });
await broker.start();
periksa('Produser & konsumen tersambung ke broker', true);

const dikirim = [event('20100002', 1), event('20100002', 2), event('20100003', 3)];
for (const e of dikirim) await broker.publish(TOPIK, e);
periksa('Tiga CloudEvent diterbitkan', true);

const sampai = await tunggu(() => diterimaA.length >= 3 && diterimaB.length >= 3, 'pesan tidak lengkap diterima');
periksa('Semua pesan sampai ke konsumen', sampai, `grup-a=${diterimaA.length}, grup-b=${diterimaB.length}`);

const samaIsi = dikirim.every((e) => {
  const t = diterimaA.find((x) => x.id === e.id);
  return t && t.type === e.type && t.subject === e.subject && t.correlationid === e.correlationid && t.data.urut === e.data.urut;
});
periksa('Isi CloudEvent utuh setelah perjalanan (id, type, subject, correlationid, data)', samaIsi);

const fanOut = diterimaB.length >= 3 && dikirim.every((e) => diterimaB.some((x) => x.id === e.id));
periksa('Dua grup konsumen masing-masing menerima seluruh pesan (fan-out)', fanOut);

const urutSekolah = diterimaA.filter((e) => e.subject === '20100002').map((e) => e.data.urut);
periksa('Urutan terjaga per subject (key = agregat)', JSON.stringify(urutSekolah) === JSON.stringify([1, 2]), `urut=${JSON.stringify(urutSekolah)}`);

await broker.stop();
periksa('Koneksi ditutup bersih', true);

const gagal = hasil.filter((h) => !h.lulus);
console.log(`\n${hasil.length - gagal.length}/${hasil.length} pemeriksaan lolos`);
process.exit(gagal.length === 0 ? 0 : 1);
