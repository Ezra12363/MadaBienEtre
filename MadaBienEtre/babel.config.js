// babel.config.js
// ============================================
// ✅ TSY ILAINA INTSONY ny alias 'react-native-maps' -> MapViewWrapper.
//
// Ny MapViewWrapper.js dia mamaha ny fisafidianana Web/Native AO
// ANATINY ihany (`if (Platform.OS !== 'web') { require('react-native-maps') }`),
// ary ny écrans rehetra (SearchMassageScreen.js sns.) dia mampiasa
// `import MapViewWrapper from '.../MapViewWrapper'` mivantana — tsy
// misy fichier hafa mampiasa `import ... from 'react-native-maps'`
// mivantana ao amin'ity projet ity.
//
// ⚠️ Raha apetraka io alias io (na dia amin'ny env.web ihany aza — satria
// Expo Metro TSY mandefa BABEL_ENV=web mihitsy, ka ny alias "web only"
// dia tsy mihatra, fa ny alias VOALOHANY (tsy misy condition) no mihatra
// amin'ny platform REHETRA), dia miverina amin'ny tenany ilay
// `require('react-native-maps')` ao anaty MapViewWrapper.js amin'ny
// Android/iOS koa -> RNMapView = null mandrakariva -> carte tsy miseho
// mihitsy amin'ny mobile (izay tena nitranga taminao).
// ============================================
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        { jsxRuntime: 'automatic' },
      ],
    ],
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};
