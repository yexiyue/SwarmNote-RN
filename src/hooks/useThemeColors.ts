import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";
import { useUnstableNativeVariable } from "nativewind";
import { useMemo } from "react";
import { useColorScheme } from "react-native";

function hsl(value: string | undefined): string {
  return value ? `hsl(${value})` : "transparent";
}

/**
 * 从 CSS 变量动态读取主题色值，global.css 是唯一真相源。
 * 用于需要 JS 颜色值的场景（如图标 color prop、React Navigation ThemeProvider）。
 */
export function useThemeColors() {
  const background = useUnstableNativeVariable("--background");
  const foreground = useUnstableNativeVariable("--foreground");
  const card = useUnstableNativeVariable("--card");
  const primary = useUnstableNativeVariable("--primary");
  const destructive = useUnstableNativeVariable("--destructive");
  const border = useUnstableNativeVariable("--border");
  const mutedForeground = useUnstableNativeVariable("--muted-foreground");

  return useMemo(
    () => ({
      background: hsl(background),
      foreground: hsl(foreground),
      card: hsl(card),
      primary: hsl(primary),
      destructive: hsl(destructive),
      border: hsl(border),
      mutedForeground: hsl(mutedForeground),
    }),
    [background, foreground, card, primary, destructive, border, mutedForeground],
  );
}

/**
 * 构建 React Navigation Theme 对象，从 CSS 变量动态读取。
 */
export function useNavTheme(): Theme {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = useThemeColors();

  return useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        border: colors.border,
        card: colors.card,
        notification: colors.destructive,
        primary: colors.primary,
        text: colors.foreground,
      },
    };
  }, [isDark, colors]);
}
