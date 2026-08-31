import { Reveal } from "./Reveal.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const venues = [
  {
    id: "restaurants",
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "cafes",
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "bars",
    image:
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "hotels",
    image:
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "chains",
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "ghost",
    image:
      "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80",
  },
];

export function Ecosystem() {
  const { t } = useLanguage();

  return (
    <section className="section section--ecosystem" id="ecosystem" aria-labelledby="ecosystem-title">
      <div className="section__inner section__inner--wide">
        <Reveal className="section__header section__header--center ecosystem-intro" variant="up">
          <h2 id="ecosystem-title">{t("eco.title")}</h2>
          <p>{t("eco.lead")}</p>
        </Reveal>

        <div className="eco-grid">
          {venues.map((venue, index) => (
            <Reveal key={venue.id} className="eco-card" variant="scale" delay={index * 70}>
              <div className="eco-card__media">
                <img
                  src={venue.image}
                  alt={t(`eco.${venue.id}.title`)}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="eco-card__body">
                <h3>{t(`eco.${venue.id}.title`)}</h3>
                <p>{t(`eco.${venue.id}.text`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
