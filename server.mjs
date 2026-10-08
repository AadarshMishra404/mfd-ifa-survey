#!/usr/bin/env node
/* server.mjs — serves the survey and stores responses. No dependencies.
 *
 *   node server.mjs                      http://localhost:3000
 *   ADMIN_KEY=secret node server.mjs     dashboard needs ?key=secret
 *   PORT=8000 node server.mjs
 *
 *   /            the survey
 *   /admin.html  the results dashboard
 *
 * Responses are appended to data/responses.json.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'responses.json');
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const MAX_BODY = 200 * 1024;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

// Only these are served; data/ and server.mjs stay private.
const PUBLIC = new Set(['/index.html', '/admin.html']);
const PUBLIC_DIRS = ['/js/', '/css/', '/assets/'];

function readResponses() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}

function writeResponses(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

const json = (res, code, body) =>
  res.writeHead(code, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }).end(JSON.stringify(body));

function api(req, res, query) {
  if (req.method === 'GET') {
    if (ADMIN_KEY && query.get('key') !== ADMIN_KEY) return json(res, 401, { error: 'key required' });
    return json(res, 200, readResponses());
  }

  if (req.method === 'POST') {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { json(res, 413, { error: 'too large' }); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return json(res, 400, { error: 'invalid json' }); }
      if (!body || typeof body.answers !== 'object') return json(res, 400, { error: 'answers missing' });

      const list = readResponses();
      // The client sends its own id so a retried submit isn't stored twice.
      if (body.id && list.some((r) => r.id === body.id)) return json(res, 200, { ok: true, duplicate: true });
      const record = { ...body, id: body.id || crypto.randomUUID(), receivedAt: new Date().toISOString() };
      list.push(record);
      writeResponses(list);
      return json(res, 201, { ok: true, id: record.id });
    });
    return;
  }

  json(res, 405, { error: 'method not allowed' });
}

function handler(req, res) {
  const [rawPath, rawQuery = ''] = (req.url || '/').split('?');
  const url = decodeURIComponent(rawPath);
  const query = new URLSearchParams(rawQuery);

  if (url === '/api/responses') return api(req, res, query);

  const rel = url === '/' ? '/index.html' : url === '/admin' ? '/admin.html' : path.posix.normalize(url);
  if (!PUBLIC.has(rel) && !PUBLIC_DIRS.some((d) => rel.startsWith(d))) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }

  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403).end('Forbidden'); return; }

  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) return n.address;
    }
  }
  return 'localhost';
}

http.createServer(handler).listen(PORT, '0.0.0.0', () => {
  const ip = lanAddress();
  console.log('');
  console.log('  Next-Gen MFD & IFA Practice Survey');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  survey      http://localhost:${PORT}`);
  console.log(`  dashboard   http://localhost:${PORT}/admin${ADMIN_KEY ? '?key=' + ADMIN_KEY : ''}`);
  console.log(`  on the LAN  http://${ip}:${PORT}`);
  console.log(`  responses → ${path.relative(ROOT, DATA_FILE)}`);
  if (!ADMIN_KEY) console.log('  (set ADMIN_KEY=… to password-protect the dashboard data)');
  console.log('');
});
