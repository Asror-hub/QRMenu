import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { RestaurantProvider } from "@/src/context/RestaurantContext";
import { ThemeProvider, useTheme } from "@/src/context/ThemeContext";
import { LanguageProvider } from "@/src/context/LanguageContext";

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  // Wait for session restore so we never flash the admin stack unauthenticated.
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
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

  return (
    <>
      <RootLayoutNav />
      <StatusBar
        style={theme === "dark" ? "light" : "dark"}
        hidden={false}
        translucent={false}
      />
    </>
  );
}
