# Panduan ARKAS Web (DOCX)

- `Panduan-ARKAS-Web.docx`: panduan formal untuk Kepala Sekolah, Bendahara, dan Operator (A4, 24 halaman).
- `Panduan-ARKAS-Web.pdf`: versi PDF untuk dicetak.
- `panduan.md`: sumber teks. `P/` = `../panduan-sekolah/`, `T/` = `../tutorial-sekolah/`; `alur-kerja.png` = diagram alur.

Membuat ulang (dari folder ini):

```bash
sed -e 's#](P/#](../panduan-sekolah/#' -e 's#](T/#](../tutorial-sekolah/#' panduan.md > /tmp/pan.md && pandoc /tmp/pan.md -o Panduan-ARKAS-Web.docx --reference-doc=templat-referensi.docx --resource-path=.
```
