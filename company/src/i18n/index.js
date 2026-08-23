import {
  LANG_OPTIONS,
  LANG_STORAGE_KEY,
  LOCALE_BY_LANG,
  SUPPORTED_LANGS,
  translations,
} from "./translations";

export {
  LANG_OPTIONS,
  LANG_STORAGE_KEY,
  LOCALE_BY_LANG,
  SUPPORTED_LANGS,
};

export const normalizeLang = (value) => {
  const lang = String(value || "")
    .toLowerCase()
    .replace("_", "-")
    .split("-")[0];
  return SUPPORTED_LANGS.includes(lang) ? lang : "en";
};

export const getLocale = (lang) => LOCALE_BY_LANG[normalizeLang(lang)] || "en-US";

export const t = (lang, key, vars = {}) => {
  const normalized = normalizeLang(lang);
  const dict = translations[normalized] || translations.en;
  let text = dict[key] ?? translations.en[key] ?? key;
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value ?? ""));
  });
  return text;
};

export const detectBrowserLang = () => {
  try {
    const tag =
      (typeof navigator !== "undefined" &&
        (navigator.language || navigator.languages?.[0])) ||
      "";
    return normalizeLang(tag);
  } catch {
    return "en";
  }
};

export const readStoredLanguage = () => {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored) return normalizeLang(stored);
  } catch {
    // ignore
  }
  return detectBrowserLang();
};

export const storeLanguage = (lang) => {
  const normalized = normalizeLang(lang);
  try {
    localStorage.setItem(LANG_STORAGE_KEY, normalized);
  } catch {
    // ignore storage errors
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = normalized;
  }
  return normalized;
};
