# Dokumentasi Pengembangan ARKAS Web

| Berkas | Isi |
|---|---|
| `Dokumentasi-Pengembangan-ARKAS-Web.docx` / `.pdf` | Dokumen teknis lengkap (34 halaman) untuk pengembang dan pengelola teknis |

Kerangka: 1 Pendahuluan · 2 Gambaran Sistem · 3 Arsitektur Aplikasi · 4 Model & Struktur Data · 5 Kontrak Antarlayanan · 6 Keamanan · 7 Alur Proses Utama · 8 Lingkungan Pengembangan · 9 Pengujian & Kualitas · 10 Operasional & Penyebaran · 11 Panduan Kontribusi · 12 Penutup · Lampiran A–F.

Seluruh angka pada dokumen (jumlah tabel, endpoint, kebijakan RLS, kasus uji) dihitung dari repositori; perintah pemeriksaannya ada di Lampiran D.

## Membangun ulang

```bash
cd docs/buku-pengembangan
node buat-diagram-dev.cjs && node buat-sampul-dev.cjs     # 12 diagram + sampul
node buat-dokumentasi-dev.cjs
python3 ../buku-panduan/perbarui-daftar-isi.py Dokumentasi-Pengembangan-ARKAS-Web.docx Dokumentasi-Pengembangan-ARKAS-Web.docx Dokumentasi-Pengembangan-ARKAS-Web.pdf
zip -d Dokumentasi-Pengembangan-ARKAS-Web.docx '*/'
```

Gaya dokumen (judul, kotak, tabel, gambar bernomor, daftar isi) memakai pustaka bersama `../buku-sekolah/lib-buku.cjs`.
