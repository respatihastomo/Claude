import { PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

/** Validasi body/query memakai skema Zod bersama (packages/kontrak). ZodError ditangani ProblemFilter. */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}
  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}
