import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getLocale,
  normalizeLang,
  readStoredLanguage,
  storeLanguage,
  t as translate,
} from "../i18n";

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => readStoredLanguage());

  useEffect(() => {
    storeLanguage(lang);
  }, [lang]);

  const setLang = useCallback((next) => {
    setLangState(normalizeLang(next));
  }, []);

  const t = useCallback(
    (key, vars) => translate(lang, key, vars),
    [lang]
  );

  const value = useMemo(
    () => ({
      lang,
      locale: getLocale(lang),
      setLang,
      t,
    }),
    [lang, setLang, t]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
};
