// app.config.js
import appJson from "./app.json";

export default ({ config }) => {
  return {
    ...appJson.expo,
    ...config,

    // Deep link de l'application : sert au retour automatique après la page Stripe (mobile)
    scheme: appJson.expo.scheme || "madabienetre",

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
      "expo-notifications",
      // ✅ Stripe : formulaire de carte intégré (CardField) sur Android / iOS
      // ⚠️ Doit être un tableau AVEC un objet d'options (la forme "chaîne seule" fait planter le plugin :
      // « Cannot read properties of undefined (reading 'merchantIdentifier') »).
      [
        "@stripe/stripe-react-native",
        {
          merchantIdentifier: "",
          enableGooglePay: false,
        },
      ],
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