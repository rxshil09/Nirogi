import type { RetailerSlug } from '@nirogi/contracts';
import { NetmedsAdapter } from './netmeds.js';
import { OneMgAdapter } from './one-mg.js';
import { PharmEasyAdapter } from './pharmeasy.js';
import type { RetailerAdapter } from './types.js';

const adapters: Record<RetailerSlug, RetailerAdapter> = {
  'one-mg': new OneMgAdapter(),
  netmeds: new NetmedsAdapter(),
  pharmeasy: new PharmEasyAdapter(),
};

export const getAdapter = (source: RetailerSlug): RetailerAdapter => adapters[source];
