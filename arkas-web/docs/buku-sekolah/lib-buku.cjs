// Pustaka bersama Buku Panduan & Buku Tutorial ARKAS Web untuk Sekolah (docx-js).
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, TableOfContents, Footer, Header, PageNumber, LevelFormat, VerticalAlign,
} = require('docx');

const BIRU = '1F4E8C';
const FONT = 'Calibri';
const DIR_BAWAAN = { gambar: path.join(__dirname, 'gambar'), diagram: path.join(__dirname, 'diagram') };

function buatBuku(judulHeader, opsi = {}) {
  const DIR = { ...DIR_BAWAAN, ...(opsi.dir ?? {}) };
  const polaDiagram = opsi.polaDiagram ?? /^d\d/;
  let bab = 0; let nomorGambar = 0; let sub = ''; let daftarNomor = 0;
  const anak = []; const nomorRefs = [];
  const tambah = (...x) => anak.push(...x);

  /** teks inline: **tebal**, *miring*, `kode`, [[tombol]] */
  function runs(teks, dasar = {}) {
    const out = []; const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\[[^\]]+\]\])/g; let i = 0; let m;
    while ((m = re.exec(teks))) {
      if (m.index > i) out.push(new TextRun({ text: teks.slice(i, m.index), ...dasar }));
      const t = m[0];
      if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...dasar }));
      else if (t.startsWith('`')) out.push(new TextRun({ text: t.slice(1, -1), font: 'Consolas', ...dasar }));
      else if (t.startsWith('[[')) out.push(new TextRun({ text: ` ${t.slice(2, -2)} `, bold: true, color: 'FFFFFF', shading: { type: ShadingType.CLEAR, fill: BIRU, color: 'auto' }, ...dasar }));
      else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...dasar }));
      i = m.index + t.length;
    }
    if (i < teks.length) out.push(new TextRun({ text: teks.slice(i), ...dasar }));
    return out;
  }
  const ukuranPng = (f) => { const b = fs.readFileSync(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), data: b }; };

  const B = {
    get bab() { return bab; }, runs, tambah,
    H1(judul, nomor = true) {
      if (nomor) { bab += 1; nomorGambar = 0; }
      tambah(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(nomor ? `Bab ${bab}. ${judul}` : judul)] }));
    },
    H2(judul, putus = false) { sub = judul; tambah(new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: putus, children: [new TextRun(judul)] })); },
    H3(judul) { tambah(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(judul)] })); },
    P(teks) { tambah(new Paragraph({ children: runs(teks), spacing: { after: 140, line: 300 } })); },
    LI(items) { items.forEach((t) => tambah(new Paragraph({ numbering: { reference: 'poin', level: 0 }, children: runs(t), spacing: { after: 80, line: 290 } }))); },
    OL(items) {
      daftarNomor += 1; const ref = `nomor-${daftarNomor}`; nomorRefs.push(ref);
      items.forEach((t) => tambah(new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 90, line: 290 } })));
    },
    /** gambar dari folder gambar/ (tangkapan layar) atau diagram/ (awalan d) */
    GAMBAR(file, keterangan, lebarCm = 16.5, maksTinggiCm = 21) {
      const full = path.join(polaDiagram.test(file) ? DIR.diagram : DIR.gambar, file.endsWith('.png') ? file : `${file}.png`);
      const { w, h, data } = ukuranPng(full);
      const maxW = Math.round(lebarCm / 2.54 * 96); const maxH = Math.round(maksTinggiCm / 2.54 * 96);
      let tw = maxW; let th = Math.round(h * maxW / w);
      if (th > maxH) { th = maxH; tw = Math.round(w * maxH / h); }
      nomorGambar += 1;
      tambah(
        new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 },
          children: [new ImageRun({ type: 'png', data, transformation: { width: tw, height: th }, altText: { title: keterangan, description: keterangan, name: path.basename(full) } })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 },
          children: [new TextRun({ text: `Gambar ${bab}.${nomorGambar}  `, bold: true, size: 18, color: '555555' }), ...runs(keterangan, { italics: true, size: 18, color: '555555' })] }),
      );
      return `Gambar ${bab}.${nomorGambar}`;
    },
    get gambarBerikut() { return `Gambar ${bab}.${nomorGambar + 1}`; },
    KOTAK(jenis, teks) {
      const GAYA = { TIPS: ['E8F5E9', '2E7D32', '💡 Tips'], PENTING: ['FFF3E0', 'E65100', '⚠️ Penting'], INGAT: ['E8F0FB', BIRU, '📌 Ingat'], CONTOH: ['F3F0FF', '5B3FB4', '✏️ Contoh'],
        RINGKAS: ['EEF2F7', '334155', '🧭 Di bab ini'], CEK: ['FDF4E7', '9A5B00', '✅ Cek pemahaman'], LATIHAN: ['E6F7F5', '0F766E', '🏋️ Latihan'] };
      const [isi, garis, label] = GAYA[jenis];
      const paragraf = (Array.isArray(teks) ? teks : [teks]).map((t, i) => new Paragraph({ spacing: { after: 40, line: 290 },
        children: i === 0 ? [new TextRun({ text: `${label}  `, bold: true, color: garis }), ...runs(t)] : [new TextRun({ text: '•  ', color: garis, bold: true }), ...runs(t)] }));
      const sel = new TableCell({
        width: { size: 9638, type: WidthType.DXA }, shading: { fill: isi, type: ShadingType.CLEAR, color: 'auto' }, margins: { top: 110, bottom: 110, left: 200, right: 200 },
        borders: { left: { style: BorderStyle.SINGLE, size: 28, color: garis }, top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
        children: paragraf,
      });
      tambah(new Table({ width: { size: 9638, type: WidthType.DXA }, columnWidths: [9638], rows: [new TableRow({ cantSplit: true, children: [sel] })] }), new Paragraph({ spacing: { after: 120 }, children: [] }));
    },
    TABEL(kepala, baris, lebar, warnaKepala = 'E8EEF7') {
      const total = lebar.reduce((a, b) => a + b, 0);
      const g = { style: BorderStyle.SINGLE, size: 4, color: 'A6B4C8' }; const b = { top: g, bottom: g, left: g, right: g };
      const sel = (t, i, head) => new TableCell({ width: { size: lebar[i], type: WidthType.DXA }, borders: b, margins: { top: 60, bottom: 60, left: 100, right: 100 }, verticalAlign: VerticalAlign.CENTER,
        shading: head ? { fill: warnaKepala, type: ShadingType.CLEAR, color: 'auto' } : undefined,
        children: String(t).split('\n').map((x) => new Paragraph({ spacing: { after: 0, line: 270 }, children: runs(x, head ? { bold: true } : {}) })) });
      tambah(new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: lebar,
        rows: [new TableRow({ tableHeader: true, cantSplit: true, children: kepala.map((t, i) => sel(t, i, true)) }), ...baris.map((r) => new TableRow({ cantSplit: true, children: r.map((t, i) => sel(t, i, false)) }))] }),
      new Paragraph({ spacing: { after: 160 }, children: [] }));
    },
    /** Langkah tutorial: nomor besar + teks; nomor dari label merah di gambar dirujuk sebagai ①… */
    LANGKAH(daftar) { B.OL(daftar); },
    simpan(nama, { judul, deskripsi, sampulPng }) {
      const sampul = [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: fs.readFileSync(sampulPng), transformation: { width: 680, height: 962 }, altText: { title: judul, description: judul, name: 'sampul' } })] })];
      const daftarIsi = [
        new Paragraph({ pageBreakBefore: true, spacing: { after: 240 }, children: [new TextRun({ text: 'Daftar Isi', bold: true, size: 40, color: BIRU })] }),
        new TableOfContents('Daftar Isi', { hyperlink: true, headingStyleRange: '1-2' }),
      ];
      const doc = new Document({
        creator: 'ARKAS Web', title: judul, description: deskripsi, features: { updateFields: true },
        styles: {
          default: { document: { run: { font: FONT, size: 22 } } },
          paragraphStyles: [
            { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 40, bold: true, color: BIRU }, paragraph: { spacing: { before: 240, after: 240 }, keepNext: true, outlineLevel: 0 } },
            { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 30, bold: true, color: BIRU }, paragraph: { spacing: { before: 340, after: 140 }, keepNext: true, outlineLevel: 1 } },
            { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 25, bold: true, color: '333333' }, paragraph: { spacing: { before: 240, after: 90 }, keepNext: true, outlineLevel: 2 } },
          ],
        },
        numbering: { config: [
          { reference: 'poin', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
          ...nomorRefs.map((reference) => ({ reference, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { run: { bold: true, color: BIRU }, paragraph: { indent: { left: 540, hanging: 360 } } } }] })),
        ] },
        sections: [
          { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 567, right: 567, bottom: 567, left: 567 } } }, children: sampul },
          { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, pageNumbers: { start: 1 } } },
            headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: judulHeader, size: 16, color: '888888' })] })] }) },
            footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Halaman ', PageNumber.CURRENT], size: 18, color: '666666' })] })] }) },
            children: [...daftarIsi, ...anak] },
        ],
      });
      return Packer.toBuffer(doc).then((buf) => { const out = path.isAbsolute(nama) ? nama : path.join(opsi.dirKeluaran ?? __dirname, nama); fs.writeFileSync(out, buf); console.log('ditulis', out, buf.length, 'byte'); });
    },
  };
  return B;
}

/** Glosarium bersama kedua buku. */
const GLOSARIUM = [
  ['ARKAS Web', 'Aplikasi berbasis web untuk merencanakan, menatausahakan, dan melaporkan dana sekolah'],
  ['BOSP', 'Bantuan Operasional Satuan Pendidikan: dana pemerintah untuk operasional sekolah'],
  ['Pagu', 'Batas total dana BOSP sekolah dalam satu tahun anggaran; ditetapkan pemerintah, tidak diubah sekolah'],
  ['Kertas kerja', 'Rancangan anggaran yang sedang disusun sekolah di ARKAS Web (masih bisa diubah)'],
  ['RKAS', 'Rencana Kegiatan dan Anggaran Sekolah: kertas kerja yang sudah disahkan Dinas dan menjadi pedoman belanja'],
  ['Versi', 'Setiap perubahan/pergeseran RKAS dibuat sebagai versi baru; versi lama menjadi Diganti'],
  ['Komponen BOSP', 'Kelompok kegiatan yang boleh dibiayai BOSP (mis. 03 Pembelajaran); beberapa dibatasi persentasenya'],
  ['Juknis', 'Petunjuk teknis penggunaan dana; aturannya dicek otomatis oleh aplikasi'],
  ['Kode rekening', 'Kode jenis belanja, mis. 5.1.02.01.01.0024 alat tulis kantor; menentukan pajak yang dipungut'],
  ['Perubahan anggaran', 'Mengubah RKAS karena pagu berubah; total RKAS ikut berubah'],
  ['Pergeseran anggaran', 'Memindahkan nilai antarbaris RKAS dengan pagu dan total yang tetap'],
  ['Realisasi', 'Bagian anggaran yang sudah dibelanjakan dan disetujui'],
  ['Verifikator Dinas', 'Petugas Dinas Pendidikan yang menelaah dan mengesahkan RKAS'],
  ['BKU', 'Buku Kas Umum: catatan seluruh penerimaan dan pengeluaran beserta saldonya'],
  ['BKP', 'Buku Kas Pembantu: rincian BKU per jenis kas (tunai, bank, pajak)'],
  ['Periode', 'Satu bulan buku kas; transaksi hanya bisa dicatat di periode yang Buka'],
  ['Saldo tersedia', 'Saldo yang bisa dipakai setelah memperhitungkan transaksi yang masih menunggu persetujuan'],
  ['Luring', 'Belanja langsung ke toko/penyedia, dicatat sendiri oleh Bendahara lewat wizard belanja'],
  ['Daring / SIPLah', 'Belanja melalui Sistem Informasi Pengadaan Sekolah; transaksi dikirim otomatis oleh Mitra'],
  ['Mitra SIPLah', 'Penyedia platform belanja daring sekolah yang terhubung dengan ARKAS Web'],
  ['HPP', 'Halaman Pemetaan Pembelanjaan: membandingkan rencana RKAS dengan belanja di SIPLah'],
  ['DPP', 'Dasar Pengenaan Pajak: nilai yang dipakai untuk menghitung pajak'],
  ['PPN', 'Pajak Pertambahan Nilai (11%) atas pembelian barang/jasa kena pajak'],
  ['PPh 21 / PPh 23', 'Pajak penghasilan atas honor orang pribadi (21) dan atas jasa (23)'],
  ['Pajak daerah (SSPD)', 'Pajak yang ditetapkan pemerintah daerah, mis. pajak restoran untuk makan minum'],
  ['NPWP', 'Nomor Pokok Wajib Pajak penyedia; tanpa NPWP, tarif PPh bisa lebih tinggi'],
  ['NTPN', 'Nomor Transaksi Penerimaan Negara: 16 karakter di bukti setor pajak'],
  ['Rekonsiliasi', 'Mencocokkan saldo buku dengan rekening koran bank dan uang tunai fisik'],
  ['Berita acara pemeriksaan kas', 'Ringkasan rekonsiliasi yang diperiksa Kepala Sekolah saat menutup buku'],
  ['Jejak audit', 'Catatan setiap perubahan data (siapa, kapan, apa) yang tidak bisa diubah'],
  ['SSO', 'Single Sign-On: satu akun untuk masuk ke banyak layanan pemerintah'],
  ['TTE', 'Tanda Tangan Elektronik untuk laporan resmi'],
];

module.exports = { buatBuku, GLOSARIUM, BIRU };
