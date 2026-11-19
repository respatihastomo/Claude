#!/usr/bin/env node
// Dokumen kode sumber per layanan (DOCX). node buat-kode-sumber.cjs [nama-unit]
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, TableOfContents, Header, Footer, PageNumber, VerticalAlign,
} = require('docx');

const AKAR = path.resolve(__dirname, '..', '..');
const BIRU = '1F4E8C';
const MONO = 'Consolas';

/** Satuan dokumen: nama berkas keluaran, judul, dan direktori sumbernya. */
const UNIT = [
  ['svc-referensi', 'svc-referensi — Data Induk & Tarif Pajak', ['apps/svc-referensi/src', 'apps/svc-referensi/test', 'db/svc-referensi/migrations'], 'Referensi nasional: wilayah, sekolah, jenjang, sumber dana, komponen BOSP, kode rekening, tarif pajak pusat dan daerah. Menerbitkan event ReferensiDiubah yang diproyeksikan seluruh layanan lain.'],
  ['svc-identitas', 'svc-identitas — SSO, Sesi, Peran & JWT', ['apps/svc-identitas/src', 'apps/svc-identitas/test', 'db/svc-identitas/migrations'], 'Masuk lewat SSO OIDC, pengelolaan sesi, peran aktif dan cakupannya, penerbitan JWT internal beserta JWKS, serta penambahan pengguna berjenjang.'],
  ['svc-perencanaan', 'svc-perencanaan — Pagu & Kertas Kerja RKAS', ['apps/svc-perencanaan/src', 'apps/svc-perencanaan/test', 'db/svc-perencanaan/migrations'], 'Pagu sekolah, penyusunan kertas kerja beserta validasi juknis, versi perubahan dan pergeseran, penelaahan dan pengesahan Dinas.'],
  ['svc-penatausahaan', 'svc-penatausahaan — BKU, Pajak & Penutupan', ['apps/svc-penatausahaan/src', 'apps/svc-penatausahaan/test', 'db/svc-penatausahaan/migrations'], 'Buku Kas Umum dan buku pembantu, pencatatan penerimaan dan belanja, perhitungan serta penyetoran pajak, rekonsiliasi dan penutupan periode bulanan.'],
  ['svc-pelaporan', 'svc-pelaporan — Laporan BKU & Tanda Tangan', ['apps/svc-pelaporan/src', 'apps/svc-pelaporan/test', 'db/svc-pelaporan/migrations'], 'Pembentukan laporan BKU bulanan dalam PDF setelah periode ditutup, beserta penandatanganan.'],
  ['svc-audit', 'svc-audit — Jejak Audit Berantai Hash', ['apps/svc-audit/src', 'apps/svc-audit/test', 'db/svc-audit/migrations'], 'Jejak audit append-only dari seluruh layanan, dirantai dengan SHA-256 sehingga penyuntingan diam-diam terdeteksi.'],
  ['svc-integrasi', 'svc-integrasi — API Mitra SIPLah', ['apps/svc-integrasi/src', 'apps/svc-integrasi/test', 'db/svc-integrasi/migrations'], 'Antarmuka dua sisi dengan Mitra SIPLah: pembukaan sumber dana dan pengiriman anggaran, serta penerimaan transaksi belanja dengan OAuth2, daftar IP, dan HMAC.'],
  ['svc-pemantauan', 'svc-pemantauan — HPP & Dasbor', ['apps/svc-pemantauan/src', 'apps/svc-pemantauan/test', 'db/svc-pemantauan/migrations'], 'Perbandingan rencana RKAS dengan belanja Mitra (HPP) serta dasbor serapan dan kepatuhan berjenjang.'],
  ['svc-bantuan', 'svc-bantuan — Bantuan Pemerintah', ['apps/svc-bantuan/src', 'apps/svc-bantuan/test', 'db/svc-bantuan/migrations'], 'Bantuan Pemerintah dari penyusunan juknis dan penerima, pengesahan Balai, PKS bank dan penyaluran, sampai pengajuan oleh sekolah.'],
  ['web', 'web — Antarmuka Pengguna & BFF', ['apps/web/app', 'apps/web/components', 'apps/web/lib', 'apps/web/e2e', 'apps/web/middleware.ts'], 'Aplikasi Next.js App Router: halaman seluruh peran, komponen domain, pembungkus API, penjaga sesi, dan BFF yang menukar cookie sesi menjadi JWT internal.'],
  ['packages', 'packages — Aturan, Kontrak & Infrastruktur Bersama', ['packages/aturan/src', 'packages/aturan/test', 'packages/kontrak/src', 'packages/common-ms/src'], 'Tiga paket bersama: aturan bisnis sebagai fungsi murni, skema Zod dan kontrak event, serta infrastruktur lintas layanan (RLS, outbox, inbox, penjaga peran, format galat).'],
  ['infrastruktur', 'infrastruktur — Skrip, Konfigurasi & SQL Bersama', ['scripts', 'db/_bersama', 'package.json', 'turbo.json', 'pnpm-workspace.yaml', 'tsconfig.base.json', 'docker-compose.yml'], 'Skrip migrasi dan pengembangan, templat SQL lintas layanan, serta konfigurasi monorepo.'],
];

const EKST = new Set(['.ts', '.tsx', '.sql', '.mjs', '.js', '.json', '.yml', '.yaml']);
const ABAIKAN = /node_modules|[/\\]dist[/\\]|\.next|tsconfig\.tsbuildinfo|next-env\.d\.ts/;

function kumpulkan(rel) {
  const penuh = path.join(AKAR, rel);
  if (!fs.existsSync(penuh)) return [];
  if (fs.statSync(penuh).isFile()) return [rel];
  const out = [];
  (function jelajah(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (ABAIKAN.test(p)) continue;
      if (e.isDirectory()) jelajah(p);
      else if (EKST.has(path.extname(e.name))) out.push(path.relative(AKAR, p));
    }
  })(penuh);
  return out;
}

/** Keterangan berkas diambil dari komentar pertama. */
function keterangan(isi) {
  for (const baris of isi.split('\n').slice(0, 12)) {
    const t = baris.trim();
    const m = t.match(/^(?:\/\/|--|\/\*\*?|\*)\s*(.+?)\s*(?:\*\/)?$/);
    if (m && m[1] && !/^(eslint|@ts-|#!)/.test(m[1]) && m[1].length > 12) return m[1].replace(/\*\/$/, '').trim();
  }
  return '';
}

const KOMENTAR = /^\s*(\/\/|--|\*|\/\*)/;
function barisKode(teks, nomor) {
  const komentar = KOMENTAR.test(teks);
  return new Paragraph({
    spacing: { after: 0, line: 176 },
    indent: { left: 560, hanging: 560 },
    children: [
      new TextRun({ text: String(nomor).padStart(4, ' ') + '  ', font: MONO, size: 13, color: 'B6C2CF' }),
      new TextRun({ text: teks === '' ? ' ' : teks.replace(/\t/g, '    '), font: MONO, size: 15, color: komentar ? '5C7A52' : '18202A' }),
    ],
  });
}

function dokumen(unit) {
  const [nama, judul, sumber, ringkas] = unit;
  const berkas = sumber.flatMap(kumpulkan);
  const isiBerkas = berkas.map((f) => {
    const teks = fs.readFileSync(path.join(AKAR, f), 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '');
    return { f, teks, baris: teks.split('\n').length, ket: keterangan(teks) };
  });
  const totalBaris = isiBerkas.reduce((a, b) => a + b.baris, 0);
  const anak = [];

  // Sampul
  anak.push(
    new Paragraph({ spacing: { before: 2600, after: 120 }, children: [new TextRun({ text: 'ARKAS WEB · KODE SUMBER', bold: true, size: 20, color: BIRU })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: judul, bold: true, size: 52, color: '0F172A' })] }),
    new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: ringkas, size: 22, color: '475569' })] }),
  );
  const sel = (t, b = false, w = 3200) => new TableCell({ width: { size: w, type: WidthType.DXA }, margins: { top: 70, bottom: 70, left: 120, right: 120 },
    borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'A6B4C8' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'A6B4C8' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'A6B4C8' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'A6B4C8' } },
    shading: b ? { fill: 'E8EEF7', type: ShadingType.CLEAR, color: 'auto' } : undefined, verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: String(t), bold: b, size: 19 })] })] });
  anak.push(new Table({ width: { size: 9638, type: WidthType.DXA }, columnWidths: [3212, 3213, 3213], rows: [
    new TableRow({ children: [sel('Berkas', true), sel('Baris kode', true), sel('Disusun', true)] }),
    new TableRow({ children: [sel(isiBerkas.length), sel(totalBaris.toLocaleString('id-ID')), sel('19 November 2026')] }),
  ] }));
  anak.push(new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: 'Dokumen ini memuat kode sumber apa adanya dari repositori, lengkap dengan nomor baris. Penjelasan arsitektur dan alasan rancangannya ada pada Dokumentasi Pengembangan ARKAS Web.', size: 19, color: '64748B', italics: true })] }));

  // Daftar isi + ringkasan berkas
  anak.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun('Daftar Berkas')] }));
  const selR = (t, b, w, mono) => new TableCell({ width: { size: w, type: WidthType.DXA }, margins: { top: 50, bottom: 50, left: 100, right: 100 },
    borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'C7D2DE' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'C7D2DE' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'C7D2DE' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'C7D2DE' } },
    shading: b ? { fill: 'E8EEF7', type: ShadingType.CLEAR, color: 'auto' } : undefined, verticalAlign: VerticalAlign.CENTER,
    children: String(t).split('\n').map((x) => new Paragraph({ spacing: { after: 0, line: 240 }, children: [new TextRun({ text: x, bold: !!b, size: 17, font: mono ? MONO : undefined })] })) });
  anak.push(new Table({ width: { size: 9638, type: WidthType.DXA }, columnWidths: [4100, 900, 4638], rows: [
    new TableRow({ tableHeader: true, children: [selR('Berkas', true, 4100), selR('Baris', true, 900), selR('Keterangan', true, 4638)] }),
    ...isiBerkas.map((b) => new TableRow({ children: [selR(b.f, false, 4100, true), selR(b.baris, false, 900), selR(b.ket || '—', false, 4638)] })),
  ] }));

  // Listing
  for (const b of isiBerkas) {
    anak.push(new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: true, children: [new TextRun({ text: b.f, font: MONO })] }));
    if (b.ket) anak.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: b.ket, italics: true, size: 19, color: '475569' })] }));
    b.teks.split('\n').forEach((t, i) => anak.push(barisKode(t, i + 1)));
  }

  const doc = new Document({
    creator: 'ARKAS Web', title: `Kode Sumber — ${judul}`, description: ringkas,
    styles: { default: {
      document: { run: { font: 'Calibri', size: 21, color: '1B2733' }, paragraph: { spacing: { line: 280 } } },
      heading1: { run: { font: 'Calibri', size: 34, bold: true, color: BIRU }, paragraph: { spacing: { before: 200, after: 200 }, keepNext: true } },
      heading2: { run: { font: MONO, size: 23, bold: true, color: BIRU }, paragraph: { spacing: { before: 160, after: 100 }, keepNext: true } },
    } },
    sections: [{
      properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 760 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Kode Sumber ARKAS Web · ${nama}`, size: 15, color: '94A3B8' })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Halaman ', size: 16, color: '94A3B8' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '94A3B8' })] })] }) },
      children: anak,
    }],
  });
  return { doc, nama, berkas: isiBerkas.length, baris: totalBaris };
}

(async () => {
  const pilih = process.argv[2];
  for (const unit of UNIT) {
    if (pilih && unit[0] !== pilih) continue;
    const { doc, nama, berkas, baris } = dokumen(unit);
    const out = path.join(__dirname, `Kode-Sumber-${nama}.docx`);
    fs.writeFileSync(out, await Packer.toBuffer(doc));
    console.log(`${path.basename(out).padEnd(42)} ${String(berkas).padStart(3)} berkas  ${String(baris).padStart(5)} baris  ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  }
})();
