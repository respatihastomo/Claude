import type { CloudEvent } from './cloud-event';

export type PenanganEvent = (event: CloudEvent) => Promise<void>;

/** Port Message Broker (Kafka/RabbitMQ, Keputusan terbuka 19.1). Layanan hanya bergantung pada antarmuka ini. */
export interface Broker {
  publish(topik: string, event: CloudEvent): Promise<void>;
  subscribe(topik: string, grup: string, penangan: PenanganEvent): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  /**
   * Menyerahkan event yang DITERIMA dari luar proses (endpoint internal) ke pelanggan lokal.
   * Galat penangan dilempar agar pengirim mencoba ulang. Tidak ada di adapter yang menerima sendiri dari broker (Kafka).
   */
  serahkanLokal?(topik: string, event: CloudEvent): Promise<void>;
}

/**
 * Broker dalam-proses untuk pengembangan lokal & pengujian. Semantik at-least-once disimulasikan:
 * penangan yang gagal dicoba ulang (maks 5x) lalu dicatat ke `mati` (dead letter).
 */
export class MemoryBroker implements Broker {
  private readonly pelanggan = new Map<string, Array<{ grup: string; penangan: PenanganEvent }>>();
  readonly terbit: Array<{ topik: string; event: CloudEvent }> = [];
  readonly mati: Array<{ topik: string; grup: string; event: CloudEvent; galat: string }> = [];

  async publish(topik: string, event: CloudEvent): Promise<void> {
    this.terbit.push({ topik, event });
    for (const { grup, penangan } of this.pelanggan.get(topik) ?? []) {
      let galat = '';
      for (let i = 0; i < 5; i++) {
        try { await penangan(event); galat = ''; break; } catch (e) { galat = e instanceof Error ? e.message : String(e); }
      }
      if (galat) this.mati.push({ topik, grup, event, galat });
    }
  }

  async subscribe(topik: string, grup: string, penangan: PenanganEvent): Promise<void> {
    const daftar = this.pelanggan.get(topik) ?? [];
    daftar.push({ grup, penangan });
    this.pelanggan.set(topik, daftar);
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  async serahkanLokal(topik: string, event: CloudEvent): Promise<void> {
    for (const { penangan } of this.pelanggan.get(topik) ?? []) await penangan(event);
  }
}
