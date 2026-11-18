import { SetMetadata } from '@nestjs/common';
import type { Peran } from '../context/peran';

export const IZINKAN_KEY = 'arkas:izinkan';
/** Daftar peran yang boleh memanggil handler. Tanpa dekorator = semua peran terautentikasi. */
export const Izinkan = (...peran: Peran[]) => SetMetadata(IZINKAN_KEY, peran);
