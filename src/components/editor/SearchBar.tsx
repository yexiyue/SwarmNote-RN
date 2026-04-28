import { useLingui } from "@lingui/react/macro";
import type { SearchState } from "@swarmnote/editor/types";
import { ChevronDown, ChevronUp, X } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";

interface SearchBarProps {
  searchState: SearchState | null;
  onQueryChange: (query: string) => void;
  onFindNext: () => void;
  onFindPrev: () => void;
  onClose: () => void;
}

export function SearchBar({
  searchState,
  onQueryChange,
  onFindNext,
  onFindPrev,
  onClose,
}: SearchBarProps) {
  const colors = useThemeColors();
  const { t } = useLingui();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matchText =
    searchState && searchState.totalMatches > 0
      ? searchState.activeMatchIndex !== null
        ? `${searchState.activeMatchIndex + 1}/${searchState.totalMatches}`
        : `${searchState.totalMatches}`
      : searchState?.query
        ? t`无结果`
        : "";

  return (
    <View
      style={{
        height: 48,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
        gap: 8,
      }}
    >
      <TextInput
        ref={inputRef}
        value={searchState?.query ?? ""}
        onChangeText={onQueryChange}
        placeholder={t`搜索...`}
        placeholderTextColor={colors.mutedForeground}
        returnKeyType="search"
        onSubmitEditing={onFindNext}
        clearButtonMode="while-editing"
        style={{
          flex: 1,
          height: 36,
          paddingHorizontal: 10,
          borderRadius: 8,
          backgroundColor: colors.card,
          color: colors.foreground,
          fontSize: 15,
        }}
      />

      {matchText ? (
        <Text
          style={{ fontSize: 12, color: colors.mutedForeground, minWidth: 42, textAlign: "center" }}
        >
          {matchText}
        </Text>
      ) : null}

      <Pressable
        onPress={onFindPrev}
        accessibilityRole="button"
        accessibilityLabel={t`上一个`}
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <ChevronUp size={20} color={colors.mutedForeground} />
      </Pressable>

      <Pressable
        onPress={onFindNext}
        accessibilityRole="button"
        accessibilityLabel={t`下一个`}
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <ChevronDown size={20} color={colors.mutedForeground} />
      </Pressable>

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t`关闭搜索`}
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <X size={20} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}
