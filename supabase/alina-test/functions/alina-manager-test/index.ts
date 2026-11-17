import { getAdminClient } from '../_shared/alina-db.ts';
import { processAlinaManagerTest } from '../_shared/alina-manager.ts';
import { handleTestWebhook } from './handler.ts';

Deno.serve((req) => handleTestWebhook(req, {
  env: (name) => Deno.env.get(name),
  db: getAdminClient() as never,
  process: processAlinaManagerTest as never,
  fetch: (url, init) => fetch(url, init),
}));
