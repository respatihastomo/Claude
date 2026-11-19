import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AturanError } from '@arkas/aturan';
import { AksesDitolakDbError } from '../db/galat-pg';

/** Galat aplikasi dengan status HTTP eksplisit (mis. 404, 409, 412, 428). */
export class GalatHttp extends HttpException {
  constructor(status: number, kode: string, pesan: string, tambahan?: Record<string, unknown>) {
    super({ kode, message: pesan, ...tambahan }, status);
  }
}

const JUDUL: Record<number, string> = {
  400: 'Permintaan tidak valid', 401: 'Tidak terautentikasi', 403: 'Akses ditolak', 404: 'Tidak ditemukan',
  409: 'Konflik', 412: 'Prasyarat gagal', 422: 'Aturan bisnis dilanggar', 428: 'Prasyarat wajib', 500: 'Galat server',
};

/** Semua galat dikirim sebagai application/problem+json (RFC 9457) dengan properti `kode`. */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly log = new Logger('ProblemFilter');

  catch(err: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    let status = 500;
    let body: Record<string, unknown> = { kode: 'GALAT_INTERNAL', detail: 'Terjadi galat tak terduga' };

    if (err instanceof ZodError) {
      status = 400;
      body = { kode: 'VALIDASI', detail: 'Data tidak lolos validasi', galat: err.issues.map((i) => ({ path: i.path.join('.'), pesan: i.message })) };
    } else if (err instanceof AturanError) {
      status = 422;
      body = { kode: err.kode, detail: err.message, ...(err.detail ? { rincian: err.detail } : {}) };
    } else if (err instanceof AksesDitolakDbError) {
      status = 403;
      body = { kode: err.kode, detail: err.message };
    } else if (err instanceof HttpException) {
      status = err.getStatus();
      const r = err.getResponse();
      const o = typeof r === 'string' ? { message: r } : (r as Record<string, unknown>);
      const { message, kode, statusCode: _s, error: _e, ...lain } = o as Record<string, unknown>;
      body = { kode: (kode as string) ?? HttpStatus[status] ?? 'GALAT', detail: Array.isArray(message) ? message.join('; ') : message, ...lain };
    } else {
      this.log.error(err instanceof Error ? err.stack : String(err));
    }

    res
      .status(status)
      .type('application/problem+json')
      .json({ type: `urn:arkas:galat:${String(body.kode).toLowerCase()}`, title: JUDUL[status] ?? 'Galat', status, instance: req.originalUrl, ...body });
  }
}
