const fs = require('fs');
const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const APP_ROOT = __dirname;
const REPO_ROOT = path.resolve(APP_ROOT, '../..');
const CORE_SRC = path.join(REPO_ROOT, 'packages/core/src');

// `node_modules` puede ser un enlace (ver README.md): Metro necesita vigilar
// la carpeta real.
const APP_NODE_MODULES = fs.realpathSync(path.join(APP_ROOT, 'node_modules'));

// Estos módulos tienen que salir siempre de la app: si `@appvideo/core` (o
// una dependencia suya como react-i18next) los tomara del node_modules de la
// web habría dos copias de React en el bundle.
const APP_ONLY = /^(react|react-native|@amazon-devices\/[^/]+)(\/.*)?$/;

// La CLI de React Native renombra `react-native` → paquete de la plataforma
// (Vega: @amazon-devices/react-native-kepler) con su propio `resolveRequest`,
// pero si el proyecto define uno, el de la CLI se descarta: hay que repetirlo.
const PLATFORM_PACKAGES = {kepler: '@amazon-devices/react-native-kepler'};

function toPlatformPackage(moduleName, platform) {
  const pkg = PLATFORM_PACKAGES[platform];
  if (!pkg) return moduleName;
  if (moduleName === 'react-native') return pkg;
  if (moduleName.startsWith('react-native/')) return `${pkg}/${moduleName.slice('react-native/'.length)}`;
  return moduleName;
}
const APP_ENTRY = path.join(APP_ROOT, 'index.js');

/** @type {import('metro-config').MetroConfig} */
const config = {
  watchFolders: [CORE_SRC, path.join(REPO_ROOT, 'node_modules'), APP_NODE_MODULES],
  resolver: {
    unstable_enableSymlinks: true,
    nodeModulesPaths: [APP_NODE_MODULES, path.join(REPO_ROOT, 'node_modules')],
    resolveRequest(context, requested, platform) {
      const moduleName = toPlatformPackage(requested, platform);
      if (moduleName.startsWith('@appvideo/core/')) {
        return context.resolveRequest(
          context,
          path.join(CORE_SRC, moduleName.slice('@appvideo/core/'.length)),
          platform,
        );
      }
      if (APP_ONLY.test(moduleName)) {
        return context.resolveRequest({...context, originModulePath: APP_ENTRY}, moduleName, platform);
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(APP_ROOT), config);
