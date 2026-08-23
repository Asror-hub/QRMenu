require("dotenv").config();

export default {
  expo: {
    name: "QRMenu Admin",
    slug: "qrmenu-admin-mobile",
    version: "1.0.0",
    orientation: "default",
    icon: "./assets/images/icon.png",
    scheme: "qrmenu-admin",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      infoPlist: {
        // Declares in-app languages for App Store / device language lists.
        CFBundleLocalizations: ["en", "ru", "uz"],
        CFBundleDevelopmentRegion: "en",
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      edgeToEdgeEnabled: true,
      softwareKeyboardLayoutMode: "resize",
    },
    // Bundled UI languages (device-local preference; not store listing copy).
    locales: {
      en: "./locales/en.json",
      ru: "./locales/ru.json",
      uz: "./locales/uz.json",
    },
    web: {
      // SPA mode avoids expo-server SSR during `expo start --web`
      // (fixes "window is not defined" / "Cannot pipe to a closed stream").
      output: "single",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: { backgroundColor: "#000000" },
        },
      ],
    ],
    experiments: {
      typedRoutes: false,
    },
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
      cloudinaryCloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "",
      cloudinaryUploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "",
      customerAppUrl: process.env.EXPO_PUBLIC_CUSTOMER_APP_URL ?? "",
    },
  },
};
