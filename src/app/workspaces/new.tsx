import { Trans, useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { ArrowLeft, FolderPlus } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { UniffiRecentWorkspace } from "react-native-swarmnote-core";
import { Text } from "@/components/ui/text";
import { createWorkspace } from "@/core/workspace-manager";
import { useThemeColors } from "@/hooks/useThemeColors";
import { validateWorkspaceName } from "@/lib/workspace-naming";
import { useRecentWorkspacesStore } from "@/stores/recent-workspaces-store";

export default function WorkspaceCreate() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useLingui();
  const recentItems = useRecentWorkspacesStore((s) => s.items);
  const refreshRecent = useRecentWorkspacesStore((s) => s.refresh);

  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (recentItems === null) {
      refreshRecent();
    }
  }, [recentItems, refreshRecent]);

  const validation = useMemo(() => {
    if (name.length === 0) return { ok: false, reason: "" } as const;
    const v = validateWorkspaceName(name);
    if (!v.ok) return v;
    if (isDuplicateName(recentItems, name)) {
      return { ok: false, reason: t`同名工作区已存在` } as const;
    }
    return { ok: true } as const;
  }, [name, recentItems, t]);

  const canSubmit = validation.ok && !submitting;
  const inlineError = name.length === 0 ? null : validation.ok ? null : validation.reason;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError(null);
    try {
      await createWorkspace(name);
      await refreshRecent();
      router.dismissAll();
      router.replace("/(main)" as never);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="h-13 flex-row items-center gap-3 px-4">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityLabel={t`返回`}
            disabled={submitting}
          >
            <ArrowLeft color={colors.foreground} size={22} />
          </Pressable>
          <Text className="text-[16px] font-semibold text-foreground">
            <Trans>新建工作区</Trans>
          </Text>
        </View>

        <ScrollView
          contentContainerClassName="gap-6 px-6 pt-4 pb-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          className="flex-1"
        >
          <View className="items-center gap-3 pt-4">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <FolderPlus color={colors.primary} size={28} strokeWidth={1.8} />
            </View>
            <Text className="text-[20px] font-semibold text-foreground">
              <Trans>创建一个工作区</Trans>
            </Text>
            <Text className="text-center text-[13px] text-muted-foreground">
              <Trans>在 App 空间里开辟一块独立的笔记区域</Trans>
            </Text>
          </View>

          <View className="gap-2">
            <Text className="px-1 text-[12px] font-medium text-muted-foreground">
              <Trans>工作区名称</Trans>
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t`我的笔记`}
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={50}
              editable={!submitting}
              className="h-12 rounded-lg border border-border bg-card px-3 text-[15px] text-foreground"
              style={{
                color: colors.foreground,
                textAlignVertical: "center",
                ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
              }}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            {inlineError ? (
              <Text className="px-1 text-[12px] text-destructive">{inlineError}</Text>
            ) : (
              <Text className="px-1 text-[11px] text-muted-foreground">
                <Trans>存储在 App 私有空间，不会出现在系统文件 App 中</Trans>
              </Text>
            )}
            {serverError ? (
              <Text className="px-1 text-[12px] text-destructive">{serverError}</Text>
            ) : null}
          </View>
        </ScrollView>

        <View className="gap-3 px-6 pt-2 pb-4">
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={t`创建工作区`}
            className={`h-12 flex-row items-center justify-center rounded-lg ${
              canSubmit ? "bg-primary" : "bg-primary/40"
            }`}
          >
            {submitting ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Text className="text-[15px] font-semibold text-primary-foreground">
                <Trans>创建工作区</Trans>
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function isDuplicateName(items: UniffiRecentWorkspace[] | null, name: string): boolean {
  if (items === null) return false;
  return items.some((w) => w.name === name);
}
