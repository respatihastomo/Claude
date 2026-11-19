# Kode Sumber ARKAS Web — dokumen per unit

Dua belas dokumen (DOCX + PDF) berisi **kode sumber apa adanya** dari repositori, lengkap dengan nomor baris, daftar berkas, dan keterangan singkat tiap berkas. Dibuat untuk dibaca dan dicetak; penjelasan arsitektur dan alasan rancangannya ada di [`docs/buku-pengembangan`](../buku-pengembangan/README.md).

| Dokumen | Berkas | Baris | Halaman |
|---|---:|---:|---:|
| `Kode-Sumber-svc-referensi` | 15 | 864 | 23 |
| `Kode-Sumber-svc-identitas` | 22 | 1.333 | 33 |
| `Kode-Sumber-svc-perencanaan` | 19 | 1.400 | 32 |
| `Kode-Sumber-svc-penatausahaan` | 39 | 3.253 | 74 |
| `Kode-Sumber-svc-pelaporan` | 21 | 1.169 | 31 |
| `Kode-Sumber-svc-audit` | 12 | 586 | 18 |
| `Kode-Sumber-svc-integrasi` | 19 | 1.407 | 36 |
| `Kode-Sumber-svc-pemantauan` | 13 | 756 | 22 |
| `Kode-Sumber-svc-bantuan` | 17 | 1.280 | 32 |
| `Kode-Sumber-web` | 64 | 4.106 | 105 |
| `Kode-Sumber-packages` | 48 | 2.470 | 64 |
| `Kode-Sumber-infrastruktur` | 12 | 395 | 16 |
| **Jumlah** | **301** | **19.019** | **486** |

Setiap dokumen layanan memuat `apps/<layanan>/src`, `apps/<layanan>/test`, dan `db/<layanan>/migrations` — jadi kode, uji, dan skema basis datanya berada dalam satu berkas.

## Membangun ulang

```bash
cd docs/kode-sumber
node buat-kode-sumber.cjs                  # seluruh unit
node buat-kode-sumber.cjs svc-penatausahaan  # satu unit saja
soffice --headless --convert-to pdf --outdir . *.docx
```

Berkas yang tidak ikut: `node_modules`, `dist`, `.next`, `.env*`, dan `.dev-keys/`.
