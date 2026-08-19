// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ✅ Fanampiana ho an'ny Web (Leaflet)
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'web.js',
  'native.js',
  'mjs',
  'cjs',
  'jsx',
  'js',
];

// ✅ Fanampiana ho an'ny CSS (Leaflet)
config.resolver.assetExts = [
  ...config.resolver.assetExts.filter(ext => ext !== 'css'),
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
];

// ✅ Fanampiana ho an'ny Resolver
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // ✅ Mamaha ny olana amin'ny Leaflet
  if (platform === 'web' && moduleName === 'leaflet') {
    return {
      filePath: require.resolve('leaflet/dist/leaflet.js'),
      type: 'sourceFile',
    };
  }
  if (platform === 'web' && moduleName === 'leaflet/dist/leaflet.css') {
    return {
      filePath: require.resolve('leaflet/dist/leaflet.css'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.transformer.minifierConfig = {
  compress: {
    drop_console: false,
  },
};

module.exports = config;