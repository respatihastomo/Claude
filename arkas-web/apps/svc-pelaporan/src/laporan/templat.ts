import type { BarisLaporan, Ringkasan } from './bku';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const rpFmt = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const rp = (n: number) => (n < 0 ? `-Rp ${rpFmt.format(-n)}` : `Rp ${rpFmt.format(n)}`);
const tgl = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const waktu = (iso: string) => `${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso))} WIB`;

/** Escape HTML untuk SEMUA teks yang berasal dari data (uraian, nama toko, penjelasan) agar tidak menjadi markup. */
export function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export interface DataLaporan {
  npsn: string; tahun: number; bulan: number; sumberDanaKode: string;
  ringkasan: Ringkasan;
  rekonsiliasi: { saldoRekeningKoran: number; selisihBank: number; penjelasanBank: string | null; kasFisik: number; selisihKas: number; penjelasanKas: string | null };
  baris: BarisLaporan[];
  diajukanOleh: string; ditutupOleh: string; ditutupAt: string; dibuatAt: string;
  /** diisi saat ditandatangani */
  tte?: { oleh: string; at: string; sha256Asli: string; penyedia: 'SIMULASI_DEV' | 'BSRE' };
}

/** Templat HTML laporan BKU bulanan (dirender ke PDF oleh Gotenberg/Chromium). */
export function htmlLaporanBku(d: DataLaporan): string {
  const r = d.ringkasan;
  const k = d.rekonsiliasi;
  const judul = `Laporan Buku Kas Umum — ${BULAN[d.bulan - 1]} ${d.tahun}`;
  const baris = d.baris.map((b) => `<tr>
      <td>${tgl(b.tanggal)}</td><td>${esc(b.noBukti ?? '')}</td><td>${esc(b.kodeRekening ?? '')}</td><td>${esc(b.uraian)}</td>
      <td>${b.buku === 'TUNAI' ? 'Tunai' : 'Bank'}</td><td class="n">${b.penerimaan ? rp(b.penerimaan) : ''}</td>
      <td class="n">${b.pengeluaran ? rp(b.pengeluaran) : ''}</td><td class="n">${rp(b.saldo)}</td></tr>`).join('');
  const saldoAwal = r.tunai.saldoAwal + r.bank.saldoAwal;
  const tte = d.tte
    ? `<div class="tte ${d.tte.penyedia === 'SIMULASI_DEV' ? 'sim' : ''}">
        <b>${d.tte.penyedia === 'SIMULASI_DEV' ? 'SIMULASI TANDA TANGAN ELEKTRONIK — LINGKUNGAN PENGEMBANGAN, BUKAN TTE YANG SAH' : 'Ditandatangani secara elektronik (BSrE)'}</b><br>
        Oleh: Kepala Sekolah (ID ${esc(d.tte.oleh)})<br>Waktu: ${esc(waktu(d.tte.at))}<br>SHA-256 dokumen asli: <span class="mono">${esc(d.tte.sha256Asli)}</span></div>`
    : '<div class="draf">DRAF — BELUM DITANDATANGANI</div>';
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(judul)}</title><style>
  @page { size: A4 landscape; margin: 14mm 12mm; }
  body { font-family: "Inter", "DejaVu Sans", Arial, sans-serif; font-size: 9.5pt; color: #0F172A; }
  h1 { font-size: 15pt; margin: 0 0 2mm; } h2 { font-size: 11pt; margin: 6mm 0 2mm; }
  .meta { color: #475569; margin-bottom: 4mm; } .mono { font-family: "DejaVu Sans Mono", monospace; font-size: 8pt; }
  table { width: 100%; border-collapse: collapse; } th, td { border: 0.6pt solid #CBD5E1; padding: 1.4mm 2mm; vertical-align: top; }
  th { background: #F1F5F9; text-align: left; font-size: 8.5pt; } .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .ringkas td:first-child { font-weight: 600; } tfoot td { font-weight: 700; background: #F1F5F9; }
  .ttd { display: flex; justify-content: space-between; margin-top: 10mm; } .ttd div { width: 70mm; text-align: center; }
  .ttd .ruang { height: 18mm; }
  .draf { position: fixed; top: 40%; left: 15%; font-size: 40pt; color: rgba(201,42,42,0.12); transform: rotate(-18deg); font-weight: 800; }
  .tte { margin-top: 6mm; border: 1pt solid #0E8A3E; padding: 3mm; background: #F0FDF4; }
  .tte.sim { border-color: #B45309; background: #FFFBEB; }
  .utuh { break-inside: avoid; page-break-inside: avoid; } tr { break-inside: avoid; }
  </style></head><body>
  ${tte.includes('class="draf"') ? tte : ''}
  <h1>${esc(judul)}</h1>
  <div class="meta">NPSN ${esc(d.npsn)} · Sumber dana ${esc(d.sumberDanaKode)} · Buku ditutup ${esc(waktu(d.ditutupAt))} · Dicetak ${esc(waktu(d.dibuatAt))}</div>

  <h2>Ringkasan</h2>
  <table class="ringkas"><thead><tr><th>Buku</th><th class="n">Saldo awal</th><th class="n">Penerimaan</th><th class="n">Pengeluaran</th><th class="n">Saldo akhir</th></tr></thead><tbody>
    <tr><td>Kas tunai</td><td class="n">${rp(r.tunai.saldoAwal)}</td><td class="n">${rp(r.tunai.penerimaan)}</td><td class="n">${rp(r.tunai.pengeluaran)}</td><td class="n">${rp(r.tunai.saldoAkhir)}</td></tr>
    <tr><td>Bank</td><td class="n">${rp(r.bank.saldoAwal)}</td><td class="n">${rp(r.bank.penerimaan)}</td><td class="n">${rp(r.bank.pengeluaran)}</td><td class="n">${rp(r.bank.saldoAkhir)}</td></tr>
    <tr><td>Pajak (BKP)</td><td class="n">${rp(r.pajak.saldoAwal)}</td><td class="n">${rp(r.pajak.dipungut)}</td><td class="n">${rp(r.pajak.disetor)}</td><td class="n">${rp(r.pajak.saldoAkhir)}</td></tr>
  </tbody></table>

  <h2>Buku Kas Umum</h2>
  <table><thead><tr><th>Tanggal</th><th>No. bukti</th><th>Kode rekening</th><th>Uraian</th><th>Buku</th><th class="n">Penerimaan</th><th class="n">Pengeluaran</th><th class="n">Saldo</th></tr></thead>
  <tbody><tr><td colspan="7">Saldo awal bulan</td><td class="n">${rp(saldoAwal)}</td></tr>${baris}</tbody>
  <tfoot><tr><td colspan="5">Jumlah (${r.jumlahTransaksi} transaksi)</td><td class="n">${rp(r.tunai.penerimaan + r.bank.penerimaan)}</td><td class="n">${rp(r.tunai.pengeluaran + r.bank.pengeluaran)}</td><td class="n">${rp(r.tunai.saldoAkhir + r.bank.saldoAkhir)}</td></tr></tfoot></table>

  <section class="utuh">
  <h2>Berita Acara Pemeriksaan Kas &amp; Rekonsiliasi Bank</h2>
  <table class="ringkas"><tbody>
    <tr><td>Saldo buku bank</td><td class="n">${rp(r.bank.saldoAkhir)}</td><td>Saldo rekening koran</td><td class="n">${rp(k.saldoRekeningKoran)}</td><td>Selisih</td><td class="n">${rp(k.selisihBank)}</td></tr>
    <tr><td>Saldo buku tunai</td><td class="n">${rp(r.tunai.saldoAkhir)}</td><td>Hasil hitung kas fisik</td><td class="n">${rp(k.kasFisik)}</td><td>Selisih</td><td class="n">${rp(k.selisihKas)}</td></tr>
  </tbody></table>
  ${k.penjelasanBank ? `<p><b>Penjelasan selisih bank:</b> ${esc(k.penjelasanBank)}</p>` : ''}
  ${k.penjelasanKas ? `<p><b>Penjelasan selisih kas:</b> ${esc(k.penjelasanKas)}</p>` : ''}

  <div class="ttd">
    <div>Bendahara<div class="ruang"></div><span class="mono">ID ${esc(d.diajukanOleh)}</span></div>
    <div>Mengetahui, Kepala Sekolah<div class="ruang"></div><span class="mono">ID ${esc(d.ditutupOleh)}</span></div>
  </div>
  ${d.tte ? tte : ''}
  </section>
  </body></html>`;
}
