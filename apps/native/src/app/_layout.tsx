import { getLineaTheme } from "../../../../packages/design-tokens/src/index";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { resolveLineaThemeName } from "../features/sheets/linea-home-screen.presentation";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = getLineaTheme(resolveLineaThemeName(colorScheme));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={theme.name === "dark" ? "light" : "dark"} />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: theme.colors.background },
            headerShown: false,
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
