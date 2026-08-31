import { useLanguage } from "../context/LanguageContext.jsx";
import shotPhone from "../assets/images/phone.png";

function QrMark() {
  return (
    <svg className="hero__qr-svg" viewBox="0 0 29 29" aria-hidden>
      <rect width="29" height="29" fill="#fff" />
      <g fill="#0b1f3a">
        <rect x="2" y="2" width="7" height="7" />
        <rect x="3" y="3" width="5" height="5" fill="#fff" />
        <rect x="4" y="4" width="3" height="3" />
        <rect x="20" y="2" width="7" height="7" />
        <rect x="21" y="3" width="5" height="5" fill="#fff" />
        <rect x="22" y="4" width="3" height="3" />
        <rect x="2" y="20" width="7" height="7" />
        <rect x="3" y="21" width="5" height="5" fill="#fff" />
        <rect x="4" y="22" width="3" height="3" />
        <rect x="10" y="2" width="1" height="1" />
        <rect x="12" y="2" width="1" height="1" />
        <rect x="14" y="2" width="1" height="1" />
        <rect x="16" y="2" width="1" height="1" />
        <rect x="18" y="2" width="1" height="1" />
        <rect x="2" y="10" width="1" height="1" />
        <rect x="2" y="12" width="1" height="1" />
        <rect x="2" y="14" width="1" height="1" />
        <rect x="2" y="16" width="1" height="1" />
        <rect x="2" y="18" width="1" height="1" />
        <rect x="10" y="10" width="2" height="2" />
        <rect x="14" y="10" width="1" height="2" />
        <rect x="17" y="10" width="2" height="1" />
        <rect x="21" y="10" width="1" height="1" />
        <rect x="24" y="10" width="2" height="2" />
        <rect x="11" y="13" width="1" height="1" />
        <rect x="13" y="13" width="3" height="1" />
        <rect x="18" y="13" width="1" height="2" />
        <rect x="22" y="13" width="2" height="1" />
        <rect x="10" y="16" width="2" height="1" />
        <rect x="14" y="16" width="1" height="1" />
        <rect x="16" y="16" width="2" height="2" />
        <rect x="20" y="16" width="1" height="1" />
        <rect x="23" y="16" width="1" height="2" />
        <rect x="26" y="16" width="1" height="1" />
        <rect x="10" y="19" width="1" height="1" />
        <rect x="12" y="19" width="2" height="1" />
        <rect x="16" y="19" width="1" height="1" />
        <rect x="19" y="19" width="2" height="1" />
        <rect x="23" y="19" width="1" height="1" />
        <rect x="26" y="19" width="1" height="1" />
        <rect x="11" y="21" width="1" height="2" />
        <rect x="14" y="21" width="2" height="1" />
        <rect x="18" y="21" width="1" height="1" />
        <rect x="20" y="21" width="2" height="2" />
        <rect x="24" y="21" width="1" height="1" />
        <rect x="10" y="24" width="1" height="1" />
        <rect x="13" y="24" width="1" height="2" />
        <rect x="16" y="24" width="2" height="1" />
        <rect x="20" y="24" width="1" height="1" />
        <rect x="22" y="24" width="3" height="1" />
        <rect x="10" y="26" width="2" height="1" />
        <rect x="15" y="26" width="1" height="1" />
        <rect x="18" y="26" width="1" height="1" />
        <rect x="21" y="26" width="2" height="1" />
        <rect x="25" y="26" width="1" height="1" />
      </g>
    </svg>
  );
}

export function Hero() {
  const { t } = useLanguage();

  return (
    <section className="hero" id="top" aria-labelledby="hero-brand">
      <div className="hero__grid" aria-hidden />
      <div className="hero__wash" aria-hidden />

      <div className="hero__inner">
        <div className="hero__text">
          <div className="hero__copy">
            <p className="hero__brand" id="hero-brand">
              SmartQr
            </p>
            <h1 className="hero__title">{t("hero.title")}</h1>
            <p className="hero__lead">{t("hero.lead")}</p>
          </div>
          <div className="hero__actions">
            <a className="btn btn--primary btn--lg" href="#contact">
              {t("hero.ctaWalkthrough")}
            </a>
          </div>
        </div>

        <div className="hero__stage" aria-label={t("hero.stageAria")}>
          <div className="hero__scene">
            <div className="hero__qr">
              <div className="hero__qr-ripples" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <div className="hero__qr-face">
                <span className="hero__qr-brand">SmartQr</span>
                <div className="hero__qr-code">
                  <span className="hero__qr-glow" aria-hidden />
                  <span className="hero__lock" aria-hidden />
                  <span className="hero__scanline" aria-hidden />
                  <QrMark />
                </div>
                <strong className="hero__qr-table">{t("platform.table12")}</strong>
              </div>
            </div>
            <div className="hero__beam" aria-hidden />
            <div className="hero__phone">
              <span className="hero__phone-lens" aria-hidden />
              <img
                className="hero__phone-img"
                src={shotPhone}
                alt={t("hero.altPhone")}
                decoding="async"
                fetchPriority="high"
              />
            </div>
          </div>
        </div>
      </div>

      <a className="hero__scroll" href="#demo">
        <span className="hero__scroll-label">{t("hero.ctaWatch")}</span>
        <span className="hero__scroll-mouse" aria-hidden>
          <span className="hero__scroll-wheel" />
        </span>
      </a>
    </section>
  );
}
