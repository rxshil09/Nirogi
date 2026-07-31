import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = await buildApp();

const port = Number(process.env.PORT) || env.API_PORT || 4000;

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
