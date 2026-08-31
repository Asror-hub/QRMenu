import { useLanguage } from "../context/LanguageContext.jsx";
import shotMix from "../assets/images/mix.png";

export function Hero() {
  const { t } = useLanguage();

  return (
    <section className="hero" id="top" aria-labelledby="hero-brand">
      <div className="hero__grid" aria-hidden />
      <div className="hero__wash" aria-hidden />

      <div className="hero__inner">
        <div className="hero__copy">
          <p className="hero__brand" id="hero-brand">
            QRMenu
          </p>
          <h1 className="hero__title">{t("hero.title")}</h1>
          <p className="hero__lead">{t("hero.lead")}</p>
          <div className="hero__actions">
            <a className="btn btn--primary btn--lg" href="#contact">
              {t("hero.ctaWalkthrough")}
            </a>
            <a className="btn btn--ghost btn--lg" href="#demo">
              {t("hero.ctaWatch")}
            </a>
          </div>
        </div>

        <div className="hero__stage">
          <div className="hero__pedestal" aria-hidden />
          <img
            className="hero__mix"
            src={shotMix}
            alt={t("hero.stageAria")}
            decoding="async"
            fetchPriority="high"
          />
        </div>
      </div>
    </section>
  );
}
