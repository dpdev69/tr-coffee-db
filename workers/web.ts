import app from 'vinext/server/fetch-handler';
import { guard } from './miss-guard';

/** The web Worker: the miss guard (workers/miss-guard.ts), then the vinext app. Workers Cache answers hits before this runs. */
const web = {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    const next = await guard(request, env, ctx);
    return next instanceof Response ? next : (app as ExportedHandler<CloudflareEnv>).fetch!(next as Request<unknown, IncomingRequestCfProperties>, env, ctx);
  },
};
export default web;
