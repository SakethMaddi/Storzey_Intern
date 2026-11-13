import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Advance Pay",
  slug: "advance-pay-mobile",
  scheme: "advancepay",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  platforms: ["ios", "android"],
  ios: {
    bundleIdentifier: "com.advancepay.owner",
    supportsTablet: true,
    infoPlist: {
      CFBundleDisplayName: "Advance Pay",
      NSAllowsArbitraryLoads: false,
    },
  },
  android: {
    package: "com.advancepay.owner",
    adaptiveIcon: {
      backgroundColor: "#E0F2FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#F4F6FB",
        image: "./assets/splash-icon.png",
        imageWidth: 200,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "provisional-advance-pay-mobile",
    },
  },
});
