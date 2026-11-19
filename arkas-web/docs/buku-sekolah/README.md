# Buku Panduan & Buku Tutorial ARKAS Web untuk Sekolah

| Berkas | Isi |
|---|---|
| `Buku-Panduan-ARKAS-Web-Sekolah.docx` / `.pdf` | Konsep, aturan, alur, diagram, dan tangkapan layar kunci |
| `Buku-Tutorial-ARKAS-Web-Sekolah.docx` / `.pdf` | Langkah demi langkah dengan 68 tangkapan layar bertanda |

Kerangka keduanya: 0 Sampul & Daftar Isi · 1 Pendahuluan · 2 Memulai Aplikasi · 3 Penganggaran (3a–3g) · 4 Penatausahaan (4a–4d) · 5 Permasalahan & Solusi · 6 Penutup · 7 Glosarium.

## Membangun ulang

```bash
cd docs/buku-sekolah
node buat-diagram.cjs && node buat-sampul.cjs        # diagram/ dan sampul (opsional)
node buat-panduan-sekolah.cjs && node buat-tutorial-sekolah.cjs
for b in Panduan Tutorial; do f=Buku-$b-ARKAS-Web-Sekolah; python3 ../buku-panduan/perbarui-daftar-isi.py $f.docx $f.docx $f.pdf; zip -d $f.docx '*/'; done
```

- `gambar/` — tangkapan layar dari aplikasi berjalan (data cerita SMP Swasta Contoh 2, NPSN 20100002; akun contoh di `db/svc-identitas/migrations/90_seed_dev.sql`).
- `diagram/` — diagram alur, mind map, dan sampul (dirender oleh `buat-diagram.cjs` / `buat-sampul.cjs`).
- `lib-buku.cjs` — gaya buku bersama (judul, kotak tips, tabel, gambar bernomor, daftar isi, glosarium).
