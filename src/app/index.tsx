import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { greet } from "react-native-swarmnote-core";
import { AnimatedIcon } from "@/components/animated-icon";

export default function HomeScreen() {
  return (
    <View className="flex-1 justify-center flex-row bg-background">
      <SafeAreaView className="flex-1 px-4 items-center gap-3 max-w-150">
        <View className="items-center justify-center flex-1 px-4 gap-4">
          <AnimatedIcon />
          <Text className="text-2xl font-bold text-foreground text-center">
            Welcome to SwarmNote
          </Text>
        </View>

        <Text className="text-sm font-mono text-muted-foreground uppercase">get started</Text>

        <View className="self-stretch px-3 py-4 rounded-lg bg-muted gap-3">
          <Text className="text-sm text-muted-foreground">
            Edit <Text className="font-mono text-foreground">src/app/index.tsx</Text> to get started
          </Text>
        </View>

        <Text className="text-sm font-mono text-primary">{greet("SwarmNote")}</Text>

        <Link href={"/editor-test" as never} asChild>
          <Pressable className="py-3 px-5 rounded-lg bg-primary active:opacity-80">
            <Text className="text-primary-foreground font-medium">Open Editor Test</Text>
          </Pressable>
        </Link>
      </SafeAreaView>
    </View>
  );
}
