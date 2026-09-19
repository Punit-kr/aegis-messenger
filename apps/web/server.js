/**
 * Aegis Web Client Static Dev Server
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.WEB_PORT || '3000', 10);
const ROOT_DIR = path.resolve(__dirname, '../../');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];

  // Proxy REST API and Health check requests to the backend relay on port 3001
  if (reqPath.startsWith('/api/') || reqPath === '/health') {
    const backendReq = http.request(
      {
        hostname: '127.0.0.1',
        port: 3001,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          host: '127.0.0.1:3001'
        }
      },
      (backendRes) => {
        res.writeHead(backendRes.statusCode, backendRes.headers);
        backendRes.pipe(res, { end: true });
      }
    );

    backendReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Aegis Backend Relay (port 3001) is offline. Start the backend server using "npm run start:backend" or "node scripts/dev.js".'
      }));
    });

    req.pipe(backendReq, { end: true });
    return;
  }

  if (reqPath === '/' || reqPath === '') {
    reqPath = '/apps/web/public/index.html';
  } else if (!reqPath.startsWith('/apps/web') && !reqPath.startsWith('/packages')) {
    reqPath = path.join('/apps/web', reqPath);
  }

  const filePath = path.join(ROOT_DIR, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA routes
        fs.readFile(path.join(__dirname, 'public/index.html'), (fallbackErr, indexContent) => {
          if (fallbackErr) {
            res.writeHead(404);
            res.end('Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(indexContent);
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🌐 Aegis Web Client running at http://localhost:${PORT}`);
});
