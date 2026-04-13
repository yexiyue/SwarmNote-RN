import {
  TabList,
  type TabListProps,
  TabSlot,
  Tabs,
  TabTrigger,
  type TabTriggerSlotProps,
} from "expo-router/ui";
import { Pressable, Text, View } from "react-native";

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: "100%" }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton>Explore</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} className="active:opacity-70">
      <View className={`py-1 px-3 rounded-lg ${isFocused ? "bg-accent" : "bg-muted"}`}>
        <Text className={`text-sm ${isFocused ? "text-foreground" : "text-muted-foreground"}`}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} className="absolute w-full p-3 justify-center items-center flex-row">
      <View className="py-2 px-5 rounded-2xl flex-row items-center grow gap-2 max-w-150 bg-muted">
        <Text className="text-sm font-bold text-foreground mr-auto">SwarmNote</Text>
        {props.children}
      </View>
    </View>
  );
}
