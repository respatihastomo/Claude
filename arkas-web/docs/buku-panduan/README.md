# Buku Panduan & Tutorial ARKAS Web

Ada tiga buku dengan susunan yang sama:
- **untuk sekolah** (`Buku-Panduan-ARKAS-Web.*`, 46 halaman);
- **untuk Dinas Pendidikan** (`Buku-Panduan-ARKAS-Web-Dinas.*`, 29 halaman: Verifikator Dinas & Admin Dinas, gambar dari `../tutorial-dinas/`);
- **untuk Balai SDSP** (`Buku-Panduan-ARKAS-Web-Balai.*`, 33 halaman: pengguna tingkat pusat & referensi nasional termasuk formulir tambah/ubah/nonaktifkan, gambar dari `../tutorial-balai/`).

## Buku sekolah

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

## Buku Dinas Pendidikan

Isi: sampul, daftar isi, Bab 1 Pendahuluan, Bab 2 Memulai, Bab 3 Verifikator Dinas (antrean, memeriksa, membandingkan versi, catatan per baris, mengembalikan, mengesahkan), Bab 4 Admin Dinas: kelola pengguna, Bab 5 Admin Dinas: pajak daerah (termasuk bukti tarif dipakai sekolah), Bab 6 Penanganan Masalah, Bab 7 Penutup, dan Lampiran Glosarium.

```bash
node buat-buku-dinas.cjs
```
```bash
python3 perbarui-daftar-isi.py Buku-Panduan-ARKAS-Web-Dinas.docx Buku-Panduan-ARKAS-Web-Dinas.docx Buku-Panduan-ARKAS-Web-Dinas.pdf
```

## Buku Balai SDSP

Isi: sampul, daftar isi, Bab 1 Pendahuluan (termasuk diagram perjalanan perubahan referensi), Bab 2 Memulai, Bab 3 Mengelola Pengguna Tingkat Pusat, Bab 4 Menjelajah Referensi Nasional (8 tab), Bab 5 Menambah, Mengubah, dan Menonaktifkan Referensi (kode rekening, tarif pajak, sekolah, batas komponen dengan bukti di RKAS sekolah, nonaktifkan, aturan formulir), Bab 6 Menerbitkan Ulang Referensi, Bab 7 Penanganan Masalah, Bab 8 Penutup, dan Lampiran Glosarium. Setiap bab dibuka kotak *Di bab ini*.

```bash
node buat-buku-balai.cjs
```
```bash
python3 perbarui-daftar-isi.py Buku-Panduan-ARKAS-Web-Balai.docx Buku-Panduan-ARKAS-Web-Balai.docx Buku-Panduan-ARKAS-Web-Balai.pdf
```
