import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pem': 'application/x-pem-file',
};

function mimeFor(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function safeJoin(root, ...segments) {
  const resolved = path.resolve(root, ...segments);
  if (!resolved.startsWith(path.resolve(root))) {
    throw new Error(`Ruta fuera de public: ${resolved}`);
  }
  return resolved;
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

/**
 * Copia assets estáticos según el modo de build:
 * - Con VITE_BRAND: solo public/{brand}/ y public/shared/
 * - Sin marca (build universal): todo public/ (varias marcas vía ?brand=)
 */
export function copyBrandPublicAssets(publicRoot, destRoot, brand) {
  fs.mkdirSync(destRoot, { recursive: true });

  if (brand) {
    const brandSrc = path.join(publicRoot, brand);
    if (!fs.existsSync(brandSrc)) {
      console.warn(`[brand-public-assets] No existe public/${brand}/ — el dist no tendrá assets de marca.`);
    } else {
      copyRecursive(brandSrc, path.join(destRoot, brand));
    }
    const sharedSrc = path.join(publicRoot, 'shared');
    if (fs.existsSync(sharedSrc)) {
      copyRecursive(sharedSrc, path.join(destRoot, 'shared'));
    }
    return;
  }

  if (!fs.existsSync(publicRoot)) return;
  for (const entry of fs.readdirSync(publicRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    copyRecursive(path.join(publicRoot, entry.name), path.join(destRoot, entry.name));
  }
}

function resolvePublicFile(publicRoot, brand, urlPath) {
  const normalized = urlPath.split('?')[0];
  if (!normalized || normalized === '/') return null;

  let relative = null;
  if (brand) {
    if (normalized.startsWith(`/${brand}/`)) {
      relative = path.join(brand, normalized.slice(`/${brand}/`.length));
    } else if (normalized.startsWith('/shared/')) {
      relative = path.join('shared', normalized.slice('/shared/'.length));
    } else {
      return null;
    }
  } else {
    relative = normalized.replace(/^\/+/, '');
  }

  if (!relative || relative.includes('..')) return null;

  const filePath = safeJoin(publicRoot, relative);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return null;
  return filePath;
}

function createDevMiddleware(publicRoot, brand) {
  return (req, res, next) => {
    try {
      const filePath = resolvePublicFile(publicRoot, brand, req.url ?? '');
      if (!filePath) return next();
      res.statusCode = 200;
      res.setHeader('Content-Type', mimeFor(filePath));
      fs.createReadStream(filePath).on('error', next).pipe(res);
    } catch {
      next();
    }
  };
}

/**
 * Sustituye la copia global de public/ de Vite por assets acotados por marca.
 */
export function brandPublicAssetsPlugin(brand) {
  let publicRoot = '';
  let outDir = '';

  return {
    name: 'brand-public-assets',
    config() {
      return { publicDir: false };
    },
    configResolved(config) {
      publicRoot = path.resolve(config.root, 'public');
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use(createDevMiddleware(publicRoot, brand));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createDevMiddleware(publicRoot, brand));
    },
    closeBundle() {
      copyBrandPublicAssets(publicRoot, outDir, brand);
    },
  };
}
