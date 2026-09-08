import { useEffect, useRef, useState } from "react";
import { Image, useWindowDimensions, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import Constants from "expo-constants";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { RestaurantProvider } from "@/src/context/RestaurantContext";
import { ThemeProvider, useTheme } from "@/src/context/ThemeContext";
import { LanguageProvider } from "@/src/context/LanguageContext";

const SPLASH_GOLD = "#B8922A";

void SplashScreen.preventAutoHideAsync();

// Expo Go's native splash is always the Expo logo. Hold our branded screen
// long enough to see it; a real build already has the logo in native splash.
const MIN_BRAND_SPLASH_MS = Constants.appOwnership === "expo" ? 1800 : 600;

function SplashPulse({ delay, diamond }: { delay: number; diamond?: boolean }) {
  const progress = useSharedValue(0.55);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 480, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.55, { duration: 480, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false
      )
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { rotate: diamond ? "45deg" : "0deg" },
      { scale: 0.82 + progress.value * 0.28 },
    ],
  }));

  const size = diamond ? 16 : 14;

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: diamond ? 2 : 7,
          backgroundColor: SPLASH_GOLD,
          marginHorizontal: 10,
          shadowColor: SPLASH_GOLD,
          shadowOpacity: 0.45,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
          elevation: 3,
        },
        style,
      ]}
    />
  );
}

function SplashLoader() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 36,
      }}
    >
      <SplashPulse delay={0} />
      <SplashPulse delay={160} diamond />
      <SplashPulse delay={320} />
    </View>
  );
}

function AppEntrySplash({ onReady }: { onReady: () => void }) {
  const { width } = useWindowDimensions();
  const logoSize = Math.min(width * 0.72, 340);

  return (
    <View
      onLayout={onReady}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
      }}
    >
      <Image
        source={require("../assets/images/splash-icon.png")}
        style={{ width: logoSize, height: logoSize }}
        resizeMode="contain"
      />
      <View style={{ marginTop: -Math.round(logoSize * 0.08) }}>
        <SplashLoader />
      </View>
    </View>
  );
}

function RootLayoutNav() {
  const { user, loading } = useAuth();

  // Wait for session restore so we never flash the admin stack unauthenticated.
  if (loading) {
    return <AppEntrySplash onReady={() => void SplashScreen.hideAsync()} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Screen name="index" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <RestaurantProvider>
              <RootLayoutWithStatusBar />
            </RestaurantProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutWithStatusBar() {
  const { theme } = useTheme();
  const { loading } = useAuth();
  const [brandSplashDone, setBrandSplashDone] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (loading) return;
    const wait = Math.max(0, MIN_BRAND_SPLASH_MS - (Date.now() - startedAt.current));
    const timer = setTimeout(() => setBrandSplashDone(true), wait);
    return () => clearTimeout(timer);
  }, [loading]);

  const showingSplash = !brandSplashDone;

  return (
    <>
      {showingSplash ? (
        <AppEntrySplash onReady={() => void SplashScreen.hideAsync()} />
      ) : (
        <RootLayoutNav />
      )}
      <StatusBar
        style={showingSplash || theme !== "dark" ? "dark" : "light"}
        hidden={false}
        translucent={false}
      />
    </>
  );
}
