/** CloudEvents 1.0 (structured mode, JSON). Sama dengan @arkas/kontrak/events; diduplikasi agar common-ms tak bergantung pada kontrak domain. */
export interface CloudEvent<T = unknown> {
  specversion: '1.0';
  id: string;
  source: string;
  type: string;
  subject?: string;
  time: string;
  datacontenttype: 'application/json';
  correlationid?: string;
  traceparent?: string;
  data: T;
}
