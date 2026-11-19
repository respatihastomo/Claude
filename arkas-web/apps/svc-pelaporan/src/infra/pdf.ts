/** Port pembuat PDF dari HTML. Produksi: Gotenberg (3.3); dev: Chromium lokal lewat Playwright. */
export interface PembuatPdf {
  buat(html: string): Promise<Buffer>;
  tutup(): Promise<void>;
}

/** Gotenberg 8: POST /forms/chromium/convert/html dengan berkas index.html (multipart). Hanya dapat dijangkau svc-pelaporan (NetworkPolicy). */
export class GotenbergPdf implements PembuatPdf {
  constructor(private readonly url: string, private readonly timeoutMs = 60_000) {}
  async buat(html: string): Promise<Buffer> {
    const form = new FormData();
    form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
    form.append('landscape', 'true');
    form.append('printBackground', 'true');
    const res = await fetch(`${this.url.replace(/\/$/, '')}/forms/chromium/convert/html`, { method: 'POST', body: form, signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) throw new Error(`Gotenberg HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return Buffer.from(await res.arrayBuffer());
  }
  async tutup(): Promise<void> {}
}

interface Peramban { newPage(): Promise<{ setContent(h: string, o: object): Promise<void>; pdf(o: object): Promise<Buffer>; close(): Promise<void> }>; close(): Promise<void> }

/** Dev: Chromium via Playwright yang terpasang di mesin (tidak menjadi dependensi paket). */
export class ChromiumPdf implements PembuatPdf {
  private peramban?: Promise<Peramban>;
  private muat(): Promise<Peramban> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    this.peramban ??= (require('playwright') as { chromium: { launch(o?: object): Promise<Peramban> } }).chromium.launch();
    return this.peramban;
  }
  async buat(html: string): Promise<Buffer> {
    const p = await (await this.muat()).newPage();
    try {
      await p.setContent(html, { waitUntil: 'load' });
      return await p.pdf({ format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });
    } finally {
      await p.close();
    }
  }
  async tutup(): Promise<void> {
    if (this.peramban) await (await this.peramban).close();
  }
}
