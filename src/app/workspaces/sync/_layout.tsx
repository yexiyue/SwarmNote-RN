import { Stack } from "expo-router";

export default function SyncWizardLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Prevent swipe-to-dismiss during active sync; syncing.tsx covers the
        // "background" case via an explicit button.
        gestureEnabled: false,
      }}
    />
  );
}
