import { Controller, Get, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { POOL_API } from './infra/tokens';

@Controller('health')
export class HealthController {
  constructor(@Inject(POOL_API) private readonly pool: Pool) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    await this.pool.query('SELECT 1');
    return { status: 'ok' };
  }
}
