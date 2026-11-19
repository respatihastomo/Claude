import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestBerkonteks } from './scope.guard';

/** Mengambil RequestContext yang dipasang ScopeGuard. */
export const Ctx = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const req = context.switchToHttp().getRequest<RequestBerkonteks>();
  if (!req.ctx) throw new Error('RequestContext belum dipasang: ScopeGuard wajib aktif');
  return req.ctx;
});
