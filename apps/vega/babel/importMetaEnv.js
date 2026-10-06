/**
 * Plugin de Babel: reemplaza `import.meta.env` (Vite) por valores fijos, para
 * que el código de `@appvideo/core` corra con Metro igual que en la web.
 *
 * - Las variables salen de `.env` y `.env.local` de la raíz de appVideo
 *   (sólo las `VITE_*`, como hace Vite), más las del proceso.
 * - `VITE_DEFAULT_BRAND` / `VITE_BRAND` se toman de `VEGA_BRAND` (por defecto `intv`).
 * - `DEV` / `PROD` usan `__DEV__` de React Native, así que siguen el tipo de build.
 *
 * Metro guarda en caché lo transformado: después de cambiar el `.env.local`
 * hay que borrar la caché (`scripts/build.sh` lo hace).
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../..');

function parseEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '');
    out[m[1]] = value;
  }
  return out;
}

function loadViteEnv() {
  const merged = {
    ...parseEnvFile(path.join(REPO_ROOT, '.env')),
    ...parseEnvFile(path.join(REPO_ROOT, '.env.local')),
    ...process.env,
  };
  const env = {};
  for (const [key, value] of Object.entries(merged)) {
    if (key.startsWith('VITE_')) env[key] = value;
  }
  const brand = process.env.VEGA_BRAND || 'intv';
  env.VITE_BRAND = brand;
  env.VITE_DEFAULT_BRAND = brand;
  env.MODE = 'vega';
  env.BASE_URL = '/';
  return env;
}

module.exports = function importMetaEnv({ types: t }) {
  const env = loadViteEnv();
  const devExpr = () => t.identifier('__DEV__');
  const valueFor = (key) => {
    if (key === 'DEV') return devExpr();
    if (key === 'PROD') return t.unaryExpression('!', devExpr());
    return Object.prototype.hasOwnProperty.call(env, key)
      ? t.valueToNode(env[key])
      : t.identifier('undefined');
  };
  const envObject = () =>
    t.objectExpression([
      ...Object.keys(env).map((k) => t.objectProperty(t.stringLiteral(k), t.valueToNode(env[k]))),
      t.objectProperty(t.identifier('DEV'), devExpr()),
      t.objectProperty(t.identifier('PROD'), t.unaryExpression('!', devExpr())),
    ]);

  const isImportMeta = (node) =>
    t.isMetaProperty(node) && node.meta.name === 'import' && node.property.name === 'meta';

  return {
    name: 'appvideo-import-meta-env',
    visitor: {
      MetaProperty(p) {
        if (!isImportMeta(p.node)) return;
        const parent = p.parentPath;
        // import.meta.env.KEY → valor
        if (
          parent.isMemberExpression() &&
          !parent.node.computed &&
          t.isIdentifier(parent.node.property, { name: 'env' })
        ) {
          const grand = parent.parentPath;
          if (grand.isMemberExpression() && grand.node.object === parent.node) {
            const key = grand.node.computed
              ? t.isStringLiteral(grand.node.property) && grand.node.property.value
              : grand.node.property.name;
            if (key) {
              grand.replaceWith(valueFor(key));
              return;
            }
          }
          // import.meta.env (acceso dinámico)
          parent.replaceWith(envObject());
          return;
        }
        // import.meta suelto (p. ej. `typeof import.meta`)
        p.replaceWith(t.objectExpression([t.objectProperty(t.identifier('env'), envObject())]));
      },
    },
  };
};
