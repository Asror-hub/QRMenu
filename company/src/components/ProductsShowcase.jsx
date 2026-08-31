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
                    <h3 id={`product-${product.id}-title`}>{t(`${prefix}.title`)}</h3>
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
                    <img
                      className="product-panel__shot"
                      src={product.src}
                      alt={t(`${prefix}.title`)}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
