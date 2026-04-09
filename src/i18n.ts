import { i18n } from "@lingui/core";
import * as Localization from "expo-localization";
import enMessages from "./locales/en/messages.po";
import zhMessages from "./locales/zh/messages.po";

export const locales = { zh: "中文", en: "English" } as const;
export type Locale = keyof typeof locales;

const SOURCE_LOCALE: Locale = "zh";
const catalogMap = { zh: zhMessages, en: enMessages };

/** 自动检测移动端系统语言 */
export function detectLocale(): Locale {
  const lang = Localization.getLocales()[0]?.languageTag ?? "en";
  if (lang.startsWith("zh")) return "zh";
  return "en";
}

/** 同步初始化源语言，保证 App 首屏无缝渲染 */
export function initI18n() {
  i18n.load(SOURCE_LOCALE, zhMessages);
  i18n.activate(SOURCE_LOCALE);
}

/** 异步加载翻译文件并激活语言 */
export async function activateLocale(locale: Locale) {
  if (i18n.locale === locale) return;

  const messages = catalogMap[locale] ?? {};
  i18n.load(locale, messages);
  i18n.activate(locale);
}
