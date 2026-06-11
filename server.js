import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const bundledPhoto = path.join(rootDir, 'assets', 'demo-historic-collingham-reference.png');
const defaultGalleryDir = process.env.PHOTO_OVERLAY_GALLERY_DIR
  || 'C:\\Users\\lozkn\\OneDrive\\Documents\\CDLHS\\JRdigitisation\\CollinghamPictures';
const allowedExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const contentTypeFor = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
  }[ext] || 'application/octet-stream';
};

const isWithin = (baseDir, targetPath) => {
  const base = path.resolve(baseDir);
  const target = path.resolve(targetPath);
  return target === base || target.startsWith(`${base}${path.sep}`);
};

const readGalleryItems = () => {
  const items = [];

  if (fs.existsSync(bundledPhoto)) {
    items.push({
      id: 'bundled-reference',
      name: 'Historic Collingham reference',
      source: 'bundled',
      src: '/assets/demo-historic-collingham-reference.png'
    });
  }

  if (!fs.existsSync(defaultGalleryDir)) {
    return items;
  }

  const files = fs.readdirSync(defaultGalleryDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && allowedExts.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  for (const fileName of files) {
    items.push({
      id: `gallery:${fileName}`,
      name: path.parse(fileName).name,
      source: 'gallery',
      src: `/api/photo?name=${encodeURIComponent(fileName)}`
    });
  }

  return items;
};

const sendJson = (res, payload) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const serveFile = (res, filePath) => {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentTypeFor(filePath) });
    res.end(data);
  });
};

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === '/api/gallery') {
    sendJson(res, {
      galleryDir: defaultGalleryDir,
      items: readGalleryItems()
    });
    return;
  }

  if (pathname === '/api/photo') {
    const name = requestUrl.searchParams.get('name');
    if (!name || !fs.existsSync(defaultGalleryDir)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const filePath = path.join(defaultGalleryDir, name);
    if (!isWithin(defaultGalleryDir, filePath)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
    serveFile(res, filePath);
    return;
  }

  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(rootDir, safePath);
  if (!isWithin(rootDir, filePath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  serveFile(res, filePath);
});

const port = Number(process.env.PORT || 4178);
server.listen(port, '127.0.0.1', () => {
  console.log(`Photo Overlay running at http://127.0.0.1:${port}`);
  console.log(`Gallery directory: ${defaultGalleryDir}`);
});
