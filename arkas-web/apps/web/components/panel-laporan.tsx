'use client';
import { GalatApi } from '@/lib/api';
import { BULAN } from '@/lib/format';
import { Buku, LaporanDto, useLaporan, useTandatangani } from '@/lib/hooks';
import { Spanduk, Tombol, cx } from './ui';

const STATUS: Record<LaporanDto['status'], [string, string]> = {
  MENUNGGU: ['Sedang dibuat', 'bg-primary/10 text-primary ring-primary/30'],
  SIAP: ['Siap ditandatangani', 'bg-warning/10 text-warning ring-warning/30'],
  GAGAL: ['Gagal dibuat', 'bg-danger/10 text-danger ring-danger/30'],
  DITANDATANGANI: ['Ditandatangani', 'bg-success/10 text-success ring-success/30'],
};

/** UC-16/UC-40 — laporan bulanan dari svc-pelaporan: dibuat otomatis setelah buku ditutup, lalu ditandatangani Kepala Sekolah. */
export function PanelLaporan({ buku, peran }: { buku: Buku; peran: 'BENDAHARA' | 'KEPSEK' }) {
  const laporan = useLaporan(buku);
  const ttd = useTandatangani(buku);
  const galat = (laporan.error ?? ttd.error) instanceof GalatApi ? ((laporan.error ?? ttd.error) as GalatApi).problem : undefined;
  if (laporan.isLoading) return <p className="p-8 text-center text-sm text-muted">Memuat…</p>;
  return (
    <div className="space-y-4 p-4">
      <Spanduk nada="peringatan" judul="Tanda tangan di lingkungan ini adalah SIMULASI">
        Integrasi TTE BSrE belum tersedia. Dokumen bertanda tangan diberi label &ldquo;bukan TTE yang sah&rdquo; dan tidak boleh dipakai sebagai laporan resmi.
      </Spanduk>
      {!laporan.data?.length ? (
        <p className="rounded-ctl bg-canvas p-6 text-center text-sm text-muted">Belum ada laporan. Laporan BKU bulanan dibuat otomatis setelah Kepala Sekolah menutup buku kas.</p>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line">
          {laporan.data.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold">Laporan Buku Kas Umum — {BULAN[l.bulan - 1]} {buku.tahun}</p>
                <p className="angka mt-0.5 truncate text-xs text-muted">
                  {l.status === 'MENUNGGU' && `Percobaan ${l.percobaan}${l.galatTerakhir ? ` · ${l.galatTerakhir}` : ''}`}
                  {l.status === 'GAGAL' && l.galatTerakhir}
                  {l.sha256 && `SHA-256 ${(l.sha256Tertanda ?? l.sha256).slice(0, 16)}… · ${Math.round((l.ukuran ?? 0) / 1024)} KB`}
                  {l.ditandatanganiAt && ` · ditandatangani ${new Date(l.ditandatanganiAt).toLocaleString('id-ID')}${l.penyediaTte === 'SIMULASI_DEV' ? ' (simulasi)' : ''}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', STATUS[l.status][1])}>
                  {l.status === 'MENUNGGU' && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
                  {STATUS[l.status][0]}
                </span>
                {l.sha256 && (
                  <a className="inline-flex h-9 items-center rounded-ctl border border-line px-3 text-sm font-medium hover:bg-canvas" href={`/api/v1/laporan/${l.id}/berkas`} target="_blank" rel="noopener">
                    Lihat PDF
                  </a>
                )}
                {peran === 'KEPSEK' && l.status === 'SIAP' && (
                  <Tombol className="h-9" memuat={ttd.isPending && ttd.variables?.id === l.id}
                    onClick={() => window.confirm('Tandatangani laporan ini (SIMULASI, bukan TTE sah)?') && ttd.mutate(l)}>Tandatangani (simulasi)</Tombol>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {galat && <Spanduk nada="bahaya" judul={galat.detail ?? galat.title}>Kode: {galat.kode}</Spanduk>}
    </div>
  );
}
