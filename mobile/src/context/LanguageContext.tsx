import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  detectDeviceLang,
  getLocale,
  LANG_STORAGE_KEY,
  normalizeLang,
  t as translate,
  type AppLang,
  type TranslationKey,
} from "@/src/i18n";

type LanguageContextValue = {
  lang: AppLang;
  locale: string;
  ready: boolean;
  setLang: (next: AppLang) => Promise<void>;
  t: (key: TranslationKey | string, vars?: Record<string, string | number | null | undefined>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLang>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(LANG_STORAGE_KEY);
        if (cancelled) return;
        if (stored) {
          setLangState(normalizeLang(stored));
        } else {
          setLangState(detectDeviceLang());
        }
      } catch {
        if (!cancelled) setLangState(detectDeviceLang());
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLang = useCallback(async (next: AppLang) => {
    const normalized = normalizeLang(next);
    setLangState(normalized);
    try {
      await AsyncStorage.setItem(LANG_STORAGE_KEY, normalized);
    } catch {
      // Preference is still applied in-memory for this session.
    }
  }, []);

  const t = useCallback(
    (
      key: TranslationKey | string,
      vars?: Record<string, string | number | null | undefined>
    ) => translate(lang, key, vars),
    [lang]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      locale: getLocale(lang),
      ready,
      setLang,
      t,
    }),
    [lang, ready, setLang, t]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
