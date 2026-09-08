require("dotenv").config();

export default {
  expo: {
    name: "SmartQr",
    slug: "qrmenu-admin-mobile",
    version: "1.0.0",
    orientation: "default",
    icon: "./assets/images/icon.png",
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    scheme: "qrmenu-admin",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: false,
      bundleIdentifier: "uz.qrmenu.admin",
      infoPlist: {
        CFBundleLocalizations: ["en", "ru", "uz"],
        CFBundleDevelopmentRegion: "en",
        ITSAppUsesNonExemptEncryption: false,
        NSPhotoLibraryUsageDescription:
          "SmartQr uses your photo library to add menu photos and a restaurant logo.",
        NSPhotoLibraryAddUsageDescription:
          "SmartQr can save table QR codes to your photo library.",
      },
    },
    android: {
      package: "uz.qrmenu.admin",
      adaptiveIcon: {
        backgroundColor: "#FFFFFF",
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
          imageWidth: 320,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: { backgroundColor: "#ffffff" },
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "SmartQr uses your photo library to add menu photos and a restaurant logo.",
        },
      ],
      [
        "expo-media-library",
        {
          photosPermission: "SmartQr can save table QR codes to your photos.",
          savePhotosPermission: "SmartQr can save table QR codes to your photos.",
        },
      ],
    ],
    experiments: {
      typedRoutes: false,
    },
    extra: {
      eas: {
        projectId: "7cfc4122-fe39-4925-863e-7cb0ea90dc3a",
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
      cloudinaryCloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "",
      cloudinaryUploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "",
      customerAppUrl: process.env.EXPO_PUBLIC_CUSTOMER_APP_URL ?? "",
      contactPhone: process.env.EXPO_PUBLIC_CONTACT_PHONE ?? "",
      contactEmail: process.env.EXPO_PUBLIC_CONTACT_EMAIL ?? "",
      contactWhatsapp: process.env.EXPO_PUBLIC_CONTACT_WHATSAPP ?? "",
      contactTelegram: process.env.EXPO_PUBLIC_CONTACT_TELEGRAM ?? "",
      marketingUrl: process.env.EXPO_PUBLIC_MARKETING_URL ?? "https://qrmenu.asrorkhanodilov.workers.dev",
    },
  },
};
