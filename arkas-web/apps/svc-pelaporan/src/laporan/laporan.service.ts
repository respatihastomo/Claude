import { Inject, Injectable } from '@nestjs/common';
import { AturanError } from '@arkas/aturan';
import { DbContextService, GalatHttp, RequestContext, tulisOutbox } from '@arkas/common-ms';
import { LaporanDitandatanganiData, TOPIK } from '@arkas/kontrak';
import { PEMBUAT_PDF, PENANDATANGAN, PENYIMPANAN, SKEMA } from '../infra/tokens';
import type { PembuatPdf } from '../infra/pdf';
import type { PenyimpananBerkas } from '../infra/penyimpanan';
import type { Penandatangan } from '../infra/tte';
import { dataLaporan, sha256 } from './pembuat';
import { htmlLaporanBku } from './templat';
import * as repo from './laporan.repo';

/** UC-16 — membuat & menandatangani laporan; UC-40 — melihat laporan. */
@Injectable()
export class LaporanService {
  constructor(
    @Inject(DbContextService) private readonly db: DbContextService,
    @Inject(PEMBUAT_PDF) private readonly pdf: PembuatPdf,
    @Inject(PENYIMPANAN) private readonly simpan: PenyimpananBerkas,
    @Inject(PENANDATANGAN) private readonly tte: Penandatangan,
  ) {}

  async daftar(ctx: RequestContext, npsn: string, tahun: number, sd: string): Promise<repo.LaporanDto[]> {
    return (await this.db.run(ctx, (tx) => repo.daftar(tx, npsn, tahun, sd))).map(repo.publik);
  }

  async ambil(ctx: RequestContext, id: string): Promise<repo.LaporanDto> {
    return repo.publik(await this.db.run(ctx, (tx) => this.wajibAda(tx, id)));
  }

  /** Berkas PDF; `tertanda` bila sudah ditandatangani, kecuali diminta versi asli. */
  async berkas(ctx: RequestContext, id: string, versi: 'terkini' | 'asli'): Promise<{ isi: Buffer; sha256: string; nama: string }> {
    const l = await this.db.run(ctx, (tx) => this.wajibAda(tx, id));
    const kunci = versi === 'terkini' && l.tertandaKunci ? l.tertandaKunci : l.berkasKunci;
    if (!kunci) throw new AturanError('LAPORAN_BELUM_SIAP', `Laporan berstatus ${l.status} belum memiliki berkas`);
    const isi = await this.simpan.ambil(kunci);
    const harap = kunci === l.tertandaKunci ? l.sha256Tertanda : l.sha256;
    if (sha256(isi) !== harap) throw new Error(`integritas berkas ${kunci} gagal: SHA-256 tidak cocok`);
    return { isi, sha256: harap!, nama: `BKU-${l.npsn}-${l.tahun}-${String(l.bulan).padStart(2, '0')}${kunci === l.tertandaKunci ? '-ttd' : ''}.pdf` };
  }

  /** Kepala Sekolah menandatangani laporan SIAP -> DITANDATANGANI dan menerbitkan LaporanDitandatangani. */
  async tandatangani(ctx: RequestContext, id: string, versi: number): Promise<repo.LaporanDto> {
    return this.db.run(ctx, async (tx) => {
      const l = await this.wajibAda(tx, id); // periksa dulu tanpa kunci: FOR UPDATE tunduk RLS UPDATE (hanya SIAP)
      if (l.versi !== versi) throw new GalatHttp(412, 'VERSI_BERUBAH', 'Laporan telah berubah; muat ulang lalu coba lagi', { versiTerkini: l.versi });
      if (l.status !== 'SIAP') throw new AturanError(l.status === 'DITANDATANGANI' ? 'LAPORAN_FINAL' : 'LAPORAN_BELUM_SIAP', `Laporan berstatus ${l.status} tidak dapat ditandatangani`);
      await repo.ambil(tx, id, true);

      const at = new Date().toISOString();
      const data = await dataLaporan(tx, l.periodeId, l.siapAt!);
      const html = htmlLaporanBku({ ...data, tte: { oleh: ctx.penggunaId, at, sha256Asli: l.sha256!, penyedia: this.tte.penyedia } });
      const isi = await this.tte.tandatangani(await this.pdf.buat(html), { penggunaId: ctx.penggunaId });
      const kunci = l.berkasKunci!.replace(/\.pdf$/, '-ttd.pdf');
      await this.simpan.simpan(kunci, isi);
      const hash = sha256(isi);
      await tx.query(
        `UPDATE pelaporan.laporan SET status = 'DITANDATANGANI', tertanda_kunci = $2, tertanda_sha256 = $3, ditandatangani_oleh = $4,
           ditandatangani_at = $5, penyedia_tte = $6 WHERE id = $1`,
        [id, kunci, hash, ctx.penggunaId, at, this.tte.penyedia],
      );
      const payload: LaporanDitandatanganiData = {
        laporanId: id, jenis: l.jenis, npsn: l.npsn, tahun: l.tahun, sumberDanaKode: l.sumberDanaKode, bulan: l.bulan, periodeId: l.periodeId,
        ditandatanganiOleh: ctx.penggunaId, ditandatanganiAt: at, sha256: hash, penyediaTte: this.tte.penyedia,
      };
      await tulisOutbox(tx, SKEMA, { topik: TOPIK.LAPORAN_DITANDATANGANI, tipe: 'LaporanDitandatangani', agregatId: id, correlationId: ctx.requestId, payload });
      return repo.publik((await repo.ambil(tx, id))!);
    });
  }

  private async wajibAda(tx: Parameters<Parameters<DbContextService['run']>[1]>[0], id: string) {
    const l = await repo.ambil(tx, id);
    if (!l) throw new GalatHttp(404, 'LAPORAN_TIDAK_DITEMUKAN', 'Laporan tidak ditemukan');
    return l;
  }
}
