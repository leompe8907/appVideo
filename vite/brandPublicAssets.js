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
 * Copia archivos sueltos en la RAÍZ de `public/` (no dentro de una carpeta de
 * marca ni de `shared/`) directo a la raíz de `destRoot`, preservando el
 * nombre plano -- p. ej. `public/tv-platform-bootstrap.js` -> `dist/{marca}/
 * tv-platform-bootstrap.js`. Necesario porque `index.html` lo referencia
 * como `%BASE_URL%tv-platform-bootstrap.js` (ruta raíz, ver `index.html`),
 * y ninguna de las dos ramas de abajo copiaba nunca archivos sueltos de la
 * raíz de `public/` -- solo carpetas -- así que en CUALQUIER build (con o
 * sin marca) ese script nunca llegaba al `dist/`. En producción/TV
 * (Vercel con rewrite catch-all a `index.html`, o el paquete .wgt de Tizen
 * armado directo desde `dist/{marca}/`) pedir ese `.js` inexistente devolvía
 * HTML en vez del script -- el "Uncaught SyntaxError: Unexpected token <"
 * que se vio en la consola de la TV. Sin ese script, `window.tizen`/
 * `webapis` nunca se inicializa a tiempo, lo que rompe cualquier lectura de
 * UDID/API nativa de la que dependa el login en TV.
 */
function copyRootLevelFiles(publicRoot, destRoot) {
  if (!fs.existsSync(publicRoot)) return;
  for (const entry of fs.readdirSync(publicRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    fs.mkdirSync(destRoot, { recursive: true });
    fs.copyFileSync(path.join(publicRoot, entry.name), path.join(destRoot, entry.name));
  }
}

/**
 * Copia assets estáticos según el modo de build:
 * - Con VITE_BRAND: public/{brand}/, public/shared/, y archivos sueltos de la raíz de public/
 * - Sin marca (build universal): todo public/ (varias marcas vía ?brand=), incluyendo archivos sueltos de la raíz
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
    copyRootLevelFiles(publicRoot, destRoot);
    return;
  }

  if (!fs.existsSync(publicRoot)) return;
  for (const entry of fs.readdirSync(publicRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    copyRecursive(path.join(publicRoot, entry.name), path.join(destRoot, entry.name));
  }
  copyRootLevelFiles(publicRoot, destRoot);
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
      // Archivo suelto en la raíz de public/ (ej. tv-platform-bootstrap.js,
      // referenciado en index.html como ruta raíz `%BASE_URL%archivo.js`) --
      // sin esto, `vite dev`/`preview` con VITE_BRAND seteado tampoco podía
      // servirlo (mismo bug que en el build, ver `copyRootLevelFiles`).
      relative = normalized.replace(/^\/+/, '');
      if (!relative || relative.includes('/')) return null;
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
