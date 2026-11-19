/**
 * Port tanda tangan elektronik. Produksi: BSrE (PAdES, sertifikat Kepala Sekolah) — kredensial BSRE_* hanya di svc-pelaporan (16.1).
 * Dev: SIMULASI — tidak ada kriptografi tanda tangan; dokumen diberi label jelas "BUKAN TTE YANG SAH".
 */
export type PenyediaTte = 'SIMULASI_DEV' | 'BSRE';
export interface Penandatangan {
  readonly penyedia: PenyediaTte;
  /** Menerima PDF yang sudah berisi blok TTE dan mengembalikan PDF final (BSrE: PDF bertanda tangan PAdES). */
  tandatangani(pdf: Buffer, penanda: { penggunaId: string }): Promise<Buffer>;
}

export class TteSimulasiDev implements Penandatangan {
  readonly penyedia = 'SIMULASI_DEV' as const;
  async tandatangani(pdf: Buffer): Promise<Buffer> {
    return pdf;
  }
}

export class TteBsre implements Penandatangan {
  readonly penyedia = 'BSRE' as const;
  async tandatangani(): Promise<Buffer> {
    throw new Error('Integrasi BSrE belum tersedia: butuh kontrak, sertifikat, dan kredensial BSRE_*');
  }
}
