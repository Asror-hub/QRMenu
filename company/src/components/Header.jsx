import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { LANG_OPTIONS } from "../i18n";
import { BrandMark, BrandWordmark } from "./BrandMark.jsx";

const NAV_LINKS = [
  { href: "#demo", key: "nav.demo" },
  { href: "#product", key: "nav.products" },
  { href: "#platform", key: "nav.platform" },
  { href: "#pricing", key: "nav.pricing" },
  { href: "#faq", key: "nav.faq" },
];

export function Header() {
  const { lang, setLang, t } = useLanguage();
  const [solid, setSolid] = useState(false);
  const [progress, setProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);
  const currentLang = LANG_OPTIONS.find((o) => o.id === lang) || LANG_OPTIONS[0];

  useEffect(() => {
    let ticking = false;
    const update = () => {
      setSolid(window.scrollY > 18);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setMenuOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("nav-menu-open", menuOpen);
    return () => document.body.classList.remove("nav-menu-open");
  }, [menuOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setLangOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!langOpen) return;
    const onPointer = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [langOpen]);

  useEffect(() => {
    if (!menuOpen) setLangOpen(false);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const selectLang = (id) => {
    setLang(id);
    setLangOpen(false);
  };

  return (
    <header className={`site-header${solid ? " site-header--solid" : ""}${menuOpen ? " site-header--menu-open" : ""}`}>
      <div className="site-header__track">
        <div className="site-header__inner">
          <a className="brand" href="#top" aria-label="SmartQr home" onClick={closeMenu}>
            <BrandMark />
            <BrandWordmark />
          </a>

          <button
            type="button"
            className={`nav__burger${menuOpen ? " nav__burger--open" : ""}`}
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="nav__burger-lines" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </button>

          {menuOpen ? (
            <button
              type="button"
              className="nav__backdrop"
              aria-label={t("nav.closeMenu")}
              tabIndex={-1}
              onClick={closeMenu}
            />
          ) : null}

          <nav className={`nav${menuOpen ? " nav--open" : ""}`} id="primary-navigation" aria-label="Primary">
            <ul className="nav__links">
              {NAV_LINKS.map(({ href, key }) => (
                <li key={href}>
                  <a className="nav__link" href={href} onClick={closeMenu}>
                    {t(key)}
                  </a>
                </li>
              ))}
            </ul>

            <div className="nav__cta-group">
              <div className={`lang-dropdown${langOpen ? " is-open" : ""}`} ref={langRef}>
                <button
                  type="button"
                  className="lang-dropdown__trigger"
                  aria-label="Language"
                  aria-haspopup="listbox"
                  aria-expanded={langOpen}
                  onClick={() => setLangOpen((o) => !o)}
                >
                  <span>{currentLang.label}</span>
                  <svg className="lang-dropdown__chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <path
                      d="M2.5 4.5 6 8l3.5-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {langOpen ? (
                  <ul className="lang-dropdown__menu" role="listbox" aria-label="Language">
                    {LANG_OPTIONS.map((option) => (
                      <li key={option.id} role="option" aria-selected={lang === option.id}>
                        <button
                          type="button"
                          className={`lang-dropdown__option${lang === option.id ? " is-active" : ""}`}
                          onClick={() => selectLang(option.id)}
                        >
                          {option.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <a className="btn btn--primary btn--nav" href="#contact" onClick={closeMenu}>
                {t("nav.contactCta")}
              </a>
            </div>
          </nav>
        </div>
      </div>
      <div className="scroll-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden />
    </header>
  );
}
