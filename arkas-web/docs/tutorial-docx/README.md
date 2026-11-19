# Tutorial ARKAS Web (DOCX)

- `Tutorial-ARKAS-Web.docx`: tutorial lengkap untuk Operator, Kepala Sekolah, Bendahara, dan Komite (A4, 40 halaman, 54 tangkapan layar).
- `Tutorial-ARKAS-Web.pdf`: versi PDF untuk dicetak.
- `tutorial.md`: sumber teks (gambar dari `../tutorial-sekolah/`).

Membuat ulang:

```bash
cd docs/tutorial-docx && pandoc tutorial.md -o Tutorial-ARKAS-Web.docx --reference-doc=templat-referensi.docx
```
