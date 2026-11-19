import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { PERAN_SEKOLAH, Peran } from '../context/peran';
import { RequestContext } from '../context/request-context';
import { IZINKAN_KEY } from './izinkan.decorator';
import { VerifikatorJwt } from './jwt';

export type RequestBerkonteks = Request & { ctx?: RequestContext };

/**
 * Kode 5 — ScopeGuard: verifikasi JWT internal, peran (@Izinkan) dan kecocokan :npsn dengan klaim untuk peran sekolah.
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: VerifikatorJwt) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestBerkonteks>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException({ kode: 'TOKEN_TIDAK_ADA', message: 'Header Authorization Bearer wajib' });

    let klaim;
    try {
      klaim = await this.jwt.verifikasi(auth.slice(7));
    } catch {
      throw new UnauthorizedException({ kode: 'TOKEN_TIDAK_VALID', message: 'Token tidak valid atau kedaluwarsa' });
    }

    const izinkan = this.reflector.getAllAndOverride<Peran[] | undefined>(IZINKAN_KEY, [context.getHandler(), context.getClass()]);
    if (izinkan && !izinkan.includes(klaim.peran)) {
      throw new ForbiddenException({ kode: 'PERAN_TIDAK_DIIZINKAN', message: `Peran ${klaim.peran} tidak diizinkan untuk aksi ini` });
    }

    const npsnParam = (req.params as Record<string, string | undefined>).npsn;
    if (PERAN_SEKOLAH.includes(klaim.peran)) {
      if (!klaim.npsn) throw new ForbiddenException({ kode: 'CAKUPAN_TIDAK_ADA', message: 'Peran sekolah wajib memiliki klaim npsn' });
      if (npsnParam && npsnParam !== klaim.npsn) {
        throw new ForbiddenException({ kode: 'DI_LUAR_CAKUPAN', message: 'NPSN di luar cakupan pengguna' });
      }
    }

    const rid = req.headers['x-request-id'];
    req.ctx = {
      penggunaId: klaim.sub,
      peran: klaim.peran,
      npsn: klaim.npsn,
      wilayahKode: klaim.wilayah,
      direktoratIds: klaim.direktorat,
      ditjenKode: klaim.ditjen,
      ip: req.ip ?? '0.0.0.0',
      requestId: typeof rid === 'string' && /^[0-9a-f-]{36}$/i.test(rid) ? rid : randomUUID(),
      traceparent: typeof req.headers.traceparent === 'string' ? req.headers.traceparent : undefined,
    };
    return true;
  }
}
