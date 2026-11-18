# Buku Panduan & Tutorial ARKAS Web

Buku bergaya tidak formal untuk Operator, Kepala Sekolah, Bendahara, dan Komite Sekolah (A4, 46 halaman). Isinya: sampul, daftar isi, Bab 1 Pendahuluan, Bab 2 Memulai, Bab 3–6 tutorial per peran, Bab 7 Penanganan Masalah, Bab 8 Penutup, dan Lampiran Glosarium. Gambar bernomor per bab (tangkapan layar dari `../tutorial-sekolah/`).

| Berkas | Isi |
|---|---|
| `Buku-Panduan-ARKAS-Web.docx` | Buku (daftar isi sudah terisi nomor halaman) |
| `Buku-Panduan-ARKAS-Web.pdf` | Versi cetak |
| `buat-buku.cjs` | Sumber buku (docx-js) |
| `perbarui-daftar-isi.py` | Mengisi daftar isi lewat LibreOffice (UNO) dan mengekspor PDF |

Membuat ulang (dari folder ini):

```bash
node buat-buku.cjs
```
```bash
python3 perbarui-daftar-isi.py Buku-Panduan-ARKAS-Web.docx Buku-Panduan-ARKAS-Web.docx Buku-Panduan-ARKAS-Web.pdf
```
