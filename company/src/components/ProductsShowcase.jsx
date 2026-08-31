import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Reveal } from "./Reveal.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import shot1 from "../assets/images/01.png";
import shot2 from "../assets/images/02.png";
import shot3 from "../assets/images/03.png";
import shot4 from "../assets/images/04.png";
import shot5 from "../assets/images/05.png";
import shot6 from "../assets/images/06.png";
import shot7 from "../assets/images/07.png";

const products = [
  { id: "qr-menu", i18n: "online-menu", accent: "blue", src: shot1 },
  { id: "table-ordering", i18n: "table-ordering", accent: "mint", src: shot2 },
  { id: "order-receiving", i18n: "order-receiving", accent: "violet", src: shot3 },
  { id: "menu-admin", i18n: "menu-admin", accent: "sand", src: shot4 },
  { id: "staff-orders", i18n: "staff-orders", accent: "slate", src: shot5 },
  { id: "reservations", i18n: "reservations", accent: "coral", src: shot6 },
  { id: "feedback", i18n: "feedback", accent: "sky", src: shot7 },
];

export function ProductsShowcase() {
  const { t } = useLanguage();
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (!lightbox) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightbox]);

  const closeLightbox = () => setLightbox(null);

  return (
    <section className="section section--products" id="product" aria-labelledby="products-title">
      <div className="section__inner section__inner--wide">
        <Reveal className="section__header section__header--center products-intro" variant="up">
          <p className="eyebrow">{t("products.eyebrow")}</p>
          <h2 id="products-title">{t("products.title")}</h2>
          <p>{t("products.lead")}</p>
        </Reveal>

        <div className="product-panels">
          {products.map((product, index) => {
            const n = String(index + 1);
            const flip = index % 2 === 1;
            const prefix = `product.${product.i18n}`;
            const title = t(`${prefix}.title`);
            const points = [1, 2, 3, 4].map((i) => t(`${prefix}.p${i}`));
            return (
              <Reveal
                key={product.id}
                className="product-panel-wrap"
                variant={flip ? "right" : "left"}
                delay={index * 40}
              >
                <article
                  className={`product-panel product-panel--${product.accent}${flip ? " product-panel--flip" : ""}`}
                  aria-labelledby={`product-${product.id}-title`}
                >
                  <div className="product-panel__copy">
                    <div className="product-panel__meta">
                      <span className="product-panel__index">{n}</span>
                      <span className="product-panel__kicker">{t(`${prefix}.kicker`)}</span>
                    </div>
                    <h3 id={`product-${product.id}-title`}>{title}</h3>
                    <ul className="product-panel__points">
                      {points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                    <a className="product-panel__details" href="#contact">
                      {t("products.details")}
                      <span aria-hidden>→</span>
                    </a>
                  </div>

                  <div className="product-panel__visual">
                    <span className="product-panel__bg-num" aria-hidden>
                      {n}
                    </span>
                    <button
                      type="button"
                      className="product-panel__shot-btn"
                      onClick={() => setLightbox({ src: product.src, alt: title })}
                      aria-label={t("products.viewShot")}
                    >
                      <img
                        className="product-panel__shot"
                        src={product.src}
                        alt={title}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>

      {lightbox
        ? createPortal(
            <div
              className="shot-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label={lightbox.alt}
              onClick={closeLightbox}
            >
              <button
                type="button"
                className="shot-lightbox__close"
                onClick={closeLightbox}
                aria-label={t("products.closeShot")}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <img className="shot-lightbox__img" src={lightbox.src} alt={lightbox.alt} />
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
