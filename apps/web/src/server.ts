import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import compression from 'compression';
import express from 'express';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

const browserDistFolder = join(import.meta.dirname, '../browser');
const BFF_URL = process.env['BFF_URL'] ?? 'http://localhost:3000';

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * gzip y brotli para HTML, JS, CSS y JSON (el proxy de `/api` ya descarta el `content-encoding` del BFF, así que no se comprime dos veces).
 */
app.use(compression());

/**
 * Las cabeceras que no copiamos de la respuesta del BFF: son de esa conexión y no de la nuestra.
 */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding',
  'content-length',
]);

/**
 * Reenvía `/api/*` al BFF para que el navegador converse siempre con un único origen (sin CORS). Es solo lectura: la
 * API del BFF únicamente expone GET (y HEAD). Si el BFF no responde, devolvemos un 502 y listo.
 */
app.use('/api', async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).set('Allow', 'GET, HEAD').end();
    return;
  }
  try {
    const upstream = await fetch(BFF_URL + req.originalUrl, {
      method: req.method,
      headers: {
        accept: req.get('accept') ?? 'application/json',
        'accept-language': req.get('accept-language') ?? '',
        'x-forwarded-for': [req.get('x-forwarded-for'), req.ip].filter(Boolean).join(', '),
      },
      signal: AbortSignal.timeout(15_000),
    });
    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key)) res.setHeader(key, value);
    });
    if (upstream.body) Readable.fromWeb(upstream.body as NodeReadableStream).pipe(res);
    else res.end();
  } catch {
    res.status(502).json({ statusCode: 502, message: 'BFF no disponible' });
  }
});

/**
 * Los archivos estáticos del build (llevan hash en el nombre, por eso la caché de 1 año).
 * `index: false`: la raíz la resuelve el motor SSR según el idioma.
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * El resto lo renderiza Angular. `clientIp` viaja como contexto para que el SSR se la reenvíe al BFF.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req, { clientIp: req.ip })
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Arranca si este módulo es el punto de entrada. El puerto sale de `PORT` o, si no viene, es el 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Servidor SSR en http://localhost:${port}`);
  });
}

/** El manejador que usa Angular CLI (dev-server y build). */
export const reqHandler = createNodeRequestHandler(app);
