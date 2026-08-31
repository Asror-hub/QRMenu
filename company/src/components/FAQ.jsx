import { Reveal } from "./Reveal.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const FAQ_IDS = ["q1", "q2", "q3", "q4", "q5"];

export function FAQ() {
  const { t } = useLanguage();

  return (
    <section className="section section--faq" id="faq" aria-labelledby="faq-title">
      <div className="section__inner section__inner--faq">
        <Reveal className="section__header section__header--center" variant="up">
          <p className="eyebrow">{t("faq.eyebrow")}</p>
          <h2 id="faq-title">{t("faq.title")}</h2>
          <p>{t("faq.lead")}</p>
        </Reveal>
        <div className="faq-wrap">
          <div className="faq-list">
            {FAQ_IDS.map((id, index) => (
              <Reveal as="details" key={id} className="faq-item" delay={index * 80}>
                <summary>{t(`faq.${id}`)}</summary>
                <p>{t(`faq.a${id.slice(1)}`)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
