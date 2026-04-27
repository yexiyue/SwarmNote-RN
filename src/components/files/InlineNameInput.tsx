import { useLingui } from "@lingui/react/macro";
import { FileText, Folder, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, TextInput, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";

interface InlineNameInputProps {
  kind: "document" | "folder";
  value: string;
  submitting: boolean;
  error: string | null;
  depth: number;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function InlineNameInput({
  kind,
  value,
  submitting,
  error,
  depth,
  onChangeText,
  onSubmit,
  onCancel,
}: InlineNameInputProps) {
  const colors = useThemeColors();
  const { t } = useLingui();
  const Icon = kind === "folder" ? Folder : FileText;
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  // Set true by the cancel button's `onPressIn` (fires before TextInput's
  // `onBlur`), telling the blur handler to skip auto-submit. Without this
  // guard the blur-to-confirm path would race with the X button's intent.
  const cancelledRef = useRef(false);

  // AutoFocus on mount. `autoFocus` prop on TextInput works but timing can
  // race with the parent mount; manual focus via ref is more reliable on both
  // iOS and Android across RN versions.
  useEffect(() => {
    const id = setTimeout(() => ref.current?.focus(), 0);
    return () => clearTimeout(id);
  }, []);

  const handleBlur = () => {
    setFocused(false);
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    if (submitting) return;
    // Obsidian-style blur-to-confirm. Empty string routes through onSubmit's
    // own empty-string → cancelDraft branch, so no special-case needed here.
    onSubmit();
  };

  return (
    <View>
      <View
        style={{ paddingLeft: 8 + depth * 16 }}
        className="h-9 flex-row items-center gap-1.5 pr-2"
      >
        <View className="w-[14px]" />
        <Icon
          color={kind === "folder" ? colors.primary : colors.mutedForeground}
          size={15}
          strokeWidth={kind === "folder" ? 2 : 1.75}
        />
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          editable={!submitting}
          placeholder={kind === "folder" ? t`文件夹名称` : t`笔记标题`}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          blurOnSubmit
          className={cn(
            "flex-1 h-8 rounded-md border bg-card px-2 text-[13px] text-foreground",
            focused ? "border-primary" : "border-border",
          )}
          style={{
            color: colors.foreground,
            textAlignVertical: "center",
            paddingVertical: 0,
            ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
          }}
        />
        {submitting ? (
          <ActivityIndicator size="small" color={colors.mutedForeground} />
        ) : (
          <Pressable
            onPressIn={() => {
              cancelledRef.current = true;
            }}
            onPress={onCancel}
            hitSlop={6}
            accessibilityLabel={t`取消`}
            className="h-7 w-7 items-center justify-center rounded-md active:bg-muted"
          >
            <X color={colors.mutedForeground} size={14} />
          </Pressable>
        )}
      </View>
      {error ? (
        <Text
          style={{ paddingLeft: 8 + depth * 16 + 20 }}
          className="text-[11px] text-destructive pb-1"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
