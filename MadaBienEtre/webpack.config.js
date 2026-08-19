// webpack.config.js
const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // ✅ Fanampiana ho an'ny Leaflet (OpenStreetMap)
  config.resolve.alias['leaflet'] = 'leaflet/dist/leaflet.js';
  config.resolve.alias['leaflet.css'] = 'leaflet/dist/leaflet.css';

  // ✅ Fanampiana ho an'ny module.css
  config.module.rules.push({
    test: /\.css$/,
    use: ['style-loader', 'css-loader'],
  });

  return config;
};