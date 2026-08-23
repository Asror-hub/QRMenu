import { NativeModules, Platform } from "react-native";
import {
  LANG_OPTIONS,
  LOCALE_BY_LANG,
  SUPPORTED_LANGS,
  translations,
  type AppLang,
  type TranslationKey,
} from "./translations";

export {
  LANG_OPTIONS,
  LANG_STORAGE_KEY,
  LOCALE_BY_LANG,
  SUPPORTED_LANGS,
  type AppLang,
  type TranslationKey,
} from "./translations";

export function normalizeLang(value?: string | null): AppLang {
  const lang = String(value || "")
    .toLowerCase()
    .replace("_", "-")
    .split("-")[0];
  return (SUPPORTED_LANGS as readonly string[]).includes(lang)
    ? (lang as AppLang)
    : "en";
}

export function getLocale(lang?: string | null) {
  return LOCALE_BY_LANG[normalizeLang(lang)] || LOCALE_BY_LANG.en;
}

export function t(
  lang: string | null | undefined,
  key: TranslationKey | string,
  vars: Record<string, string | number | null | undefined> = {}
) {
  const normalized = normalizeLang(lang);
  const dict = translations[normalized] || translations.en;
  let text = dict[key] ?? translations.en[key] ?? key;
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value ?? ""));
  });
  return text;
}

/** Best-effort device language tag for first launch (no extra native deps). */
export function detectDeviceLang(): AppLang {
  try {
    let tag = "";
    if (Platform.OS === "ios") {
      const settings = NativeModules.SettingsManager?.settings;
      tag =
        settings?.AppleLocale ||
        settings?.AppleLanguages?.[0] ||
        "";
    } else {
      tag =
        NativeModules.I18nManager?.localeIdentifier ||
        NativeModules.I18nManager?.locale ||
        "";
    }
    if (!tag) {
      tag = Intl.DateTimeFormat().resolvedOptions().locale || "";
    }
    return normalizeLang(tag);
  } catch {
    return "en";
  }
}
