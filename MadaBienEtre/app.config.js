// app.config.js
import appJson from "./app.json";

export default ({ config }) => {
  return {
    ...appJson.expo,
    ...config,

    ios: {
      ...appJson.expo.ios,
      ...config.ios,
      config: {
        ...appJson.expo.ios?.config,
        ...config.ios?.config,
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS,
      },
    },

    android: {
      ...appJson.expo.android,
      ...config.android,
      config: {
        ...appJson.expo.android?.config,
        ...config.android?.config,
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
        },
      },
    },

    plugins: [
      ...(appJson.expo.plugins || []),
      [
        "react-native-maps",
        {
          androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
          iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS,
        },
      ],
    ],

    extra: {
      ...appJson.expo.extra,
      googleMapsApiKeyAndroid: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
      googleMapsApiKeyIos: process.env.GOOGLE_MAPS_API_KEY_IOS,
      googleMapsApiKeyWeb: process.env.GOOGLE_MAPS_API_KEY_WEB,
      eas: {
        projectId: "07021e9f-ca4c-41b3-94de-373a5d5a6bc7",
      },
    },
  };
};