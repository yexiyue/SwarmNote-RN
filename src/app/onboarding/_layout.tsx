import { Stack } from "expo-router";

/** Onboarding is a forward-only wizard. Hide header and block the back
 *  gesture so users can't swipe out mid-flow (desktop parity). */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        animation: "slide_from_right",
      }}
    />
  );
}
