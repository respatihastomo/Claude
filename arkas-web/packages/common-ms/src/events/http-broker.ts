import type { Broker, PenanganEvent } from './broker';
import type { CloudEvent } from './cloud-event';

/**
 * Broker HTTP untuk PENGEMBANGAN lintas proses (tanpa Kafka): publish = POST CloudEvent ke endpoint internal
 * layanan pelanggan (`/internal/v1/events`). Respons non-2xx dilempar sehingga Outbox Relay mencoba ulang
 * (at-least-once); idempotensi dijamin inbox_processed di pelanggan. Event yang diterima diserahkan ke pelanggan lokal.
 *
 * targets: topik -> daftar URL pelanggan. Format env: "topik=url,url2;topik2=url3".
 */
export class HttpBroker implements Broker {
  private readonly lokal = new Map<string, PenanganEvent[]>();

  constructor(private readonly targets: Record<string, string[]>, private readonly token: string, private readonly timeoutMs = 10_000) {}

  static uraiTargets(s: string): Record<string, string[]> {
    const hasil: Record<string, string[]> = {};
    for (const bagian of s.split(';').map((x) => x.trim()).filter(Boolean)) {
      const [topik, urls] = bagian.split('=');
      if (!topik || !urls) throw new Error(`BROKER_HTTP_TARGETS tidak valid: ${bagian}`);
      hasil[topik.trim()] = urls.split(',').map((u) => u.trim()).filter(Boolean);
    }
    return hasil;
  }

  async publish(topik: string, event: CloudEvent): Promise<void> {
    for (const url of this.targets[topik] ?? []) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-token': this.token, ...(event.traceparent ? { traceparent: event.traceparent } : {}) },
        body: JSON.stringify({ topik, event }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) throw new Error(`kirim ${event.type} ke ${url} gagal: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
  }

  async subscribe(topik: string, _grup: string, penangan: PenanganEvent): Promise<void> {
    this.lokal.set(topik, [...(this.lokal.get(topik) ?? []), penangan]);
  }

  async serahkanLokal(topik: string, event: CloudEvent): Promise<void> {
    for (const p of this.lokal.get(topik) ?? []) await p(event);
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
}
