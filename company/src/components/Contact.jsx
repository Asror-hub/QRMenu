import { useEffect, useState } from "react";
import { Reveal } from "./Reveal.jsx";
import { clearSelectedPackage, getContactLinks, readSelectedPackage } from "../contact.js";
import { getPlan } from "../payments/plans.js";
import { useLanguage } from "../context/LanguageContext.jsx";

function ChannelIcon({ type }) {
  if (type === "telegram") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <path
          fill="currentColor"
          d="M9.8 15.6 9.5 19c.4 0 .6-.2.8-.4l1.9-1.8 4 2.9c.7.4 1.3.2 1.5-.7L20.7 6c.3-1.2-.4-1.7-1.2-1.4L4.2 10.3c-1.1.4-1.1 1.1-.2 1.4l4 1.2 9.2-5.8c.4-.3.8-.1.5.2l-7.9 7.3z"
        />
      </svg>
    );
  }
  if (type === "whatsapp") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <path
          fill="currentColor"
          d="M12 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3.1.8.8-3-.2-.3A8 8 0 1 1 12 20zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.7.9-.3.2-.5.1a6.5 6.5 0 0 1-1.9-1.2 7.2 7.2 0 0 1-1.3-1.6c-.1-.3 0-.4.1-.5l.4-.4.1-.3c0-.1 0-.3-.1-.4s-.5-1.3-.7-1.7-.4-.4-.5-.4h-.4c-.2 0-.4.1-.6.3a2 2 0 0 0-.6 1.5 3.5 3.5 0 0 0 .7 1.8 8 8 0 0 0 3 3 7 7 0 0 0 2.1.8c.3 0 .8 0 1.1-.1a2.6 2.6 0 0 0 1.7-1.2c.2-.3.2-.6.1-.7s-.2-.2-.4-.3z"
        />
      </svg>
    );
  }
  if (type === "email") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M8 3h3l1 5-2 1a10 10 0 0 0 4 4l1-2 5 1v3a2 2 0 0 1-2 2A13 13 0 0 1 5 7a2 2 0 0 1 3-2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Contact() {
  const { t } = useLanguage();
  const [selection, setSelection] = useState(null);

  useEffect(() => {
    const sync = () => setSelection(readSelectedPackage());
    sync();
    window.addEventListener("qrmenu:package", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("qrmenu:package", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const plan = selection ? getPlan(selection.planId) || selection : null;
  const planName = selection?.planId
    ? t(`plan.${selection.planId}.name`)
    : selection?.planName || plan?.name;
  const planForMsg = planName
    ? {
        id: plan?.id || selection?.planId,
        name: planName,
        monthly: plan?.monthly ?? selection?.monthly,
        yearly: plan?.yearly ?? selection?.yearly,
      }
    : null;
  const billing = selection?.billing || "monthly";
  const links = getContactLinks(planForMsg, billing, t);

  const channels = [
    { id: "telegram", ...links.telegram },
    { id: "whatsapp", ...links.whatsapp },
    { id: "phone", ...links.phone },
    { id: "email", ...links.email },
  ];

  return (
    <section className="section section--contact" id="contact" aria-labelledby="contact-title">
      <div className="section__inner">
        <Reveal className="section__header section__header--center contact-intro" variant="up">
          <p className="eyebrow">{t("contact.eyebrow")}</p>
          <h2 id="contact-title">{t("contact.title")}</h2>
          <p>{t("contact.lead")}</p>
        </Reveal>

        {selection ? (
          <Reveal className="contact-selected" variant="scale" delay={30}>
            <p className="contact-selected__label">{t("contact.selectedPackage")}</p>
            <strong>
              {planName} · {selection.billing === "yearly" ? t("contact.yearly") : t("contact.monthly")}
            </strong>
            <p className="contact-selected__hint">
              {t("contact.includedHint")}{" "}
              <button type="button" className="contact-selected__clear" onClick={clearSelectedPackage}>
                {t("contact.clear")}
              </button>
            </p>
          </Reveal>
        ) : null}

        <div className="contact-grid">
          {channels.map((channel, index) => (
            <Reveal key={channel.id} variant="up" delay={50 + index * 70}>
              <a
                className={`contact-card contact-card--${channel.id}`}
                href={channel.href}
                target={channel.id === "phone" ? undefined : "_blank"}
                rel={channel.id === "phone" ? undefined : "noreferrer"}
              >
                <span className="contact-card__icon">
                  <ChannelIcon type={channel.id} />
                </span>
                <span className="contact-card__body">
                  <strong>
                    {channel.id === "telegram" || channel.id === "whatsapp"
                      ? channel.hint
                      : channel.label}
                  </strong>
                </span>
                <span className="contact-card__go" aria-hidden>
                  →
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
