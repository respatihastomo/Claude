import { Consumer, Kafka, logLevel, Producer } from 'kafkajs';
import type { Broker, PenanganEvent } from './broker';
import type { CloudEvent } from './cloud-event';

/**
 * Adapter Kafka/Redpanda. Pesan = CloudEvent JSON; key = subject (agregat) agar urutan per agregat terjaga.
 * Offset di-commit setelah penangan sukses (at-least-once); idempotensi dijamin inbox_processed di sisi konsumen.
 */
export class KafkaBroker implements Broker {
  private readonly kafka: Kafka;
  private producer?: Producer;
  private readonly consumers: Consumer[] = [];
  private readonly langganan: Array<{ topik: string; grup: string; penangan: PenanganEvent }> = [];

  constructor(brokers: string[], private readonly clientId: string) {
    this.kafka = new Kafka({ clientId, brokers, logLevel: logLevel.WARN });
  }

  async publish(topik: string, event: CloudEvent): Promise<void> {
    if (!this.producer) throw new Error('KafkaBroker belum start()');
    await this.producer.send({
      topic: topik,
      messages: [{
        key: event.subject ?? event.id,
        value: JSON.stringify(event),
        headers: { 'ce_id': event.id, 'ce_type': event.type, ...(event.traceparent ? { traceparent: event.traceparent } : {}) },
      }],
    });
  }

  async subscribe(topik: string, grup: string, penangan: PenanganEvent): Promise<void> {
    this.langganan.push({ topik, grup, penangan });
  }

  async start(): Promise<void> {
    this.producer = this.kafka.producer({ idempotent: true, maxInFlightRequests: 1 });
    await this.producer.connect();
    for (const { topik, grup, penangan } of this.langganan) {
      const c = this.kafka.consumer({ groupId: grup });
      await c.connect();
      await c.subscribe({ topic: topik, fromBeginning: true });
      await c.run({
        autoCommit: true,
        eachMessage: async ({ message }) => {
          if (!message.value) return;
          await penangan(JSON.parse(message.value.toString('utf8')) as CloudEvent);
        },
      });
      this.consumers.push(c);
    }
  }

  async stop(): Promise<void> {
    await Promise.all(this.consumers.map((c) => c.disconnect()));
    await this.producer?.disconnect();
  }
}
