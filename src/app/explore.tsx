import { Image } from "expo-image";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Collapsible } from "@/components/ui/collapsible";

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 80,
        paddingHorizontal: 16,
      }}
    >
      <View className="max-w-150 self-center w-full">
        <View className="gap-3 items-center py-6">
          <Text className="text-xl font-semibold text-foreground">Explore</Text>
          <Text className="text-sm text-muted-foreground text-center">
            This app includes example code to help you get started.
          </Text>
        </View>

        <View className="gap-5 pt-3">
          <Collapsible title="File-based routing">
            <Text className="text-sm text-foreground">
              This app has screens defined in <Text className="font-mono">src/app/</Text>. The
              layout file sets up the tab navigator.
            </Text>
          </Collapsible>

          <Collapsible title="Android, iOS, and web support">
            <Text className="text-sm text-foreground">
              You can open this project on Android, iOS, and the web.
            </Text>
            <Image
              source={require("@/assets/images/tutorial-web.png")}
              className="w-full rounded-lg mt-2"
              style={{ aspectRatio: 296 / 171 }}
            />
          </Collapsible>

          <Collapsible title="Images">
            <Text className="text-sm text-foreground">
              For static images, you can use the <Text className="font-mono">@2x</Text> and{" "}
              <Text className="font-mono">@3x</Text> suffixes for different screen densities.
            </Text>
            <Image
              source={require("@/assets/images/react-logo.png")}
              style={{ width: 100, height: 100, alignSelf: "center" }}
            />
          </Collapsible>

          <Collapsible title="Light and dark mode">
            <Text className="text-sm text-foreground">
              This app supports light and dark mode. The theme follows your system setting
              automatically, powered by NativeWind and CSS variables.
            </Text>
          </Collapsible>

          <Collapsible title="Animations">
            <Text className="text-sm text-foreground">
              The collapsible component uses{" "}
              <Text className="font-mono">react-native-reanimated</Text> for smooth animations.
            </Text>
          </Collapsible>
        </View>
      </View>
    </ScrollView>
  );
}
