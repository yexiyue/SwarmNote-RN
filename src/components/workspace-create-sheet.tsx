import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";
import type { UniffiRecentWorkspace } from "react-native-swarmnote-core";
import { Text } from "@/components/ui/text";
import { createWorkspace } from "@/core/workspace-manager";
import { useThemeColors } from "@/hooks/useThemeColors";
import { validateWorkspaceName } from "@/lib/workspace-naming";
import { useRecentWorkspacesStore } from "@/stores/recent-workspaces-store";

export interface WorkspaceCreateSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface WorkspaceCreateSheetProps {
  /** Called after the new workspace is fully opened and set active. Host
   *  typically uses this to `router.replace("/(main)")` so the user lands
   *  in the editor. */
  onCreated?: (path: string) => void;
}

export const WorkspaceCreateSheet = forwardRef<WorkspaceCreateSheetRef, WorkspaceCreateSheetProps>(
  function WorkspaceCreateSheet({ onCreated }, ref) {
    const colors = useThemeColors();
    const sheetRef = useRef<BottomSheetModal>(null);
    const recentItems = useRecentWorkspacesStore((s) => s.items);
    const refresh = useRecentWorkspacesStore((s) => s.refresh);

    const [name, setName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      present: () => {
        setName("");
        setServerError(null);
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const validation = useMemo(() => {
      if (name.length === 0) return { ok: false, reason: "" } as const;
      const v = validateWorkspaceName(name);
      if (!v.ok) return v;
      if (isDuplicateName(recentItems, name)) {
        return { ok: false, reason: "同名工作区已存在" } as const;
      }
      return { ok: true } as const;
    }, [name, recentItems]);

    const canSubmit = validation.ok && !submitting;
    const inlineError = name.length === 0 ? null : validation.ok ? null : validation.reason;

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          opacity={0.4}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
        />
      ),
      [],
    );

    const handleSubmit = async () => {
      if (!canSubmit) return;
      setSubmitting(true);
      setServerError(null);
      try {
        const ws = await createWorkspace(name);
        const path = ws.info().path;
        await refresh();
        sheetRef.current?.dismiss();
        setName("");
        onCreated?.(path);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setServerError(msg);
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <BottomSheetModal
        ref={sheetRef}
        enableDynamicSizing
        enablePanDownToClose
        keyboardBehavior={Platform.OS === "ios" ? "interactive" : "interactive"}
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView>
          <View className="gap-4 px-5 pb-6 pt-2">
            <Text className="text-[18px] font-semibold text-foreground">新建工作区</Text>

            <View className="gap-2">
              <Text className="text-[12px] text-muted-foreground">工作区名称</Text>
              <BottomSheetTextInput
                value={name}
                onChangeText={setName}
                placeholder="我的笔记"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={50}
                editable={!submitting}
                className="h-11 rounded-lg border border-border bg-background px-3 text-[15px] text-foreground"
                style={{
                  color: colors.foreground,
                  includeFontPadding: Platform.OS === "android" ? false : undefined,
                }}
                onSubmitEditing={handleSubmit}
                returnKeyType="done"
              />
              {inlineError ? (
                <Text className="text-[12px] text-destructive">{inlineError}</Text>
              ) : (
                <Text className="text-[11px] text-muted-foreground">
                  存储在 App 私有空间，不会出现在系统文件 App 中
                </Text>
              )}
              {serverError ? (
                <Text className="text-[12px] text-destructive">{serverError}</Text>
              ) : null}
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="创建工作区"
              className={`h-11 flex-row items-center justify-center rounded-lg ${
                canSubmit ? "bg-primary" : "bg-primary/40"
              }`}
            >
              {submitting ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text className="text-[15px] font-semibold text-primary-foreground">创建</Text>
              )}
            </Pressable>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

function isDuplicateName(items: UniffiRecentWorkspace[] | null, name: string): boolean {
  if (items === null) return false;
  return items.some((w) => w.name === name);
}
