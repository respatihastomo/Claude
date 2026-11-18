import fs from 'node:fs/promises';
import path from 'node:path';

/** Port penyimpanan berkas. Produksi: object storage S3 (bucket laporan, versioning); dev: folder lokal. */
export interface PenyimpananBerkas {
  simpan(kunci: string, isi: Buffer): Promise<void>;
  ambil(kunci: string): Promise<Buffer>;
}

/** Dev: berkas di folder lokal. Kunci divalidasi agar tidak keluar dari folder akar. */
export class BerkasLokal implements PenyimpananBerkas {
  private readonly akar: string;
  constructor(akar: string) { this.akar = path.resolve(akar); }

  private jalur(kunci: string): string {
    if (!/^[a-z0-9][a-z0-9/_.-]{0,250}$/.test(kunci) || kunci.includes('..')) throw new Error(`kunci berkas tidak valid: ${kunci}`);
    const p = path.resolve(this.akar, kunci);
    if (!p.startsWith(this.akar + path.sep)) throw new Error('kunci berkas keluar dari folder akar');
    return p;
  }
  async simpan(kunci: string, isi: Buffer): Promise<void> {
    const p = this.jalur(kunci);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, isi, { flag: 'wx' }).catch(async (e: NodeJS.ErrnoException) => {
      if (e.code !== 'EEXIST') throw e;
      await fs.writeFile(p, isi); // pembuatan ulang setelah GAGAL menimpa berkas parsial
    });
  }
  ambil(kunci: string): Promise<Buffer> {
    return fs.readFile(this.jalur(kunci));
  }
}
