import { useState } from "react";
import { Reveal } from "./Reveal.jsx";
import { goToContact } from "../contact.js";
import { PLANS } from "../payments/plans.js";
import { useLanguage } from "../context/LanguageContext.jsx";

function formatUzs(n) {
  return `${new Intl.NumberFormat("uz-UZ").format(n)} so'm`;
}

export function Pricing() {
  const { t } = useLanguage();
  const [billing, setBilling] = useState("monthly");
  const yearly = billing === "yearly";

  return (
    <section className="section section--pricing" id="pricing" aria-labelledby="pricing-title">
      <div className="section__inner section__inner--wide">
        <Reveal className="section__header section__header--center" variant="up">
          <p className="eyebrow">{t("pricing.eyebrow")}</p>
          <h2 id="pricing-title">{t("pricing.title")}</h2>
          <p>{t("pricing.lead")}</p>
        </Reveal>

        <Reveal className="pricing__billing" variant="scale" delay={60}>
          <div className="pricing__toggle" role="group" aria-label="Billing period">
            <button
              type="button"
              className={`pricing__toggle-btn${!yearly ? " is-active" : ""}`}
              aria-pressed={!yearly}
              onClick={() => setBilling("monthly")}
            >
              {t("pricing.monthly")}
            </button>
            <button
              type="button"
              className={`pricing__toggle-btn${yearly ? " is-active" : ""}`}
              aria-pressed={yearly}
              onClick={() => setBilling("yearly")}
            >
              {t("pricing.yearly")}
              <span className="pricing__save">{t("pricing.save")}</span>
            </button>
          </div>
        </Reveal>

        <div className="pricing__grid">
          {PLANS.map((plan, index) => {
            const price = yearly ? plan.yearly : plan.monthly;
            const billedYear = plan.yearly * 12;
            const name = t(`plan.${plan.id}.name`);
            const tagline = t(`plan.${plan.id}.tagline`);
            return (
              <Reveal key={plan.id} variant="scale" delay={index * 90}>
                <article
                  className={`pricing__card ${plan.variant}`.trim()}
                  aria-labelledby={`plan-${plan.id}-title`}
                >
                  {plan.popular ? (
                    <span className="pricing__badge" aria-hidden>
                      {t("pricing.mostPopular")}
                    </span>
                  ) : null}
                  <header className="pricing__head">
                    <h3 id={`plan-${plan.id}-title`} className="pricing__name">
                      {name}
                    </h3>
                    <p className="pricing__tagline">{tagline}</p>
                    <div className="pricing__price-row">
                      <span className="pricing__amount">{formatUzs(price)}</span>
                      <span className="pricing__period">
                        {t("pricing.perLocationMonth")}
                        {yearly ? t("pricing.billedYearly") : ""}
                      </span>
                    </div>
                    <p className="pricing__billed">
                      {yearly
                        ? t("pricing.perYear", { price: formatUzs(billedYear) })
                        : t("pricing.contactStart")}
                    </p>
                  </header>
                  {plan.includesKey ? (
                    <p className="pricing__includes">{t(plan.includesKey)}</p>
                  ) : null}
                  <ul className="pricing__features" aria-label={`${name} includes`}>
                    {plan.features.map((f) => {
                      const text = t(f.key);
                      return (
                        <li
                          key={f.key}
                          className={
                            f.included
                              ? "pricing__feat pricing__feat--yes"
                              : "pricing__feat pricing__feat--no"
                          }
                        >
                          <span className="pricing__feat-icon" aria-hidden>
                            {f.included ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M20 6L9 17l-5-5"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M6 6l12 12M18 6L6 18"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                />
                              </svg>
                            )}
                          </span>
                          <span>{text}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <footer className="pricing__foot">
                    <button
                      type="button"
                      className="pricing__cta"
                      onClick={() => goToContact(plan, billing, name)}
                    >
                      {t("pricing.choose", { name })}
                    </button>
                  </footer>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="pricing__note" variant="up" delay={160}>
          <p>
            {t("pricing.notePrefix")}
            <a href="#contact">{t("nav.contact")}</a>
            {t("pricing.noteSuffix")}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
