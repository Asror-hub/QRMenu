import {
  DAY_KEYS,
  LOCALE_BY_LANG,
  SUPPORTED_LANGS,
  translations
} from "./translations";

export { DAY_KEYS, LOCALE_BY_LANG, SUPPORTED_LANGS };

export const normalizeLang = (value) => {
  const lang = String(value || "").toLowerCase();
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

export const getDayLabels = (lang) =>
  DAY_KEYS.map((key) => t(lang, `day_${key}`));

export const statusLabel = (lang, statusKey) => {
  switch (String(statusKey || "").toLowerCase()) {
    case "accepted":
      return t(lang, "statusAccepted");
    case "preparing":
      return t(lang, "statusPreparing");
    case "ready":
      return t(lang, "statusReady");
    case "finish":
      return t(lang, "statusFinished");
    default:
      return t(lang, "statusPending");
  }
};

export const readStoredLanguage = () => {
  try {
    return normalizeLang(localStorage.getItem("qrmenu_lang"));
  } catch {
    return "en";
  }
};

export const storeLanguage = (lang) => {
  const normalized = normalizeLang(lang);
  try {
    localStorage.setItem("qrmenu_lang", normalized);
  } catch {
    // ignore storage errors
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = normalized;
  }
  return normalized;
};
