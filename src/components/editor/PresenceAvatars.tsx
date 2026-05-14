import type { AwarenessUserState } from "@swarmnote/editor-react-native/contracts";
import { Laptop, Smartphone } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEditorPresenceStore } from "@/stores/editor-presence-store";

interface PresenceAvatarsProps {
  /** Optional override; defaults to the active doc's presence in the store. */
  users?: AwarenessUserState[];
}

function PlatformIcon({
  platform,
  size = 14,
  color = "#9ca3af",
}: {
  platform: AwarenessUserState["platform"];
  size?: number;
  color?: string;
}) {
  return platform === "desktop" ? (
    <Laptop size={size} color={color} />
  ) : (
    <Smartphone size={size} color={color} />
  );
}

export function PresenceAvatars({ users: usersProp }: PresenceAvatarsProps) {
  const usersFromStore = useEditorPresenceStore((s) => s.presence);
  const users = usersProp ?? usersFromStore;

  if (users.length === 0) return null;

  // Stable order so two devices show the same arrangement.
  const sorted = [...users].sort((a, b) => a.deviceId.localeCompare(b.deviceId));
  const visible = sorted.slice(0, 3);
  const overflow = sorted.length - visible.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`协作者 ${sorted.length} 人`}
          hitSlop={6}
        >
          <View className="flex-row items-center">
            {visible.map((u, idx) => (
              <View
                key={u.deviceId}
                style={{
                  backgroundColor: u.color,
                  marginLeft: idx === 0 ? 0 : -8,
                }}
                className="h-7 w-7 rounded-full items-center justify-center border-2 border-background"
              >
                <Text className="text-xs font-semibold text-white">
                  {u.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            ))}
            {overflow > 0 && (
              <View
                style={{ marginLeft: -8 }}
                className="h-7 w-7 rounded-full items-center justify-center bg-muted border-2 border-background"
              >
                <Text className="text-xs font-medium text-muted-foreground">+{overflow}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <Text className="px-2 py-1 text-xs font-medium text-muted-foreground">
          协作者 · {sorted.length}
        </Text>
        <View className="mt-1">
          {sorted.map((u) => (
            <View key={u.deviceId} className="flex-row items-center gap-2 rounded-md px-2 py-2">
              <View
                style={{ backgroundColor: u.color }}
                className="h-7 w-7 rounded-full items-center justify-center"
              >
                <Text className="text-xs font-semibold text-white">
                  {u.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                {u.name}
              </Text>
              <PlatformIcon platform={u.platform} />
            </View>
          ))}
        </View>
      </PopoverContent>
    </Popover>
  );
}
